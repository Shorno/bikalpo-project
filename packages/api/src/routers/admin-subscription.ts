/**
 * Admin Subscription ORPC Router
 *
 * Admin endpoints for managing shop owner subscriptions:
 * - List all subscriptions (filterable by status)
 * - Approve a subscription (after payment verification)
 * - Reject a subscription
 * - Extend a trial
 */
import { ORPCError } from "@orpc/server";
import { db } from "@bikalpo-project/db";
import { shopSubscription } from "@bikalpo-project/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";

// ════════════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════════════

export const adminSubscriptionRouter = {
    // ── List All Subscriptions ───────────────────────────────────

    list: adminProcedure
        .route({
            method: "GET",
            path: "/admin/subscriptions",
            tags: ["Admin Subscription"],
            summary: "List all shop subscriptions (admin only)",
        })
        .input(
            z.object({
                status: z
                    .enum([
                        "trial",
                        "pending_payment",
                        "pending_approval",
                        "active",
                        "expired",
                        "cancelled",
                    ])
                    .optional(),
                page: z.number().default(1),
                limit: z.number().default(20),
            }),
        )
        .handler(async ({ input }) => {
            const conditions = [];
            if (input.status) {
                conditions.push(eq(shopSubscription.status, input.status));
            }

            const subscriptions = await db.query.shopSubscription.findMany({
                where: conditions.length > 0 ? conditions[0] : undefined,
                with: {
                    user: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            shopName: true,
                            phoneNumber: true,
                        },
                    },
                    plan: true,
                },
                orderBy: [desc(shopSubscription.createdAt)],
                limit: input.limit,
                offset: (input.page - 1) * input.limit,
            });

            return { subscriptions };
        }),

    // ── Approve Subscription ────────────────────────────────────

    approve: adminProcedure
        .route({
            method: "POST",
            path: "/admin/subscriptions/{subscriptionId}/approve",
            tags: ["Admin Subscription"],
            summary: "Approve a subscription payment (admin only)",
        })
        .input(
            z.object({
                subscriptionId: z.string(),
                adminNotes: z.string().optional(),
            }),
        )
        .handler(async ({ input, context }) => {
            const subscription = await db.query.shopSubscription.findFirst({
                where: eq(shopSubscription.id, input.subscriptionId),
                with: { plan: true },
            });

            if (!subscription) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Subscription not found",
                });
            }

            if (subscription.status !== "pending_approval") {
                throw new ORPCError("CONFLICT", {
                    message: `Cannot approve a subscription with status: ${subscription.status}`,
                });
            }

            // Calculate period based on billing cycle
            const now = new Date();
            const periodEnd = new Date(now);
            if (subscription.billingCycle === "yearly") {
                periodEnd.setFullYear(periodEnd.getFullYear() + 1);
            } else {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
            }

            const [updated] = await db
                .update(shopSubscription)
                .set({
                    status: "active",
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    approvedBy: context.session.user.id,
                    approvedAt: now,
                    adminNotes: input.adminNotes || null,
                })
                .where(eq(shopSubscription.id, input.subscriptionId))
                .returning();

            return { success: true, subscription: updated };
        }),

    // ── Reject Subscription ─────────────────────────────────────

    reject: adminProcedure
        .route({
            method: "POST",
            path: "/admin/subscriptions/{subscriptionId}/reject",
            tags: ["Admin Subscription"],
            summary: "Reject a subscription payment (admin only)",
        })
        .input(
            z.object({
                subscriptionId: z.string(),
                adminNotes: z.string().min(1, "Please provide a reason"),
            }),
        )
        .handler(async ({ input, context }) => {
            const subscription = await db.query.shopSubscription.findFirst({
                where: eq(shopSubscription.id, input.subscriptionId),
            });

            if (!subscription) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Subscription not found",
                });
            }

            if (subscription.status !== "pending_approval") {
                throw new ORPCError("CONFLICT", {
                    message: `Cannot reject a subscription with status: ${subscription.status}`,
                });
            }

            // Set back to expired so user can re-submit
            const [updated] = await db
                .update(shopSubscription)
                .set({
                    status: "expired",
                    adminNotes: input.adminNotes,
                    approvedBy: context.session.user.id,
                    approvedAt: new Date(),
                })
                .where(eq(shopSubscription.id, input.subscriptionId))
                .returning();

            return { success: true, subscription: updated };
        }),

    // ── Extend Trial ────────────────────────────────────────────

    extendTrial: adminProcedure
        .route({
            method: "POST",
            path: "/admin/subscriptions/{subscriptionId}/extend-trial",
            tags: ["Admin Subscription"],
            summary: "Extend a shop owner's trial period (admin only)",
        })
        .input(
            z.object({
                subscriptionId: z.string(),
                days: z.number().min(1).max(90),
            }),
        )
        .handler(async ({ input }) => {
            const subscription = await db.query.shopSubscription.findFirst({
                where: eq(shopSubscription.id, input.subscriptionId),
            });

            if (!subscription) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Subscription not found",
                });
            }

            if (
                subscription.status !== "trial" &&
                subscription.status !== "expired"
            ) {
                throw new ORPCError("CONFLICT", {
                    message: "Can only extend trial for trial or expired subscriptions",
                });
            }

            const now = new Date();
            const currentEnd = subscription.trialEnd || now;
            const newEnd = new Date(
                Math.max(currentEnd.getTime(), now.getTime()),
            );
            newEnd.setDate(newEnd.getDate() + input.days);

            const [updated] = await db
                .update(shopSubscription)
                .set({
                    status: "trial",
                    trialEnd: newEnd,
                    trialStart: subscription.trialStart || now,
                })
                .where(eq(shopSubscription.id, input.subscriptionId))
                .returning();

            return {
                success: true,
                subscription: updated,
                message: `Trial extended by ${input.days} days`,
            };
        }),
};
