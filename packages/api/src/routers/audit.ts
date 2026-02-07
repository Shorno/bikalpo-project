import { db } from "@bikalpo-project/db";
import { session, user } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

// Types for audit activities
type ActionType = "login" | "logout" | "create" | "update" | "delete" | "approve" | "reject" | "payment" | "invoice";
type ModuleType = "auth" | "users" | "orders" | "products" | "invoices" | "payments" | "delivery";

// Helper: Generate human-readable description
function generateDescription(
    action: ActionType,
    userName: string,
    module: ModuleType,
): string {
    switch (action) {
        case "login":
            return `${userName} logged into the system`;
        case "logout":
            return `${userName} logged out from the system`;
        case "create":
            return `${userName} created a new ${module} record`;
        case "update":
            return `${userName} updated a ${module} record`;
        case "delete":
            return `${userName} deleted a ${module} record`;
        case "approve":
            return `${userName} approved a ${module} request`;
        case "reject":
            return `${userName} rejected a ${module} request`;
        case "payment":
            return `${userName} processed a payment`;
        case "invoice":
            return `${userName} generated an invoice`;
        default:
            return `${userName} performed an action on ${module}`;
    }
}

// Input schemas
const auditFiltersSchema = z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    userRole: z.string().optional(),
    actionType: z.enum(["login", "logout", "create", "update", "delete", "approve", "reject", "payment", "invoice"]).optional(),
    module: z.enum(["auth", "users", "orders", "products", "invoices", "payments", "delivery"]).optional(),
    search: z.string().optional(),
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(50),
});

const logIdSchema = z.object({
    logId: z.string().min(1),
});

export const auditRouter = {
    /**
     * Get audit activities (derived from sessions)
     * REST: GET /audit/activities
     */
    getActivities: adminProcedure
        .route({
            method: "GET",
            path: "/audit/activities",
            tags: ["Audit"],
            summary: "Get audit activities",
            description: "Get paginated audit activities with filtering",
        })
        .input(auditFiltersSchema)
        .handler(async ({ input }) => {
            const { dateFrom, dateTo, userRole, actionType, module, search, page, pageSize } = input;

            // Build conditions
            const conditions = [];

            if (dateFrom) {
                conditions.push(gte(session.createdAt, new Date(dateFrom)));
            }
            if (dateTo) {
                conditions.push(lte(session.createdAt, new Date(dateTo)));
            }
            if (userRole) {
                conditions.push(eq(user.role, userRole));
            }
            if (search) {
                conditions.push(
                    or(
                        ilike(user.name, `%${search}%`),
                        ilike(user.email, `%${search}%`),
                        ilike(user.id, `%${search}%`),
                    ),
                );
            }

            // Fetch sessions with user data
            const sessionsData = await db
                .select({
                    sessionId: session.id,
                    sessionCreatedAt: session.createdAt,
                    sessionUpdatedAt: session.updatedAt,
                    sessionExpiresAt: session.expiresAt,
                    userId: user.id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    banned: user.banned,
                    userAgent: session.userAgent,
                })
                .from(session)
                .innerJoin(user, eq(session.userId, user.id))
                .where(conditions.length > 0 ? and(...conditions) : undefined)
                .orderBy(desc(session.createdAt))
                .limit(pageSize)
                .offset((page - 1) * pageSize);

            // Get total count
            const [countResult] = await db
                .select({ count: sql<number>`count(*)` })
                .from(session)
                .innerJoin(user, eq(session.userId, user.id))
                .where(conditions.length > 0 ? and(...conditions) : undefined);

            const total = Number(countResult?.count || 0);

            // Transform to activities
            const activities = sessionsData
                .map((data) => {
                    const action: ActionType = "login";
                    const currentModule: ModuleType = "auth";
                    const sessionActive = new Date() < new Date(data.sessionExpiresAt);

                    // Filter by action type and module if specified
                    if (actionType && action !== actionType) return null;
                    if (module && currentModule !== module) return null;

                    return {
                        logId: `LOG-${data.sessionId.slice(0, 8).toUpperCase()}`,
                        timestamp: data.sessionCreatedAt,
                        userId: data.userId,
                        userName: data.userName,
                        userEmail: data.userEmail,
                        userRole: data.userRole || "guest",
                        action,
                        module: currentModule,
                        description: generateDescription(action, data.userName, currentModule),
                        status: data.banned ? "warning" : "success",
                        metadata: { userAgent: data.userAgent },
                        sessionId: data.sessionId,
                        sessionActive,
                        deviceType: data.userAgent?.toLowerCase().includes("mobile") ? "mobile" : "web",
                    };
                })
                .filter((a) => a !== null);

            return { activities, total };
        }),

    /**
     * Get detailed audit activity by log ID
     * REST: GET /audit/activities/:logId
     */
    getActivityDetail: adminProcedure
        .route({
            method: "GET",
            path: "/audit/activities/{logId}",
            tags: ["Audit"],
            summary: "Get audit activity detail",
            description: "Get detailed information for a specific audit activity",
        })
        .input(logIdSchema)
        .handler(async ({ input }) => {
            const sessionIdPrefix = input.logId.replace("LOG-", "").toLowerCase();

            const sessionData = await db
                .select({
                    sessionId: session.id,
                    sessionCreatedAt: session.createdAt,
                    sessionUpdatedAt: session.updatedAt,
                    sessionExpiresAt: session.expiresAt,
                    userId: user.id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    banned: user.banned,
                    userAgent: session.userAgent,
                })
                .from(session)
                .innerJoin(user, eq(session.userId, user.id))
                .where(sql`LOWER(SUBSTRING(${session.id}, 1, 8)) = ${sessionIdPrefix}`)
                .limit(1);

            if (sessionData.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "Activity not found" });
            }

            const data = sessionData[0]!;
            const action: ActionType = "login";
            const currentModule: ModuleType = "auth";
            const sessionActive = new Date() < new Date(data.sessionExpiresAt);

            return {
                activity: {
                    logId: input.logId,
                    timestamp: data.sessionCreatedAt,
                    userId: data.userId,
                    userName: data.userName,
                    userEmail: data.userEmail,
                    userRole: data.userRole || "guest",
                    action,
                    module: currentModule,
                    description: generateDescription(action, data.userName, currentModule),
                    status: data.banned ? "warning" : "success",
                    metadata: { userAgent: data.userAgent },
                    sessionId: data.sessionId,
                    sessionActive,
                    sessionStartTime: data.sessionCreatedAt,
                    sessionEndTime: sessionActive ? null : data.sessionExpiresAt,
                    deviceType: data.userAgent?.toLowerCase().includes("mobile") ? "mobile" : "web",
                    accountStatus: data.banned ? "blocked" : "active",
                },
            };
        }),

    /**
     * Export audit activities to CSV
     * REST: POST /audit/export
     */
    export: adminProcedure
        .route({
            method: "POST",
            path: "/audit/export",
            tags: ["Audit"],
            summary: "Export audit activities",
            description: "Export audit activities to CSV format",
        })
        .input(auditFiltersSchema.omit({ page: true, pageSize: true }))
        .handler(async ({ input }) => {
            // Get all activities without pagination
            const { dateFrom, dateTo, userRole, search } = input;

            const conditions = [];
            if (dateFrom) conditions.push(gte(session.createdAt, new Date(dateFrom)));
            if (dateTo) conditions.push(lte(session.createdAt, new Date(dateTo)));
            if (userRole) conditions.push(eq(user.role, userRole));
            if (search) {
                conditions.push(
                    or(
                        ilike(user.name, `%${search}%`),
                        ilike(user.email, `%${search}%`),
                    ),
                );
            }

            const sessionsData = await db
                .select({
                    sessionId: session.id,
                    sessionCreatedAt: session.createdAt,
                    userName: user.name,
                    userRole: user.role,
                    banned: user.banned,
                })
                .from(session)
                .innerJoin(user, eq(session.userId, user.id))
                .where(conditions.length > 0 ? and(...conditions) : undefined)
                .orderBy(desc(session.createdAt))
                .limit(10000);

            if (sessionsData.length === 0) {
                throw new ORPCError("NOT_FOUND", { message: "No activities to export" });
            }

            const headers = ["Log ID", "Date & Time", "User", "Role", "Action", "Module", "Description", "Status"];
            const rows = sessionsData.map((data) => [
                `LOG-${data.sessionId.slice(0, 8).toUpperCase()}`,
                data.sessionCreatedAt.toISOString(),
                data.userName,
                data.userRole || "guest",
                "login",
                "auth",
                generateDescription("login", data.userName, "auth"),
                data.banned ? "warning" : "success",
            ]);

            const csv = [
                headers.join(","),
                ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
            ].join("\n");

            return { csv };
        }),
};
