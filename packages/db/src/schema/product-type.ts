import { relations } from "drizzle-orm";
import {
    boolean,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { INVENTORY_BEHAVIOURS, type InventoryBehaviour } from "../fulfillment";
import { category } from "./category";
import { timestamps } from "./columns.helpers";
import { productTypeRuleSetting } from "./product-type-rule-setting";

/**
 * Inventory behaviour determines how stock flows from warehouse → shop.
 *
 * - auto_break:    Carton → automatically breaks into packs (e.g. 1 carton = 10 packs)
 * - loose_convert: Bulk bag/drum → converts to weight pool (e.g. 50kg sack → 50 KG loose)
 * - fixed_pack:    Same pack from warehouse to shop to consumer (e.g. 1kg Nescafe jar)
 */
export const inventoryBehaviourEnum = pgEnum("inventory_behaviour", [
    ...INVENTORY_BEHAVIOURS,
]);

/**
 * Product Type — the top-level product classification.
 *
 * Hierarchy: Type → Category → SubCategory
 *
 * The `inventoryBehaviour` field controls the stock conversion logic.
 */
export const productType = pgTable("product_type", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    description: text("description"),
    image: varchar("image", { length: 255 }),

    // Inventory behaviour for this product type
    inventoryBehaviour: inventoryBehaviourEnum("inventory_behaviour")
        .default("fixed_pack")
        .notNull(),

    /** Auto-generated 2-digit SKU code (e.g. "01", "02"). Immutable after creation. */
    skuCode: varchar("sku_code", { length: 2 }).unique(),

    isActive: boolean("is_active").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),

    ...timestamps,
});

export const productTypeRelations = relations(productType, ({ many, one }) => ({
    categories: many(category),
    ruleSettings: one(productTypeRuleSetting, {
        fields: [productType.id],
        references: [productTypeRuleSetting.productTypeId],
    }),
}));

export type ProductType = typeof productType.$inferSelect;
export type NewProductType = typeof productType.$inferInsert;
export type { InventoryBehaviour };
