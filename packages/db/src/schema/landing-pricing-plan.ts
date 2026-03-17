import {
    boolean,
    integer,
    json,
    pgTable,
    serial,
    text,
    timestamp,
} from "drizzle-orm/pg-core";

/**
 * Landing Pricing Plan — existing legacy table, kept to prevent Drizzle
 * from dropping it during push.
 */
export const landingPricingPlan = pgTable("landing_pricing_plan", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    subtitle: text("subtitle"),
    priceMonthly: integer("price_monthly").notNull(),
    priceYearly: integer("price_yearly"),
    features: json("features").default([]),
    isPopular: boolean("is_popular").default(false),
    ctaText: text("cta_text").default("Choose Plan"),
    sortOrder: integer("sort_order").default(0),
    active: boolean("active").default(true),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
});
