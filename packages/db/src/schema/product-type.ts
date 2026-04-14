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
import { timestamps } from "./columns.helpers";
import { category } from "./category";

/**
 * Inventory behaviour determines how stock flows from warehouse → shop.
 *
 * - auto_break:    Carton → automatically breaks into packs (e.g. 1 carton = 10 packs)
 * - loose_convert: Bulk bag/drum → converts to weight pool (e.g. 50kg sack → 50 KG loose)
 * - fixed_pack:    Same pack from warehouse to shop to consumer (e.g. 1kg Nescafe jar)
 */
export const inventoryBehaviourEnum = pgEnum("inventory_behaviour", [
    "auto_break",
    "loose_convert",
    "fixed_pack",
]);

/**
 * Product Type — the top-level product classification.
 *
 * Hierarchy: Type → Category → SubCategory
 *
 * Each type defines which product attributes are relevant:
 *   - Grocery: Brand ✓, Color ✗, Size ✓, Design ✗, Variant ✓
 *   - Fashion: Brand ✓, Color ✓, Size ✓, Design ✓, Variant ✓
 *
 * The `inventoryBehaviour` field controls the stock conversion logic.
 */
export const productType = pgTable("product_type", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    description: text("description"),
    image: varchar("image", { length: 255 }),

    // Dynamic attribute toggles — enable/disable per product type
    enableBrand: boolean("enable_brand").default(true).notNull(),
    enableColor: boolean("enable_color").default(false).notNull(),
    enableSize: boolean("enable_size").default(true).notNull(),
    enableDesign: boolean("enable_design").default(false).notNull(),
    enableVariant: boolean("enable_variant").default(true).notNull(),

    // Inventory behaviour for this product type
    inventoryBehaviour: inventoryBehaviourEnum("inventory_behaviour")
        .default("fixed_pack")
        .notNull(),

    isActive: boolean("is_active").default(true).notNull(),
    skuCode: varchar("sku_code", { length: 20 }),
    displayOrder: integer("display_order").default(0).notNull(),

    ...timestamps,
});

export const productTypeRelations = relations(productType, ({ many }) => ({
    categories: many(category),
}));

export type ProductType = typeof productType.$inferSelect;
export type NewProductType = typeof productType.$inferInsert;
