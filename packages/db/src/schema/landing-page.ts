import { boolean, integer, json, pgTable, serial, text } from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";

// ─── Pricing / Subscription Plans ────────────────────────────────────────────
export const landingPricingPlan = pgTable("landing_pricing_plan", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(), // "Basic", "Standard", "Premium"
    subtitle: text("subtitle"), // "For small businesses starting out."
    priceMonthly: integer("price_monthly").notNull(), // in BDT
    priceYearly: integer("price_yearly"), // optional yearly price
    features: json("features").$type<string[]>().default([]), // ["5 Team Members", "Basic POS", ...]
    isPopular: boolean("is_popular").default(false), // highlights "MOST POPULAR" badge
    ctaText: text("cta_text").default("Choose Plan"), // button text
    sortOrder: integer("sort_order").default(0),
    active: boolean("active").default(true),
    ...timestamps,
});

export type LandingPricingPlan = typeof landingPricingPlan.$inferSelect;
export type NewLandingPricingPlan = typeof landingPricingPlan.$inferInsert;
