/**
 * Subscription ORPC Router
 *
 * Shop Owner endpoints for managing their subscription/trial:
 * - Get current subscription status
 * - Select a plan and submit payment
 * - Renew an expired subscription
 */
import { ORPCError } from "@orpc/server";
import { db } from "@bikalpo-project/db";
import {
    shopSubscription,
    landingPricingPlan,
} from "@bikalpo-project/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

import { shopOwnerProcedure } from "../index";

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

const TRIAL_DAYS = 7;

/** Check if a subscription is currently active (trial or paid) */
function isSubscriptionActive(sub: {
    status: string;
    trialEnd: Date | null;
    currentPeriodEnd: Date | null;
}): { active: boolean; daysRemaining: number } {
    const now = new Date();

    if (sub.status === "trial" && sub.trialEnd) {
        const remaining = Math.ceil(
            (sub.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        return { active: remaining > 0, daysRemaining: Math.max(0, remaining) };
    }

    if (sub.status === "active" && sub.currentPeriodEnd) {
        const remaining = Math.ceil(
            (sub.currentPeriodEnd.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24),
        );
        return { active: remaining > 0, daysRemaining: Math.max(0, remaining) };
    }

    return { active: false, daysRemaining: 0 };
}

/** Create a trial subscription for a newly approved shop owner */
export async function createTrialSubscription(userId: string) {
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

    const [subscription] = await db
        .insert(shopSubscription)
        .values({
            userId,
            status: "trial",
            billingCycle: "trial",
            trialStart: now,
            trialEnd,
        })
        .returning();

    return subscription;
}

// ════════════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════════════

export const subscriptionRouter = {
    // ── Get My Subscription ─────────────────────────────────────

    getMySubscription: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/subscription/my",
            tags: ["Subscription"],
            summary: "Get current shop owner's subscription status",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            const subscription = await db.query.shopSubscription.findFirst({
                where: eq(shopSubscription.userId, userId),
                orderBy: [desc(shopSubscription.createdAt)],
                with: {
                    plan: true,
                },
            });

            if (!subscription) {
                return {
                    subscription: null,
                    isActive: false,
                    daysRemaining: 0,
                    status: "none" as const,
                };
            }

            const { active, daysRemaining } =
                isSubscriptionActive(subscription);

            // Auto-expire trial/active subscriptions that have passed their end date
            if (
                !active &&
                (subscription.status === "trial" ||
                    subscription.status === "active")
            ) {
                await db
                    .update(shopSubscription)
                    .set({ status: "expired" })
                    .where(eq(shopSubscription.id, subscription.id));

                return {
                    subscription: { ...subscription, status: "expired" },
                    isActive: false,
                    daysRemaining: 0,
                    status: "expired" as const,
                };
            }

            return {
                subscription,
                isActive: active,
                daysRemaining,
                status: subscription.status as
                    | "trial"
                    | "active"
                    | "expired"
                    | "pending_payment"
                    | "pending_approval"
                    | "cancelled",
            };
        }),

    // ── Get Available Plans ──────────────────────────────────────

    getAvailablePlans: shopOwnerProcedure
        .route({
            method: "GET",
            path: "/subscription/plans",
            tags: ["Subscription"],
            summary: "Get all active subscription plans",
        })
        .handler(async () => {
            const plans = await db.query.landingPricingPlan.findMany({
                where: eq(landingPricingPlan.active, true),
                orderBy: [landingPricingPlan.sortOrder],
            });
            return plans;
        }),

    // ── Submit Payment for a Plan ─────────────────────────────────

    submitPayment: shopOwnerProcedure
        .route({
            method: "POST",
            path: "/subscription/pay",
            tags: ["Subscription"],
            summary: "Submit payment proof for a subscription plan",
        })
        .input(
            z.object({
                planId: z.number(),
                billingCycle: z.enum(["monthly", "yearly"]),
                paymentProof: z.string().min(1), // URL to uploaded receipt
                paymentNotes: z.string().optional(),
            }),
        )
        .handler(async ({ input, context }) => {
            const userId = context.session.user.id;

            // Verify the plan exists and is active
            const plan = await db.query.landingPricingPlan.findFirst({
                where: and(
                    eq(landingPricingPlan.id, input.planId),
                    eq(landingPricingPlan.active, true),
                ),
            });

            if (!plan) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Plan not found or inactive",
                });
            }

            // Check for existing pending payment
            const existingPending =
                await db.query.shopSubscription.findFirst({
                    where: and(
                        eq(shopSubscription.userId, userId),
                        eq(shopSubscription.status, "pending_approval"),
                    ),
                });

            if (existingPending) {
                throw new ORPCError("CONFLICT", {
                    message:
                        "You already have a payment pending approval. Please wait for admin review.",
                });
            }

            // Get current subscription to check state
            const currentSub = await db.query.shopSubscription.findFirst({
                where: eq(shopSubscription.userId, userId),
                orderBy: [desc(shopSubscription.createdAt)],
            });

            if (currentSub) {
                // Update existing subscription
                const [updated] = await db
                    .update(shopSubscription)
                    .set({
                        planId: input.planId,
                        billingCycle: input.billingCycle,
                        paymentProof: input.paymentProof,
                        paymentNotes: input.paymentNotes || null,
                        status: "pending_approval",
                    })
                    .where(eq(shopSubscription.id, currentSub.id))
                    .returning();

                return {
                    success: true,
                    subscription: updated,
                    message:
                        "Payment submitted! Waiting for admin approval.",
                };
            }

            // Create new subscription record
            const [subscription] = await db
                .insert(shopSubscription)
                .values({
                    userId,
                    planId: input.planId,
                    billingCycle: input.billingCycle,
                    paymentProof: input.paymentProof,
                    paymentNotes: input.paymentNotes || null,
                    status: "pending_approval",
                })
                .returning();

            return {
                success: true,
                subscription,
                message: "Payment submitted! Waiting for admin approval.",
            };
        }),
};
