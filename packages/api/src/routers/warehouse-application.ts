/**
 * Warehouse Application ORPC Router
 *
 * Handles warehouse application lifecycle:
 * - Consumer submits warehouse application
 * - Consumer checks own application status
 * - Admin lists, approves, and rejects applications
 */
import { ORPCError } from "@orpc/server";
import { db } from "@bikalpo-project/db";
import { warehouseApplication, user } from "@bikalpo-project/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, adminProcedure } from "../index";

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

/** Generate a URL-safe slug from a warehouse name, ensuring uniqueness */
async function generateUniqueWarehouseSlug(warehouseName: string): Promise<string> {
    const base = warehouseName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 50);

    // Check if slug already exists
    const existing = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.warehouseSlug, base))
        .limit(1);

    if (existing.length === 0) return base;

    // Append random suffix if slug collision
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${base}-${suffix}`;
}

// ════════════════════════════════════════════════════════════════
// SCHEMAS
// ════════════════════════════════════════════════════════════════

const submitApplicationSchema = z.object({
    warehouseName: z.string().min(2).max(100),
    ownerName: z.string().min(2).max(100),
    phoneNumber: z.string().min(10),
    warehouseAddress: z.string().min(5).max(500),
    tradeLicenseNumber: z.string().optional(),
    documents: z.array(z.string()).optional(),
});

const reviewApplicationSchema = z.object({
    applicationId: z.string(),
    adminNotes: z.string().optional(),
});

// ════════════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════════════

export const warehouseApplicationRouter = {
    // ── Consumer: Submit Application ─────────────────────────────

    submit: protectedProcedure
        .route({
            method: "POST",
            path: "/warehouse-applications",
            tags: ["Warehouse Application"],
            summary: "Submit a new warehouse application",
        })
        .input(submitApplicationSchema)
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            // Check if user already has a pending or approved application
            const existing = await db.query.warehouseApplication.findFirst({
                where: eq(warehouseApplication.userId, userId),
                orderBy: [desc(warehouseApplication.createdAt)],
            });

            if (existing && (existing.status === "pending" || existing.status === "approved")) {
                throw new ORPCError("CONFLICT", {
                    message: existing.status === "pending"
                        ? "You already have a pending warehouse application"
                        : "Your warehouse application has already been approved",
                });
            }

            const [application] = await db
                .insert(warehouseApplication)
                .values({
                    userId,
                    warehouseName: input.warehouseName,
                    ownerName: input.ownerName,
                    phoneNumber: input.phoneNumber,
                    warehouseAddress: input.warehouseAddress,
                    tradeLicenseNumber: input.tradeLicenseNumber || null,
                    documents: input.documents || [],
                })
                .returning();

            return application;
        }),

    // ── Consumer: Check Own Application Status ──────────────────

    getMyApplication: protectedProcedure
        .route({
            method: "GET",
            path: "/warehouse-applications/my",
            tags: ["Warehouse Application"],
            summary: "Get current user's latest warehouse application",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            const application = await db.query.warehouseApplication.findFirst({
                where: eq(warehouseApplication.userId, userId),
                orderBy: [desc(warehouseApplication.createdAt)],
            });

            if (!application) {
                return null;
            }

            return application;
        }),

    // ── Admin: Get Application by ID ─────────────────────────────

    getById: adminProcedure
        .route({
            method: "GET",
            path: "/warehouse-applications/{applicationId}",
            tags: ["Warehouse Application"],
            summary: "Get a single warehouse application by ID (admin only)",
        })
        .input(
            z.object({
                applicationId: z.string(),
            }),
        )
        .handler(async ({ input }) => {
            const application = await db.query.warehouseApplication.findFirst({
                where: eq(warehouseApplication.id, input.applicationId),
                with: {
                    user: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            role: true,
                            image: true,
                        },
                    },
                    reviewer: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });

            if (!application) {
                throw new ORPCError("NOT_FOUND", { message: "Warehouse application not found" });
            }

            return application;
        }),

    // ── Admin: List All Applications ────────────────────────────

    list: adminProcedure
        .route({
            method: "GET",
            path: "/warehouse-applications",
            tags: ["Warehouse Application"],
            summary: "List all warehouse applications (admin only)",
        })
        .input(
            z.object({
                status: z.enum(["pending", "approved", "rejected"]).optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ input }) => {
            const conditions = [];

            if (input.status) {
                conditions.push(eq(warehouseApplication.status, input.status));
            }

            const applications = await db.query.warehouseApplication.findMany({
                where: conditions.length > 0 ? conditions[0] : undefined,
                with: {
                    user: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            role: true,
                        },
                    },
                },
                orderBy: [desc(warehouseApplication.createdAt)],
                limit: input.limit,
                offset: (input.page - 1) * input.limit,
            });

            return { applications };
        }),

    // ── Admin: Approve Application ──────────────────────────────

    approve: adminProcedure
        .route({
            method: "POST",
            path: "/warehouse-applications/{applicationId}/approve",
            tags: ["Warehouse Application"],
            summary: "Approve a warehouse application (admin only)",
        })
        .input(reviewApplicationSchema)
        .handler(async ({ input, context }) => {
            const application = await db.query.warehouseApplication.findFirst({
                where: eq(warehouseApplication.id, input.applicationId),
            });

            if (!application) {
                throw new ORPCError("NOT_FOUND", { message: "Warehouse application not found" });
            }

            if (application.status !== "pending") {
                throw new ORPCError("CONFLICT", {
                    message: `Application is already ${application.status}`,
                });
            }

            // Update application status
            await db
                .update(warehouseApplication)
                .set({
                    status: "approved",
                    adminNotes: input.adminNotes || null,
                    reviewedBy: context.session.user.id,
                    reviewedAt: new Date(),
                })
                .where(eq(warehouseApplication.id, input.applicationId));

            // Generate a unique warehouse slug
            const warehouseSlug = await generateUniqueWarehouseSlug(application.warehouseName);

            // Upgrade user role to warehouse and set warehouse fields
            await db
                .update(user)
                .set({
                    role: "warehouse",
                    warehouseName: application.warehouseName,
                    warehouseSlug,
                    warehouseAddress: application.warehouseAddress,
                    ownerName: application.ownerName,
                })
                .where(eq(user.id, application.userId));

            return { success: true };
        }),

    // ── Admin: Reject Application ───────────────────────────────

    reject: adminProcedure
        .route({
            method: "POST",
            path: "/warehouse-applications/{applicationId}/reject",
            tags: ["Warehouse Application"],
            summary: "Reject a warehouse application (admin only)",
        })
        .input(reviewApplicationSchema)
        .handler(async ({ input, context }) => {
            const application = await db.query.warehouseApplication.findFirst({
                where: eq(warehouseApplication.id, input.applicationId),
            });

            if (!application) {
                throw new ORPCError("NOT_FOUND", { message: "Warehouse application not found" });
            }

            if (application.status !== "pending") {
                throw new ORPCError("CONFLICT", {
                    message: `Application is already ${application.status}`,
                });
            }

            await db
                .update(warehouseApplication)
                .set({
                    status: "rejected",
                    adminNotes: input.adminNotes || null,
                    reviewedBy: context.session.user.id,
                    reviewedAt: new Date(),
                })
                .where(eq(warehouseApplication.id, input.applicationId));

            return { success: true };
        }),

    // ── Consumer: Update Own Application ────────────────────────

    update: protectedProcedure
        .route({
            method: "POST",
            path: "/warehouse-applications/update",
            tags: ["Warehouse Application"],
            summary: "Update own pending/rejected warehouse application",
        })
        .input(submitApplicationSchema)
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            const existing = await db.query.warehouseApplication.findFirst({
                where: eq(warehouseApplication.userId, userId),
                orderBy: [desc(warehouseApplication.createdAt)],
            });

            // If no existing application, create a new one
            if (!existing) {
                const [application] = await db
                    .insert(warehouseApplication)
                    .values({
                        userId,
                        warehouseName: input.warehouseName,
                        ownerName: input.ownerName,
                        phoneNumber: input.phoneNumber,
                        warehouseAddress: input.warehouseAddress,
                        tradeLicenseNumber: input.tradeLicenseNumber || null,
                        documents: input.documents || [],
                    })
                    .returning();
                return application;
            }

            if (existing.status === "approved") {
                throw new ORPCError("CONFLICT", {
                    message: "Cannot edit an approved application",
                });
            }

            // Update the existing application and reset to pending
            const [updated] = await db
                .update(warehouseApplication)
                .set({
                    warehouseName: input.warehouseName,
                    ownerName: input.ownerName,
                    phoneNumber: input.phoneNumber,
                    warehouseAddress: input.warehouseAddress,
                    tradeLicenseNumber: input.tradeLicenseNumber || null,
                    documents: input.documents || [],
                    status: "pending",
                    adminNotes: null,
                    reviewedBy: null,
                    reviewedAt: null,
                })
                .where(eq(warehouseApplication.id, existing.id))
                .returning();

            return updated;
        }),
};
