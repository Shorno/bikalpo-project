"use server";

import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db/config";
import { session, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import type {
  ActionType,
  AuditActivity,
  AuditActivityDetail,
  AuditFilters,
  ModuleType,
} from "@/types/audit";

// Helper: Check if current user is admin
async function requireAdmin() {
  const authSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (
    !authSession?.user?.id ||
    (authSession.user.role !== "admin" &&
      authSession.user.role !== "super_admin")
  ) {
    throw new Error("Unauthorized: Admin access required");
  }

  return authSession;
}

// Helper: Derive action type from session/user data
function _deriveActionFromSession(
  sessionData: any,
  isNewSession: boolean,
): ActionType | null {
  if (isNewSession) return "login";
  // Additional logic can be added to detect logout, etc.
  return null;
}

// Helper: Derive module from context
function _deriveModuleFromContext(metadata?: any): ModuleType {
  // Default to auth for session-based activities
  return "auth";
}

// Helper: Generate human-readable description
function generateDescription(
  action: ActionType,
  userName: string,
  module: ModuleType,
  metadata?: any,
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

// Get audit activities derived from sessions and user actions
export async function getAuditActivities(filters: AuditFilters = {}): Promise<{
  success: boolean;
  activities: AuditActivity[];
  total: number;
  error?: string;
}> {
  try {
    await requireAdmin();

    const {
      dateFrom,
      dateTo,
      userRole,
      actionType,
      module,
      search,
      page = 1,
      pageSize = 50,
    } = filters;

    // Build conditions
    const conditions = [];

    // Date range filter
    if (dateFrom) {
      conditions.push(gte(session.createdAt, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(session.createdAt, dateTo));
    }

    // User role filter
    if (userRole) {
      conditions.push(eq(user.role, userRole));
    }

    // Search filter (user name, email, or ID)
    if (search) {
      conditions.push(
        or(
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`),
          ilike(user.id, `%${search}%`),
        ),
      );
    }

    // Fetch sessions with user data (represents login activities)
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

    // Transform sessions into audit activities
    const activities: AuditActivity[] = sessionsData
      .map((data, index) => {
        const action: ActionType = "login"; // Sessions primarily represent logins
        const currentModule: ModuleType = "auth";

        // Determine if session is still active
        const sessionActive = new Date() < new Date(data.sessionExpiresAt);

        // Determine status
        let status: "success" | "warning" | "failed" = "success";
        if (data.banned) {
          status = "warning";
        }

        // Filter by action type if specified
        if (actionType && action !== actionType) {
          return null;
        }

        // Filter by module if specified
        if (module && currentModule !== module) {
          return null;
        }

        const activity: AuditActivity = {
          logId: `LOG-${data.sessionId.slice(0, 8).toUpperCase()}`,
          timestamp: data.sessionCreatedAt,
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail,
          userRole: data.userRole || "guest",
          action,
          module: currentModule,
          description: generateDescription(
            action,
            data.userName,
            currentModule,
          ),
          status,
          metadata: {
            userAgent: data.userAgent,
          },
          sessionId: data.sessionId,
          sessionActive,
          deviceType: data.userAgent?.toLowerCase().includes("mobile")
            ? "mobile"
            : "web",
        };

        return activity;
      })
      .filter((a): a is AuditActivity => a !== null);

    return {
      success: true,
      activities,
      total,
    };
  } catch (error) {
    console.error("Error fetching audit activities:", error);
    return {
      success: false,
      activities: [],
      total: 0,
      error:
        error instanceof Error ? error.message : "Failed to fetch activities",
    };
  }
}

// Get detailed audit activity information
export async function getAuditActivityDetail(logId: string): Promise<{
  success: boolean;
  activity?: AuditActivityDetail;
  error?: string;
}> {
  try {
    await requireAdmin();

    // Extract session ID from log ID
    const sessionIdPrefix = logId.replace("LOG-", "").toLowerCase();

    // Find the session
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
      return {
        success: false,
        error: "Activity not found",
      };
    }

    const data = sessionData[0];
    const action: ActionType = "login";
    const currentModule: ModuleType = "auth";
    const sessionActive = new Date() < new Date(data.sessionExpiresAt);

    // Determine account status
    let accountStatus: "active" | "blocked" | "pending" = "active";
    if (data.banned) {
      accountStatus = "blocked";
    }

    const activity: AuditActivityDetail = {
      logId,
      timestamp: data.sessionCreatedAt,
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
      userRole: data.userRole || "guest",
      action,
      module: currentModule,
      description: generateDescription(action, data.userName, currentModule),
      status: data.banned ? "warning" : "success",
      metadata: {
        userAgent: data.userAgent,
      },
      sessionId: data.sessionId,
      sessionActive,
      sessionStartTime: data.sessionCreatedAt,
      sessionEndTime: sessionActive ? undefined : data.sessionExpiresAt,
      deviceType: data.userAgent?.toLowerCase().includes("mobile")
        ? "mobile"
        : "web",
      accountStatus,
    };

    return {
      success: true,
      activity,
    };
  } catch (error) {
    console.error("Error fetching audit activity detail:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch activity detail",
    };
  }
}

// Export audit data to CSV format
export async function exportAuditActivities(
  filters: AuditFilters = {},
): Promise<{
  success: boolean;
  csv?: string;
  error?: string;
}> {
  try {
    await requireAdmin();

    // Fetch all matching activities (without pagination)
    const result = await getAuditActivities({ ...filters, pageSize: 10000 });

    if (!result.success || result.activities.length === 0) {
      return {
        success: false,
        error: "No activities to export",
      };
    }

    // Generate CSV
    const headers = [
      "Log ID",
      "Date & Time",
      "User",
      "Role",
      "Action",
      "Module",
      "Description",
      "Status",
    ];

    const rows = result.activities.map((activity) => [
      activity.logId,
      activity.timestamp.toISOString(),
      activity.userName,
      activity.userRole,
      activity.action,
      activity.module,
      activity.description,
      activity.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    return {
      success: true,
      csv: csvContent,
    };
  } catch (error) {
    console.error("Error exporting audit activities:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to export activities",
    };
  }
}
