import { relations } from "drizzle-orm";
import {
    boolean,
    decimal,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { brand } from "./brand";
import { product } from "./product";
import { productVariantPrice } from "./product";
import { variantOption } from "./variant-option";

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

// === B2B + B2C Enums ===

/** Variant type: TRADE (B2B wholesale) or RETAIL (B2C consumer) */
export const variantTypeEnum = pgEnum("variant_type", ["trade", "retail"]);

/** Pack type for the variant */
export const packTypeEnum = pgEnum("pack_type", [
    "sack",
    "carton",
    "packet",
    "loose",
    "bottle",
    "can",
    "jar",
    "pouch",
    "box",
]);

/** Order type this variant supports */
export const orderTypeEnum = pgEnum("variant_order_type", ["b2b", "b2c"]);

/** Which role can see this variant */
export const visibilityRoleEnum = pgEnum("visibility_role", [
    "shop_owner",
    "consumer",
    "all",
]);

/**
 * One flexible variant table. Each product can have many variants (e.g. 50kg Sack, 25kg Carton).
 * Extended with B2B+B2C variant type, pack structure, visibility, conversion links, and open order config.
 */
export const productVariant = pgTable("product_variant", {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
        .notNull()
        .references(() => product.id, { onDelete: "cascade" }),

    sku: varchar("sku", { length: 100 }),
    unitLabel: varchar("unit_label", { length: 50 }).notNull(), // e.g. "Sack", "Carton", "kg"
    quantitySelectorLabel: varchar("quantity_selector_label", { length: 100 }),
    packagingType: varchar("packaging_type", { length: 20 }).notNull(), // legacy compat — "loose" | "carton" etc

    weightKg: decimal("weight_kg", { precision: 10, scale: 2 }).notNull(),
    pieceWeightKg: decimal("piece_weight_kg", { precision: 10, scale: 2 }),
    piecesPerUnit: integer("pieces_per_unit"),

    // Pricing: "per_unit" = price per 1 unit; "bulk_rate" = price depends on total quantity
    pricingType: varchar("pricing_type", { length: 20 })
        .default("per_unit")
        .notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(), // base_price (Admin controlled)
    priceTiers: jsonb("price_tiers").$type<BulkRateTier[]>().default([]),

    // Order rules
    orderMin: decimal("order_min", { precision: 12, scale: 2 })
        .default("1")
        .notNull(),
    orderMax: decimal("order_max", { precision: 12, scale: 2 }),
    orderIncrement: decimal("order_increment", { precision: 12, scale: 2 })
        .default("1")
        .notNull(),
    orderUnit: varchar("order_unit", { length: 20 }).default("piece").notNull(),

    // Quantity selector options
    quantitySelectorOptions: jsonb("quantity_selector_options")
        .$type<QuantitySelectorOption[]>()
        .default([]),

    stockQuantity: integer("stock_quantity").default(0).notNull(),
    reorderLevel: integer("reorder_level").default(0).notNull(),

    // Product details
    origin: varchar("origin", { length: 100 }),
    shelfLife: varchar("shelf_life", { length: 50 }),
    packagingNote: text("packaging_note"),
    care: varchar("care", { length: 100 }),
    note: text("note"),
    sortOrder: integer("sort_order").default(0).notNull(),

    // === Variant-Level Identity Fields ===

    /** Brand for this variant (e.g. Ifad, Fresh, Teer) — enables same product with multiple brands */
    brandId: integer("brand_id").references(() => brand.id, { onDelete: "set null" }),

    /** Color attribute for fashion variants (e.g. "Black", "Red") */
    color: varchar("color", { length: 50 }),

    /** Size attribute for fashion variants (e.g. "S", "M", "L", "XL") */
    size: varchar("size", { length: 50 }),

    // === B2B + B2C Fields ===

    /** TRADE (B2B wholesale) or RETAIL (B2C consumer) — null for legacy variants */
    variantType: variantTypeEnum("variant_type"),

    /** Pack type: sack, carton, packet, loose, etc. */
    packType: packTypeEnum("pack_type"),

    /** Total pack weight in kg (e.g. 50 for a 50kg sack) */
    packWeightKg: decimal("pack_weight_kg", { precision: 10, scale: 2 }),

    /** Weight per inner pack in kg (e.g. 5kg for carton with 10×5kg packs) */
    innerPackSizeKg: decimal("inner_pack_size_kg", { precision: 10, scale: 2 }),

    /** Number of inner packs (e.g. 10 packs inside a carton) */
    packCountInside: integer("pack_count_inside"),

    /** Sell unit label (e.g. "Sack", "Carton", "Packet", "KG") */
    sellUnit: varchar("sell_unit", { length: 50 }),

    /** Order type: B2B or B2C */
    orderType: orderTypeEnum("order_type"),

    /** Which role can see this variant: shop_owner, consumer, or all */
    visibilityRole: visibilityRoleEnum("visibility_role").default("all"),

    /** Stock source for this variant: where does inventory come from */
    stockSource: varchar("stock_source", { length: 20 }), // "super_seller" | "shop"

    /** Delivery type link */
    deliveryType: varchar("delivery_type", { length: 50 }),
    deliveryRuleId: integer("delivery_rule_id"),

    /** Linked retail variant for auto-conversion (TRADE variant → RETAIL variant) */
    linkedRetailVariantId: integer("linked_retail_variant_id"),

    /** Conversion ratio: 1 trade unit = X retail units (e.g. 1 carton = 10 packs) */
    conversionRatio: decimal("conversion_ratio", { precision: 10, scale: 2 }),

    /** Conversion loss percentage (e.g. 2% loss during conversion) */
    conversionLossPercent: decimal("conversion_loss_percent", {
        precision: 5,
        scale: 2,
    }).default("0"),

    /** Whether open orders are allowed for this variant */
    isOpenOrderAllowed: boolean("is_open_order_allowed").default(false),

    /** Negotiation timeout in seconds for open orders (default 100) */
    negotiationTimeoutSec: integer("negotiation_timeout_sec").default(100),

    /** Whether pack return is required for this variant */
    isPackReturnRequired: boolean("is_pack_return_required").default(false),

    /** Pack deposit amount when consumer doesn't have old pack */
    packDepositAmount: decimal("pack_deposit_amount", {
        precision: 10,
        scale: 2,
    }).default("0"),

    /** Minimum margin percent — shop price must be >= base_price + margin */
    minMarginPercent: decimal("min_margin_percent", {
        precision: 5,
        scale: 2,
    }),

    /** Minimum margin fixed amount */
    minMarginAmount: decimal("min_margin_amount", {
        precision: 10,
        scale: 2,
    }),

    /** Variant active/inactive */
    isActive: boolean("is_active").default(true).notNull(),

    // === Bridge: back-references to new global variant system ===

    /** FK → product_variant_price that generated this row (null for legacy manual variants) */
    sourceVariantPriceId: integer("source_variant_price_id")
        .references(() => productVariantPrice.id, { onDelete: "set null" }),

    /** FK → global variant_option this row was generated from */
    sourceVariantOptionId: integer("source_variant_option_id")
        .references(() => variantOption.id, { onDelete: "set null" }),

    ...timestamps,
});

export const productVariantRelations = relations(productVariant, ({ one }) => ({
    product: one(product, {
        fields: [productVariant.productId],
        references: [product.id],
    }),
    brand: one(brand, {
        fields: [productVariant.brandId],
        references: [brand.id],
    }),
    // Self-referencing: linked retail variant for conversion
    linkedRetailVariant: one(productVariant, {
        fields: [productVariant.linkedRetailVariantId],
        references: [productVariant.id],
        relationName: "tradeToRetail",
    }),
    // Source variant option from global catalog (e.g. "12KG Cylinder")
    sourceVariantOption: one(variantOption, {
        fields: [productVariant.sourceVariantOptionId],
        references: [variantOption.id],
    }),
}));

export type ProductVariant = typeof productVariant.$inferSelect;
export type NewProductVariant = typeof productVariant.$inferInsert;
