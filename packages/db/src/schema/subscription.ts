import { relations } from "drizzle-orm";
import {
    index,
    integer,
    pgTable,
    text,
    timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { landingPricingPlan } from "./landing-pricing-plan";

/**
 * Shop Subscription — tracks each shop owner's subscription/trial state.
 *
 * Statuses:
 *   trial             → auto-created when seller application is approved
 *   pending_payment   → user selected a plan but hasn't paid yet
 *   pending_approval  → user uploaded payment proof, waiting for admin
 *   active            → admin approved the payment
 *   expired           → trial or subscription period ended
 *   cancelled         → admin cancelled the subscription
 */
export const shopSubscription = pgTable(
    "shop_subscription",
    {
        id: text("id")
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        planId: integer("plan_id").references(() => landingPricingPlan.id, {
            onDelete: "set null",
        }),
        status: text("status").notNull().default("trial"),
        billingCycle: text("billing_cycle").default("trial"), // trial | monthly | yearly

        // Trial period
        trialStart: timestamp("trial_start"),
        trialEnd: timestamp("trial_end"),

        // Paid subscription period
        currentPeriodStart: timestamp("current_period_start"),
        currentPeriodEnd: timestamp("current_period_end"),

        // Payment info
        paymentProof: text("payment_proof"), // URL to uploaded receipt
        paymentNotes: text("payment_notes"), // user notes about payment

        // Admin review
        adminNotes: text("admin_notes"),
        approvedBy: text("approved_by").references(() => user.id),
        approvedAt: timestamp("approved_at"),

        // Timestamps
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("shop_subscription_userId_idx").on(table.userId),
        index("shop_subscription_status_idx").on(table.status),
    ],
);

export const shopSubscriptionRelations = relations(
    shopSubscription,
    ({ one }) => ({
        user: one(user, {
            fields: [shopSubscription.userId],
            references: [user.id],
        }),
        plan: one(landingPricingPlan, {
            fields: [shopSubscription.planId],
            references: [landingPricingPlan.id],
        }),
        approver: one(user, {
            fields: [shopSubscription.approvedBy],
            references: [user.id],
            relationName: "subscriptionApprover",
        }),
    }),
);

export type ShopSubscription = typeof shopSubscription.$inferSelect;
export type NewShopSubscription = typeof shopSubscription.$inferInsert;
