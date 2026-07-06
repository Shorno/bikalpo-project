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
import { warehouseApplication } from "@bikalpo-project/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, adminProcedure } from "../index";
import {
    buildSharedApplicationValues,
    generateApplicationNumber,
    resolveActiveProductType,
    sharedApplicationFieldsSchema,
} from "./helpers/application-fields";
import { approveWarehouseApplicationById } from "./helpers/approve-application";
import { createPendingKycForUser, deriveKycStatus, ensurePendingKycForUser, getLatestKycRecord } from "./helpers/kyc-verification";

// ════════════════════════════════════════════════════════════════
// SCHEMAS
// ════════════════════════════════════════════════════════════════

const submitApplicationSchema = sharedApplicationFieldsSchema.extend({
    warehouseName: z.string().min(2).max(100),
    warehouseAddress: z.string().min(5).max(500),
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

            const productTypeRecord = input.productTypeId
                ? await resolveActiveProductType(input.productTypeId)
                : null;
            const applicationNumber = await generateApplicationNumber("WAREHOUSE");
            const sharedValues = buildSharedApplicationValues(
                input,
                productTypeRecord?.name,
            );

            const [application] = await db
                .insert(warehouseApplication)
                .values({
                    userId,
                    applicationNumber,
                    warehouseName: input.warehouseName,
                    warehouseAddress: input.warehouseAddress,
                    ...sharedValues,
                })
                .returning();

            await createPendingKycForUser(userId);

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

            // Try by userId first
            let application = await db.query.warehouseApplication.findFirst({
                where: eq(warehouseApplication.userId, userId),
                orderBy: [desc(warehouseApplication.createdAt)],
            });

            // Fallback: try by phone number (handles duplicate users from phone auth)
            if (!application && context.session.user.phoneNumber) {
                application = await db.query.warehouseApplication.findFirst({
                    where: eq(warehouseApplication.phoneNumber, context.session.user.phoneNumber),
                    orderBy: [desc(warehouseApplication.createdAt)],
                });
            }

            return application || null;
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
                    productType: {
                        columns: { id: true, name: true },
                    },
                },
            });

            if (!application) {
                throw new ORPCError("NOT_FOUND", { message: "Warehouse application not found" });
            }

            const latestKyc = await getLatestKycRecord(application.userId);
            const kycRecord =
              latestKyc ?? (await ensurePendingKycForUser(application.userId));

            return {
                ...application,
                kycStatus: deriveKycStatus(kycRecord.status),
            };
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
            return approveWarehouseApplicationById(input.applicationId, {
                adminId: context.session.user.id,
                adminNotes: input.adminNotes,
            });
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
                const productTypeRecord = input.productTypeId
                    ? await resolveActiveProductType(input.productTypeId)
                    : null;
                const applicationNumber = await generateApplicationNumber("WAREHOUSE");
                const sharedValues = buildSharedApplicationValues(
                    input,
                    productTypeRecord?.name,
                );

                const [application] = await db
                    .insert(warehouseApplication)
                    .values({
                        userId,
                        applicationNumber,
                        warehouseName: input.warehouseName,
                        warehouseAddress: input.warehouseAddress,
                        ...sharedValues,
                    })
                    .returning();
                return application;
            }

            if (existing.status === "approved") {
                throw new ORPCError("CONFLICT", {
                    message: "Cannot edit an approved application",
                });
            }

            const productTypeRecord = input.productTypeId
                ? await resolveActiveProductType(input.productTypeId)
                : null;
            const sharedValues = buildSharedApplicationValues(
                input,
                productTypeRecord?.name,
            );

            // Update the existing application and reset to pending
            const [updated] = await db
                .update(warehouseApplication)
                .set({
                    warehouseName: input.warehouseName,
                    warehouseAddress: input.warehouseAddress,
                    ...sharedValues,
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
