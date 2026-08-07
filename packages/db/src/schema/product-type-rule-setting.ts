import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import type { FulfillmentUnitCode } from "../fulfillment";
import { productType } from "./product-type";
import { trackingTypeEnum } from "./tracking-type";

export type ProductRuleTrackingType = "none" | "batch" | "serial";

export const productTypeRuleSetting = pgTable("product_type_rule_setting", {
  id: serial("id").primaryKey(),
  productTypeId: integer("product_type_id")
    .notNull()
    .unique()
    .references(() => productType.id, { onDelete: "cascade" }),

  trackingTypes: jsonb("tracking_types")
    .$type<ProductRuleTrackingType[]>()
    .default(["none", "batch"])
    .notNull(),
  trackingAvailable: boolean("tracking_available").default(true).notNull(),
  defaultTrackingType: trackingTypeEnum("default_tracking_type")
    .default("none")
    .notNull(),

  returnPolicyAvailable: boolean("return_policy_available")
    .default(true)
    .notNull(),
  returnPolicyDefault: boolean("return_policy_default").default(true).notNull(),

  expiryAvailable: boolean("expiry_available").default(true).notNull(),
  expiryDefault: boolean("expiry_default").default(false).notNull(),

  damageAvailable: boolean("damage_available").default(true).notNull(),
  damageDefault: boolean("damage_default").default(true).notNull(),

  stockTrackingAvailable: boolean("stock_tracking_available")
    .default(true)
    .notNull(),
  stockTrackingDefault: boolean("stock_tracking_default")
    .default(true)
    .notNull(),

  minimumOrderAvailable: boolean("minimum_order_available")
    .default(true)
    .notNull(),
  minimumOrderDefault: boolean("minimum_order_default").default(true).notNull(),
  minimumOrderQtyDefault: decimal("minimum_order_qty_default", {
    precision: 12,
    scale: 2,
  })
    .default("1")
    .notNull(),

  conversionAvailable: boolean("conversion_available").default(true).notNull(),
  conversionDefault: boolean("conversion_default").default(false).notNull(),

  inventoryLooseUnitAvailable: boolean("inventory_loose_unit_available")
    .default(false)
    .notNull(),
  inventoryLooseUnitDefault: boolean("inventory_loose_unit_default")
    .default(false)
    .notNull(),
  inventoryLooseUnitOptions: jsonb("inventory_loose_unit_options")
    .$type<FulfillmentUnitCode[]>()
    .default(["kg"])
    .notNull(),
  defaultInventoryLooseUnit: varchar("default_inventory_loose_unit", {
    length: 20,
  })
    .$type<FulfillmentUnitCode>()
    .default("kg")
    .notNull(),

  returnablePackAvailable: boolean("returnable_pack_available")
    .default(true)
    .notNull(),
  returnablePackDefault: boolean("returnable_pack_default")
    .default(false)
    .notNull(),
  defaultPackDepositAmount: decimal("default_pack_deposit_amount", {
    precision: 10,
    scale: 2,
  }).default("0"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productTypeRuleSettingRelations = relations(
  productTypeRuleSetting,
  ({ one }) => ({
    productType: one(productType, {
      fields: [productTypeRuleSetting.productTypeId],
      references: [productType.id],
    }),
  }),
);

export type ProductTypeRuleSetting = typeof productTypeRuleSetting.$inferSelect;
export type NewProductTypeRuleSetting =
  typeof productTypeRuleSetting.$inferInsert;
