import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export type OfferTemplateProduct = {
  productId: number;
  variantId?: number;
  catalogVariantId?: number;
  name: string;
  variantName?: string;
  brandName?: string;
  sku?: string | null;
  category: string;
  regularPrice: string;
  quantity: number;
};

/**
 * Admin-owned offer structures. These records describe reusable rules only;
 * they are never applied directly to a basket or published as storefront offers.
 */
export const offerTemplate = pgTable(
  "offer_template",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 40 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 30 }).notNull(),
    comboRule: varchar("combo_rule", { length: 30 }),

    buyProducts: jsonb("buy_products")
      .$type<OfferTemplateProduct[]>()
      .default([])
      .notNull(),
    getProducts: jsonb("get_products")
      .$type<OfferTemplateProduct[]>()
      .default([])
      .notNull(),

    benefitType: varchar("benefit_type", { length: 40 }).notNull(),
    benefitValue: decimal("benefit_value", { precision: 12, scale: 2 }),

    applyOn: varchar("apply_on", { length: 30 }).default("product").notNull(),
    targetSelection: jsonb("target_selection")
      .$type<
        Array<{ id: number; label: string; kind: "product" | "category" }>
      >()
      .default([])
      .notNull(),
    targetRetailers: boolean("target_retailers").default(true).notNull(),
    targetWholesalers: boolean("target_wholesalers").default(true).notNull(),
    applyLocations: jsonb("apply_locations")
      .$type<
        Array<"all_stores" | "selected_stores" | "warehouse" | "online_store">
      >()
      .default(["all_stores"])
      .notNull(),

    minimumOrderAmount: decimal("minimum_order_amount", {
      precision: 12,
      scale: 2,
    })
      .default("0")
      .notNull(),
    maxUsePerOrder: integer("max_use_per_order").default(1).notNull(),
    maxUsePerCustomer: integer("max_use_per_customer").default(1).notNull(),
    totalUsageLimit: integer("total_usage_limit"),

    startDate: timestamp("start_date", { mode: "date" }),
    endDate: timestamp("end_date", { mode: "date" }),
    status: varchar("status", { length: 20 }).default("draft").notNull(),

    usedByCount: integer("used_by_count").default(0).notNull(),
    activeOffersCreated: integer("active_offers_created").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("offer_template_code_unique").on(table.code)],
);

export type OfferTemplate = typeof offerTemplate.$inferSelect;
export type NewOfferTemplate = typeof offerTemplate.$inferInsert;
