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
import { sellerApplication, user, invite, adminInvite, wallet } from "@bikalpo-project/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
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
    // Business profile
    businessCategory: z.string().optional(),
    yearsInBusiness: z.string().optional(),
    monthlyRevenue: z.string().optional(),
    // Location
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    area: z.string().optional(),
    district: z.string().optional(),
    division: z.string().optional(),
    postCode: z.string().optional(),
    // Plan
    selectedPlan: z.string().optional(),
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
                    businessCategory: input.businessCategory || null,
                    yearsInBusiness: input.yearsInBusiness || null,
                    monthlyRevenue: input.monthlyRevenue || null,
                    latitude: input.latitude || null,
                    longitude: input.longitude || null,
                    area: input.area || null,
                    district: input.district || null,
                    division: input.division || null,
                    postCode: input.postCode || null,
                    selectedPlan: input.selectedPlan || null,
                })
                .returning();

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
                    shopLat: application.latitude || undefined,
                    shopLng: application.longitude || undefined,
                })
                .where(eq(user.id, application.userId));

            // ── Auto-Reward on Approval ─────────────────────────
            // If this user was referred, create reward for the inviter
            try {
                const matchingInvite = await db.query.invite.findFirst({
                    where: and(
                        eq(invite.invitedUserId, application.userId),
                        sql`${invite.status} IN ('joined', 'invited', 'subscribed', 'rewarded')`,
                    ),
                });

                if (matchingInvite) {
                    // Check if reward already exists for this invite (prevent duplicates)
                    const existingRewardResult = await db.execute(
                        sql`SELECT id FROM reward WHERE invite_id = ${matchingInvite.id} LIMIT 1`
                    );
                    const existingRewardRows = Array.isArray(existingRewardResult) ? existingRewardResult : (existingRewardResult as any).rows ?? [];
                    
                    if (existingRewardRows.length > 0) {
                        // Reward already exists — skip
                    } else {
                    // Update invite status to subscribed
                    await db
                        .update(invite)
                        .set({
                            status: "subscribed",
                            updatedAt: new Date(),
                        })
                        .where(eq(invite.id, matchingInvite.id));

                    // Determine actual user type from the application's selected plan
                    const actualUserType = (application.selectedPlan || "").toLowerCase().includes("wholesal") 
                        ? "wholesaler" 
                        : "retailer";

                    // Update invite userType to match actual selection (in case admin chose "pending" or wrong type)
                    await db
                        .update(invite)
                        .set({ userType: actualUserType })
                        .where(eq(invite.id, matchingInvite.id));

                    // Determine reward amount based on actual user type
                    const rewardAmount = actualUserType === "wholesaler" ? 150 : 100;

                    // ── Auto Fraud Detection ────────────────────────
                    let fraudCheck = "pending";
                    let fraudReason: string | null = null;

                    // Check 1: Did the inviter and invited user register with very similar phones?
                    const inviterPhoneResult = await db.execute(
                        sql`SELECT phone_number FROM "user" WHERE id = ${matchingInvite.inviterUserId}`
                    );
                    const inviterRows = Array.isArray(inviterPhoneResult) ? inviterPhoneResult : (inviterPhoneResult as any).rows ?? [];
                    const inviterPhone = (inviterRows[0]?.phone_number || "").replace(/^\+880/, "0");
                    const invitedPhone = (application.phoneNumber || "").replace(/^\+880/, "0");

                    if (inviterPhone && invitedPhone && inviterPhone === invitedPhone) {
                        fraudCheck = "flagged";
                        fraudReason = "Self-referral: inviter and invited user have the same phone number";
                    }

                    // Check 2: Did the invite happen suspiciously fast (within 2 minutes of account creation)?
                    if (!fraudReason && matchingInvite.createdAt) {
                        const inviteTime = new Date(matchingInvite.createdAt).getTime();
                        const appTime = new Date(application.createdAt).getTime();
                        const timeDiffMinutes = (appTime - inviteTime) / (1000 * 60);
                        if (timeDiffMinutes < 2) {
                            fraudCheck = "flagged";
                            fraudReason = "Suspicious timing: registration happened within 2 minutes of invite";
                        }
                    }

                    // Check 3: Does the inviter have too many rewards already? (>5 rewards = suspicious)
                    if (!fraudReason) {
                        const rewardCountResult = await db.execute(
                            sql`SELECT count(*) as cnt FROM reward WHERE user_id = ${matchingInvite.inviterUserId}`
                        );
                        const rewardRows = Array.isArray(rewardCountResult) ? rewardCountResult : (rewardCountResult as any).rows ?? [];
                        const existingRewards = Number(rewardRows[0]?.cnt ?? 0);
                        if (existingRewards >= 5) {
                            fraudCheck = "flagged";
                            fraudReason = "Multiple accounts detected: inviter has excessive referral rewards";
                        }
                    }

                    // Check 4: Same device/IP detection — compare session IPs
                    if (!fraudReason) {
                        const inviterSessionResult = await db.execute(
                            sql`SELECT ip_address, "userAgent" FROM session WHERE "userId" = ${matchingInvite.inviterUserId} ORDER BY "createdAt" DESC LIMIT 1`
                        );
                        const inviterSessions = Array.isArray(inviterSessionResult) ? inviterSessionResult : (inviterSessionResult as any).rows ?? [];

                        const invitedSessionResult = await db.execute(
                            sql`SELECT ip_address, "userAgent" FROM session WHERE "userId" = ${application.userId} ORDER BY "createdAt" DESC LIMIT 1`
                        );
                        const invitedSessions = Array.isArray(invitedSessionResult) ? invitedSessionResult : (invitedSessionResult as any).rows ?? [];

                        const inviterIP = inviterSessions[0]?.ip_address;
                        const invitedIP = invitedSessions[0]?.ip_address;
                        const inviterUA = inviterSessions[0]?.userAgent;
                        const invitedUA = invitedSessions[0]?.userAgent;

                        if (inviterIP && invitedIP && inviterIP === invitedIP) {
                            fraudCheck = "flagged";
                            fraudReason = `Same device detected: both accounts logged in from IP ${inviterIP}`;
                            // Also check user agent for stronger signal
                            if (inviterUA && invitedUA && inviterUA === invitedUA) {
                                fraudReason = `Same device & browser: both accounts share IP ${inviterIP} and identical browser fingerprint`;
                            }
                        }
                    }

                    // Create reward with fraud status
                    const rCode = "RWD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
                    const rewardStatus = fraudCheck === "flagged" ? "rejected" : "approved";
                    await db.execute(
                        sql`INSERT INTO reward (reward_code, user_id, invite_id, amount, reward_type, source, status, fraud_check, fraud_reason, created_at, updated_at)
                            VALUES (
                                ${rCode},
                                ${matchingInvite.inviterUserId},
                                ${matchingInvite.id},
                                ${rewardAmount},
                                'referral',
                                'referral',
                                ${rewardStatus},
                                ${fraudCheck},
                                ${fraudReason},
                                NOW(),
                                NOW()
                            )`
                    );

                    // If reward is approved (no fraud), credit the wallet and mark as rewarded
                    if (fraudCheck !== "flagged") {
                        // Upsert wallet: add to balance or create new
                        await db.execute(
                            sql`INSERT INTO wallet (user_id, balance, created_at, updated_at)
                                VALUES (${matchingInvite.inviterUserId}, ${rewardAmount}, NOW(), NOW())
                                ON CONFLICT (user_id) DO UPDATE SET
                                    balance = wallet.balance + ${rewardAmount},
                                    updated_at = NOW()`
                        );

                        // Update invite status to "rewarded"
                        await db
                            .update(invite)
                            .set({ status: "rewarded", updatedAt: new Date() })
                            .where(eq(invite.id, matchingInvite.id));
                    } else {
                        // Fraud detected — mark invite as fraud (no money credited)
                        await db
                            .update(invite)
                            .set({ status: "fraud", updatedAt: new Date() })
                            .where(eq(invite.id, matchingInvite.id));
                    }
                    } // end else (no existing reward)
                }
            } catch (rewardError) {
                console.error("[Auto-Reward] Error creating reward:", rewardError);
                // Non-critical — don't fail approval if reward creation fails
            }

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
                        businessCategory: input.businessCategory || null,
                        yearsInBusiness: input.yearsInBusiness || null,
                        monthlyRevenue: input.monthlyRevenue || null,
                        latitude: input.latitude || null,
                        longitude: input.longitude || null,
                        area: input.area || null,
                        district: input.district || null,
                        division: input.division || null,
                        postCode: input.postCode || null,
                        selectedPlan: input.selectedPlan || null,
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
                    businessCategory: input.businessCategory || null,
                    yearsInBusiness: input.yearsInBusiness || null,
                    monthlyRevenue: input.monthlyRevenue || null,
                    latitude: input.latitude || null,
                    longitude: input.longitude || null,
                    area: input.area || null,
                    district: input.district || null,
                    division: input.division || null,
                    postCode: input.postCode || null,
                    selectedPlan: input.selectedPlan || null,
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
