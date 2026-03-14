/**
 * Seller Application ORPC Router
 *
 * Handles business seller application lifecycle:
 * - Consumer submits application
 * - Consumer checks own application status
 * - Admin lists, approves, and rejects applications
 */
import { ORPCError } from "@orpc/server";
import { db } from "@bikalpo-project/db";
import { sellerApplication, user } from "@bikalpo-project/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, adminProcedure } from "../index";

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

/** Generate a URL-safe slug from a shop name, ensuring uniqueness */
async function generateUniqueShopSlug(shopName: string): Promise<string> {
    const base = shopName
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
        .where(eq(user.shopSlug, base))
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
    shopName: z.string().min(2).max(100),
    ownerName: z.string().min(2).max(100),
    phoneNumber: z.string().min(10),
    businessType: z.enum(["retail", "restaurant"]),
    shopAddress: z.string().min(5).max(500),
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

export const sellerApplicationRouter = {
    // ── Consumer: Submit Application ─────────────────────────────

    submit: protectedProcedure
        .route({
            method: "POST",
            path: "/seller-applications",
            tags: ["Seller Application"],
            summary: "Submit a new seller application",
        })
        .input(submitApplicationSchema)
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            // Check if user already has a pending or approved application
            const existing = await db.query.sellerApplication.findFirst({
                where: eq(sellerApplication.userId, userId),
                orderBy: [desc(sellerApplication.createdAt)],
            });

            if (existing && (existing.status === "pending" || existing.status === "approved")) {
                throw new ORPCError("CONFLICT", {
                    message: existing.status === "pending"
                        ? "You already have a pending application"
                        : "Your application has already been approved",
                });
            }

            const [application] = await db
                .insert(sellerApplication)
                .values({
                    userId,
                    shopName: input.shopName,
                    ownerName: input.ownerName,
                    phoneNumber: input.phoneNumber,
                    businessType: input.businessType,
                    shopAddress: input.shopAddress,
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
            path: "/seller-applications/my",
            tags: ["Seller Application"],
            summary: "Get current user's latest seller application",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            const application = await db.query.sellerApplication.findFirst({
                where: eq(sellerApplication.userId, userId),
                orderBy: [desc(sellerApplication.createdAt)],
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
            path: "/seller-applications/{applicationId}",
            tags: ["Seller Application"],
            summary: "Get a single seller application by ID (admin only)",
        })
        .input(
            z.object({
                applicationId: z.string(),
            }),
        )
        .handler(async ({ input }) => {
            const application = await db.query.sellerApplication.findFirst({
                where: eq(sellerApplication.id, input.applicationId),
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
                throw new ORPCError("NOT_FOUND", { message: "Application not found" });
            }

            return application;
        }),

    // ── Admin: List All Applications ────────────────────────────

    list: adminProcedure
        .route({
            method: "GET",
            path: "/seller-applications",
            tags: ["Seller Application"],
            summary: "List all seller applications (admin only)",
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
                conditions.push(eq(sellerApplication.status, input.status));
            }

            const applications = await db.query.sellerApplication.findMany({
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
                orderBy: [desc(sellerApplication.createdAt)],
                limit: input.limit,
                offset: (input.page - 1) * input.limit,
            });

            return { applications };
        }),

    // ── Admin: Approve Application ──────────────────────────────

    approve: adminProcedure
        .route({
            method: "POST",
            path: "/seller-applications/{applicationId}/approve",
            tags: ["Seller Application"],
            summary: "Approve a seller application (admin only)",
        })
        .input(reviewApplicationSchema)
        .handler(async ({ input, context }) => {
            const application = await db.query.sellerApplication.findFirst({
                where: eq(sellerApplication.id, input.applicationId),
            });

            if (!application) {
                throw new ORPCError("NOT_FOUND", { message: "Application not found" });
            }

            if (application.status !== "pending") {
                throw new ORPCError("CONFLICT", {
                    message: `Application is already ${application.status}`,
                });
            }

            // Determine if seller-enabled based on business type
            const isSeller = application.businessType === "retail";

            // Update application status
            await db
                .update(sellerApplication)
                .set({
                    status: "approved",
                    adminNotes: input.adminNotes || null,
                    reviewedBy: context.session.user.id,
                    reviewedAt: new Date(),
                })
                .where(eq(sellerApplication.id, input.applicationId));

            // Generate a unique shop slug from the shop name
            const shopSlug = await generateUniqueShopSlug(application.shopName);

            // Upgrade user role to shop_owner and set capability flags
            await db
                .update(user)
                .set({
                    role: "shop_owner",
                    isSeller,
                    sellerStatus: "approved",
                    businessType: application.businessType,
                    shopAddress: application.shopAddress,
                    shopName: application.shopName,
                    shopSlug,
                    ownerName: application.ownerName,
                })
                .where(eq(user.id, application.userId));

            return { success: true, isSeller };
        }),

    // ── Admin: Reject Application ───────────────────────────────

    reject: adminProcedure
        .route({
            method: "POST",
            path: "/seller-applications/{applicationId}/reject",
            tags: ["Seller Application"],
            summary: "Reject a seller application (admin only)",
        })
        .input(reviewApplicationSchema)
        .handler(async ({ input, context }) => {
            const application = await db.query.sellerApplication.findFirst({
                where: eq(sellerApplication.id, input.applicationId),
            });

            if (!application) {
                throw new ORPCError("NOT_FOUND", { message: "Application not found" });
            }

            if (application.status !== "pending") {
                throw new ORPCError("CONFLICT", {
                    message: `Application is already ${application.status}`,
                });
            }

            await db
                .update(sellerApplication)
                .set({
                    status: "rejected",
                    adminNotes: input.adminNotes || null,
                    reviewedBy: context.session.user.id,
                    reviewedAt: new Date(),
                })
                .where(eq(sellerApplication.id, input.applicationId));

            return { success: true };
        }),

    // ── Consumer: Update Own Application ────────────────────────

    update: protectedProcedure
        .route({
            method: "POST",
            path: "/seller-applications/update",
            tags: ["Seller Application"],
            summary: "Update own pending/rejected seller application",
        })
        .input(submitApplicationSchema)
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            const existing = await db.query.sellerApplication.findFirst({
                where: eq(sellerApplication.userId, userId),
                orderBy: [desc(sellerApplication.createdAt)],
            });

            // If no existing application, create a new one
            if (!existing) {
                const [application] = await db
                    .insert(sellerApplication)
                    .values({
                        userId,
                        shopName: input.shopName,
                        ownerName: input.ownerName,
                        phoneNumber: input.phoneNumber,
                        businessType: input.businessType,
                        shopAddress: input.shopAddress,
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
                .update(sellerApplication)
                .set({
                    shopName: input.shopName,
                    ownerName: input.ownerName,
                    phoneNumber: input.phoneNumber,
                    businessType: input.businessType,
                    shopAddress: input.shopAddress,
                    tradeLicenseNumber: input.tradeLicenseNumber || null,
                    documents: input.documents || [],
                    status: "pending",
                    adminNotes: null,
                    reviewedBy: null,
                    reviewedAt: null,
                })
                .where(eq(sellerApplication.id, existing.id))
                .returning();

            return updated;
        }),
};
