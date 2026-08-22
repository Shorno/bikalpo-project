import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";
import { category } from "./category";
import { type OfferTemplateProduct, offerTemplate } from "./offer-template";
import { order } from "./order";
import { product } from "./product";
import { productVariant } from "./product-variant";
import { warehousePosSale } from "./warehouse-pos";

export type RetailerOfferTemplateSnapshot = {
  code: string;
  name: string;
  description: string | null;
  type: string;
  comboRule: string | null;
  buyProducts: OfferTemplateProduct[];
  getProducts: OfferTemplateProduct[];
  benefitType: string;
  benefitValue: string | null;
  maxUsePerOrder?: number;
};

/**
 * A shop-owned, executable offer created from an Admin template. The snapshot
 * prevents later Admin edits from silently changing a published store offer.
 */
export const retailerOffer = pgTable(
  "retailer_offer",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 40 }).notNull(),
    shopId: text("shop_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    templateId: integer("template_id")
      .notNull()
      .references(() => offerTemplate.id, { onDelete: "restrict" }),
    templateSnapshot: jsonb("template_snapshot")
      .$type<RetailerOfferTemplateSnapshot>()
      .notNull(),

    name: varchar("name", { length: 255 }).notNull(),
    offerType: varchar("offer_type", { length: 30 }).notNull(),
    applyTo: varchar("apply_to", { length: 30 }).notNull(),
    productId: integer("product_id").references(() => product.id, {
      onDelete: "set null",
    }),
    variantId: integer("variant_id").references(() => productVariant.id, {
      onDelete: "set null",
    }),
    productName: varchar("product_name", { length: 255 }),
    variantName: varchar("variant_name", { length: 255 }),
    categoryId: integer("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    categoryName: varchar("category_name", { length: 255 }),

    discountType: varchar("discount_type", { length: 30 }).notNull(),
    discountValue: decimal("discount_value", { precision: 12, scale: 2 }),
    minimumQuantity: decimal("minimum_quantity", {
      precision: 12,
      scale: 2,
    })
      .default("1")
      .notNull(),
    maximumLimit: integer("maximum_limit"),

    startDate: timestamp("start_date", { mode: "date" }).notNull(),
    endDate: timestamp("end_date", { mode: "date" }).notNull(),
    allDay: boolean("all_day").default(true).notNull(),
    startTime: varchar("start_time", { length: 5 }),
    endTime: varchar("end_time", { length: 5 }),

    targetType: varchar("target_type", { length: 30 })
      .default("all_customers")
      .notNull(),
    targetCustomerKeys: jsonb("target_customer_keys")
      .$type<string[]>()
      .default([])
      .notNull(),
    targetAreaIds: jsonb("target_area_ids")
      .$type<number[]>()
      .default([])
      .notNull(),

    status: varchar("status", { length: 20 }).default("draft").notNull(),
    pausedAt: timestamp("paused_at", { mode: "date" }),
    deactivatedAt: timestamp("deactivated_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("retailer_offer_code_unique").on(table.code),
    index("retailer_offer_shop_status_idx").on(table.shopId, table.status),
    index("retailer_offer_shop_validity_idx").on(
      table.shopId,
      table.startDate,
      table.endDate,
    ),
    index("retailer_offer_template_idx").on(table.templateId),
    index("retailer_offer_variant_idx").on(table.variantId),
    check(
      "retailer_offer_valid_dates",
      sql`${table.endDate} > ${table.startDate}`,
    ),
  ],
);

/** One immutable attribution record per offer/transaction application. */
export const retailerOfferApplication = pgTable(
  "retailer_offer_application",
  {
    id: serial("id").primaryKey(),
    retailerOfferId: integer("retailer_offer_id")
      .notNull()
      .references(() => retailerOffer.id, { onDelete: "cascade" }),
    shopId: text("shop_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    posSaleId: integer("pos_sale_id").references(() => warehousePosSale.id, {
      onDelete: "cascade",
    }),
    orderId: integer("order_id").references(() => order.id, {
      onDelete: "cascade",
    }),
    customerKey: varchar("customer_key", { length: 255 }),
    discountAmount: decimal("discount_amount", {
      precision: 12,
      scale: 2,
    })
      .default("0")
      .notNull(),
    salesAmount: decimal("sales_amount", { precision: 12, scale: 2 })
      .default("0")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("retailer_offer_application_offer_idx").on(table.retailerOfferId),
    index("retailer_offer_application_shop_idx").on(table.shopId),
    index("retailer_offer_application_customer_idx").on(
      table.retailerOfferId,
      table.customerKey,
    ),
    uniqueIndex("retailer_offer_application_pos_unique")
      .on(table.retailerOfferId, table.posSaleId)
      .where(sql`${table.posSaleId} IS NOT NULL`),
    uniqueIndex("retailer_offer_application_order_unique")
      .on(table.retailerOfferId, table.orderId)
      .where(sql`${table.orderId} IS NOT NULL`),
    check(
      "retailer_offer_application_one_transaction",
      sql`num_nonnulls(${table.posSaleId}, ${table.orderId}) = 1`,
    ),
  ],
);

export const retailerOfferRelations = relations(
  retailerOffer,
  ({ one, many }) => ({
    shop: one(user, {
      fields: [retailerOffer.shopId],
      references: [user.id],
    }),
    template: one(offerTemplate, {
      fields: [retailerOffer.templateId],
      references: [offerTemplate.id],
    }),
    applications: many(retailerOfferApplication),
  }),
);

export const retailerOfferApplicationRelations = relations(
  retailerOfferApplication,
  ({ one }) => ({
    offer: one(retailerOffer, {
      fields: [retailerOfferApplication.retailerOfferId],
      references: [retailerOffer.id],
    }),
  }),
);

export type RetailerOffer = typeof retailerOffer.$inferSelect;
export type NewRetailerOffer = typeof retailerOffer.$inferInsert;
export type RetailerOfferApplication =
  typeof retailerOfferApplication.$inferSelect;
