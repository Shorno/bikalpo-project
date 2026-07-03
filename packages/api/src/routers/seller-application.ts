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
import { sellerApplication, invite, adminInvite } from "@bikalpo-project/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, adminProcedure } from "../index";
import {
    buildSharedApplicationValues,
    generateApplicationNumber,
    resolveActiveProductType,
    sharedApplicationFieldsSchema,
} from "./helpers/application-fields";
import { approveSellerApplicationById } from "./helpers/approve-application";
import { createPendingKycForUser, deriveKycStatus, ensurePendingKycForUser, getLatestKycRecord } from "./helpers/kyc-verification";

// ════════════════════════════════════════════════════════════════
// SCHEMAS
// ════════════════════════════════════════════════════════════════

const submitApplicationSchema = sharedApplicationFieldsSchema.extend({
    shopName: z.string().min(2).max(100),
    businessType: z.enum(["retail", "restaurant"]).default("retail"),
    shopAddress: z.string().min(5).max(500),
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

            const productTypeRecord = input.productTypeId
                ? await resolveActiveProductType(input.productTypeId)
                : null;
            const applicationNumber = await generateApplicationNumber("SELLER");
            const sharedValues = buildSharedApplicationValues(
                input,
                productTypeRecord?.name,
            );

            const [application] = await db
                .insert(sellerApplication)
                .values({
                    userId,
                    applicationNumber,
                    shopName: input.shopName,
                    businessType: input.businessType,
                    shopAddress: input.shopAddress,
                    ...sharedValues,
                })
                .returning();

            await createPendingKycForUser(userId);

            // ── Referral Tracking ───────────────────────────────
            // Check if this user's phone matches any pending invite
            try {
                // Generate all possible phone format variants
                const rawPhone = input.phoneNumber.replace(/[\s\-()]/g, "");
                const digitsOnly = rawPhone.replace(/^\+/, "");
                const localPhone = digitsOnly.replace(/^880/, "0");
                const intlPhone = `+880${localPhone.replace(/^0/, "")}`;
                const plainIntl = `880${localPhone.replace(/^0/, "")}`;
                
                const phoneVariants = [...new Set([
                    rawPhone,        // original
                    localPhone,      // 01577039666
                    intlPhone,       // +8801577039666
                    plainIntl,       // 8801577039666
                ])];

                console.log("[Referral Tracking] Phone variants:", phoneVariants);

                // Check user-to-user invite table
                const matchingInvite = await db.query.invite.findFirst({
                    where: and(
                        sql`${invite.invitedPhone} IN (${sql.join(phoneVariants.map(p => sql`${p}`), sql`, `)})`,
                        eq(invite.status, "invited"),
                    ),
                });

                if (matchingInvite) {
                    console.log("[Referral Tracking] Found user invite match:", matchingInvite.id);
                    const userType = input.businessType === "restaurant" ? "wholesaler" : "retailer";
                    await db
                        .update(invite)
                        .set({
                            status: "joined",
                            invitedUserId: userId,
                            userType,
                            updatedAt: new Date(),
                        })
                        .where(eq(invite.id, matchingInvite.id));
                    console.log("[Referral Tracking] User invite updated to 'joined'");
                } else {
                    console.log("[Referral Tracking] No user invite match found");
                }

                // Check admin_invite table
                const matchingAdminInvite = await db.query.adminInvite.findFirst({
                    where: and(
                        sql`${adminInvite.invitedPhone} IN (${sql.join(phoneVariants.map(p => sql`${p}`), sql`, `)})`,
                        eq(adminInvite.status, "invited"),
                    ),
                });

                if (matchingAdminInvite) {
                    console.log("[Referral Tracking] Found admin invite match:", matchingAdminInvite.id);
                    await db
                        .update(adminInvite)
                        .set({
                            status: "joined",
                            invitedUserId: userId,
                            updatedAt: new Date(),
                        })
                        .where(eq(adminInvite.id, matchingAdminInvite.id));
                    console.log("[Referral Tracking] Admin invite updated to 'joined'");
                } else {
                    console.log("[Referral Tracking] No admin invite match found");
                }
            } catch (err) {
                console.error("[Referral Tracking] Error:", err);
                // Non-critical — don't fail the application if referral tracking fails
            }

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

            // Try by userId first
            let application = await db.query.sellerApplication.findFirst({
                where: eq(sellerApplication.userId, userId),
                orderBy: [desc(sellerApplication.createdAt)],
            });

            // Fallback: try by phone number (handles duplicate users from phone auth)
            if (!application && context.session.user.phoneNumber) {
                application = await db.query.sellerApplication.findFirst({
                    where: eq(sellerApplication.phoneNumber, context.session.user.phoneNumber),
                    orderBy: [desc(sellerApplication.createdAt)],
                });
            }

            return application || null;
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
                    productType: {
                        columns: { id: true, name: true },
                    },
                },
            });

            if (!application) {
                throw new ORPCError("NOT_FOUND", { message: "Application not found" });
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
            return approveSellerApplicationById(input.applicationId, {
                adminId: context.session.user.id,
                adminNotes: input.adminNotes,
            });
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
                const productTypeRecord = input.productTypeId
                    ? await resolveActiveProductType(input.productTypeId)
                    : null;
                const applicationNumber = await generateApplicationNumber("SELLER");
                const sharedValues = buildSharedApplicationValues(
                    input,
                    productTypeRecord?.name,
                );

                const [application] = await db
                    .insert(sellerApplication)
                    .values({
                        userId,
                        applicationNumber,
                        shopName: input.shopName,
                        businessType: input.businessType,
                        shopAddress: input.shopAddress,
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
                .update(sellerApplication)
                .set({
                    shopName: input.shopName,
                    businessType: input.businessType,
                    shopAddress: input.shopAddress,
                    ...sharedValues,
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
