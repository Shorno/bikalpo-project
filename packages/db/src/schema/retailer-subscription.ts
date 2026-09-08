import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const retailerSubscriptionPlan = pgTable(
  "retailer_subscription_plan",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    durationMonths: integer("duration_months"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("BDT"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("retailer_subscription_plan_active_duration_unique")
      .on(sql`coalesce(${t.durationMonths}, 0)`)
      .where(sql`${t.active}`),
    check(
      "retailer_subscription_plan_terms_check",
      sql`${t.currency} = 'BDT' AND ((${t.code} = 'free' AND ${t.durationMonths} IS NULL AND ${t.amountMinor} = 0 AND ${t.active}) OR (${t.code} <> 'free' AND ${t.durationMonths} IS NOT NULL AND ${t.durationMonths} IN (1,6,12) AND ${t.amountMinor} > 0 AND ${t.amountMinor} <= 100000000))`,
    ),
  ],
);

export const retailerSubscriptionPurchase = pgTable(
  "retailer_subscription_purchase",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shopId: text("shop_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => retailerSubscriptionPlan.id),
    planCode: text("plan_code").notNull(),
    planName: text("plan_name").notNull(),
    planVersion: integer("plan_version").notNull(),
    durationMonths: integer("duration_months").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("BDT"),
    provider: text("provider").notNull().default("dummy"),
    previousTermId: text("previous_term_id").notNull(),
    quoteExpiresAt: timestamp("quote_expires_at", {
      withTimezone: true,
    }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("retailer_subscription_purchase_key_unique").on(
      t.shopId,
      t.idempotencyKey,
    ),
    index("retailer_subscription_purchase_shop_idx").on(t.shopId),
    check(
      "retailer_subscription_purchase_terms_check",
      sql`${t.provider} = 'dummy' AND ${t.currency} = 'BDT' AND ${t.durationMonths} IN (1,6,12) AND ${t.amountMinor} > 0 AND ((${t.confirmedAt} IS NULL AND ${t.idempotencyKey} IS NULL) OR (${t.confirmedAt} IS NOT NULL AND ${t.idempotencyKey} IS NOT NULL))`,
    ),
  ],
);

export const retailerSubscription = pgTable(
  "retailer_subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    shopId: text("shop_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: text("plan_id")
      .notNull()
      .references(() => retailerSubscriptionPlan.id),
    purchaseId: text("purchase_id")
      .unique()
      .references(() => retailerSubscriptionPurchase.id),
    planCode: text("plan_code").notNull(),
    planName: text("plan_name").notNull(),
    durationMonths: integer("duration_months"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("BDT"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isCurrent: boolean("is_current").notNull().default(true),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    source: text("source").notNull(),
    autoRenew: boolean("auto_renew").notNull().default(false),
    nextBillingAt: timestamp("next_billing_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("retailer_subscription_current_shop_unique")
      .on(t.shopId)
      .where(sql`${t.isCurrent}`),
    index("retailer_subscription_shop_idx").on(t.shopId),
    check(
      "retailer_subscription_terms_check",
      sql`${t.currency} = 'BDT' AND NOT ${t.autoRenew} AND ${t.nextBillingAt} IS NULL AND ((${t.planCode} = 'free' AND ${t.durationMonths} IS NULL AND ${t.amountMinor} = 0 AND ${t.expiresAt} IS NULL AND ${t.purchaseId} IS NULL) OR (${t.planCode} <> 'free' AND ${t.durationMonths} IS NOT NULL AND ${t.durationMonths} IN (1,6,12) AND ${t.amountMinor} > 0 AND ${t.expiresAt} IS NOT NULL AND ${t.expiresAt} > ${t.startsAt} AND ${t.purchaseId} IS NOT NULL))`,
    ),
  ],
);
