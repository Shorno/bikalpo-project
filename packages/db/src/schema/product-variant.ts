import { relations } from "drizzle-orm";
import {
    decimal,
    integer,
    jsonb,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { product } from "./product";

/** Quantity selector option: e.g. { value: 1, unit: "kg", label: "Per Unit - 1 kg" } */
export type QuantitySelectorOption = {
    value: number;
    unit: string;
    label?: string;
};

/** Bulk rate tier: price depends on total quantity in order (e.g. minKg 100, maxKg 500, pricePerKg 50) */
export type BulkRateTier = {
    minKg?: number;
    maxKg?: number;
    pricePerKg?: string;
    priceTotal?: string;
};

/**
 * One flexible variant table. Each product can have many variants (e.g. 50kg Sack, 25kg Carton).
 * Order rules, quantity selector, pricing type, care, and note live inside the variant.
 * No category-specific columns — same structure for all products.
 */
export const productVariant = pgTable("product_variant", {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
        .notNull()
        .references(() => product.id, { onDelete: "cascade" }),

    sku: varchar("sku", { length: 100 }),
    unitLabel: varchar("unit_label", { length: 50 }).notNull(), // e.g. "Sack", "Carton", "kg"
    quantitySelectorLabel: varchar("quantity_selector_label", { length: 100 }), // e.g. "Sack (50 kg)" — optional when using quantitySelectorOptions
    packagingType: varchar("packaging_type", { length: 20 }).notNull(), // "loose" | "carton" — flexible for future types

    weightKg: decimal("weight_kg", { precision: 10, scale: 2 }).notNull(), // For loose: per-unit weight; for carton: total weight per unit
    pieceWeightKg: decimal("piece_weight_kg", { precision: 10, scale: 2 }), // For carton: weight per piece
    piecesPerUnit: integer("pieces_per_unit"), // For carton: e.g. 10 pieces per carton

    // Pricing: "per_unit" = price per 1 unit (e.g. per 1 kg); "bulk_rate" = price depends on total quantity (use priceTiers)
    pricingType: varchar("pricing_type", { length: 20 })
        .default("per_unit")
        .notNull(), // "per_unit" | "bulk_rate"
    price: decimal("price", { precision: 10, scale: 2 }).notNull(), // For per_unit: price per 1 unit; for bulk_rate: default or fallback
    priceTiers: jsonb("price_tiers").$type<BulkRateTier[]>().default([]), // For bulk_rate: e.g. [{ minKg: 100, maxKg: 500, pricePerKg: "50" }]

    // Order rules: Min / Max / Increment + unit (e.g. Min 100 kg, Max 1000 kg, Increment 1 kg)
    orderMin: decimal("order_min", { precision: 12, scale: 2 })
        .default("1")
        .notNull(),
    orderMax: decimal("order_max", { precision: 12, scale: 2 }), // null = no max
    orderIncrement: decimal("order_increment", { precision: 12, scale: 2 })
        .default("1")
        .notNull(),
    orderUnit: varchar("order_unit", { length: 20 }).default("piece").notNull(), // e.g. "piece", "kg"

    // Quantity selector: list of options shown to customer (e.g. "Per Unit - 1 kg", "2 kg", "5 kg", "10 kg", "20 kg")
    quantitySelectorOptions: jsonb("quantity_selector_options")
        .$type<QuantitySelectorOption[]>()
        .default([]),

    stockQuantity: integer("stock_quantity").default(0).notNull(),
    reorderLevel: integer("reorder_level").default(0).notNull(),

    // Optional product-details (origin, shelf life, packaging note)
    origin: varchar("origin", { length: 100 }),
    shelfLife: varchar("shelf_life", { length: 50 }),
    packagingNote: text("packaging_note"),

    // Care (e.g. "No Care") and note (e.g. delivery note shown at checkout)
    care: varchar("care", { length: 100 }),
    note: text("note"),

    sortOrder: integer("sort_order").default(0).notNull(),

    ...timestamps,
});

export const productVariantRelations = relations(productVariant, ({ one }) => ({
    product: one(product, {
        fields: [productVariant.productId],
        references: [product.id],
    }),
}));

export type ProductVariant = typeof productVariant.$inferSelect;
export type NewProductVariant = typeof productVariant.$inferInsert;
