import { relations } from "drizzle-orm";
import {
    boolean,
    decimal,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { category, subCategory } from "./category";
import { brand } from "./brand";

// === Enums ===

export const brandSupportEnum = pgEnum("brand_support", [
    "multi_brand",
    "single_brand",
]);

export const coreProductStatusEnum = pgEnum("core_product_status", [
    "active",
    "draft",
    "inactive",
]);

// === Core Product Identity ===

/**
 * Core Product Identity — admin-controlled global product catalog.
 *
 * This is the canonical product definition that all sellers must follow.
 * Admin creates these as the "master product list" and sellers can only
 * list variants/stock against existing Core Identities.
 *
 * Hierarchy: Type → Category → SubCategory → Core Product Identity
 */
export const coreProductIdentity = pgTable("core_product_identity", {
    id: serial("id").primaryKey(),

    /** Admin-assigned SKU identifier (e.g. "001", "002") */
    sku: varchar("sku", { length: 20 }).notNull().unique(),

    /** Global product name (e.g. "Miniket Rice") — must be unique */
    name: varchar("name", { length: 150 }).notNull().unique(),

    /** URL-friendly slug */
    slug: varchar("slug", { length: 150 }).notNull().unique(),

    /** Optional description */
    description: text("description"),

    /** Representative product image */
    image: varchar("image", { length: 255 }).notNull(),

    /** Parent category */
    categoryId: integer("category_id")
        .notNull()
        .references(() => category.id, { onDelete: "restrict" }),

    /** Optional sub-category */
    subCategoryId: integer("sub_category_id").references(
        () => subCategory.id,
        { onDelete: "set null" },
    ),

    /** Whether this product supports multiple brands or just one */
    brandSupport: brandSupportEnum("brand_support")
        .default("multi_brand")
        .notNull(),

    /** Whether pack-based variants are supported (e.g. 1KG, 5KG) */
    variantSupportPack: boolean("variant_support_pack")
        .default(true)
        .notNull(),

    /** Whether loose/weight-based variants are supported */
    variantSupportLoose: boolean("variant_support_loose")
        .default(false)
        .notNull(),

    /** Default unit for loose variants (e.g. "KG", "LTR") */
    defaultLooseUnit: varchar("default_loose_unit", { length: 20 }),

    /** Product status */
    status: coreProductStatusEnum("status").default("active").notNull(),

    /** Display order for sorting */
    displayOrder: integer("display_order").default(0).notNull(),

    ...timestamps,
});

// === Core Product Brand (Many-to-Many) ===

/**
 * Links which brands are allowed/associated with a Core Product Identity.
 * E.g. "Miniket Rice" → ACI, PRAN, Radhuni, Local
 */
export const coreProductBrand = pgTable("core_product_brand", {
    id: serial("id").primaryKey(),

    /** Parent core product identity */
    coreProductId: integer("core_product_id")
        .notNull()
        .references(() => coreProductIdentity.id, { onDelete: "cascade" }),

    /** Linked brand */
    brandId: integer("brand_id")
        .notNull()
        .references(() => brand.id, { onDelete: "cascade" }),

    /** Whether this is the default brand */
    isDefault: boolean("is_default").default(false).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
});

// === Core Product Pack Variant (Admin-Defined Templates) ===

/**
 * Defines the allowed pack sizes/templates for a Core Product Identity.
 * E.g. "Miniket Rice" → 1KG Pack, 2KG Pack, 5KG Pack
 *
 * Sellers can only create variants matching these templates.
 */
export const coreProductPackVariant = pgTable("core_product_pack_variant", {
    id: serial("id").primaryKey(),

    /** Parent core product identity */
    coreProductId: integer("core_product_id")
        .notNull()
        .references(() => coreProductIdentity.id, { onDelete: "cascade" }),

    /** Display label (e.g. "1KG", "5KG Pack", "50KG Sack") */
    label: varchar("label", { length: 100 }).notNull(),

    /** Weight in KG */
    weightKg: decimal("weight_kg", { precision: 10, scale: 2 }).notNull(),

    /** Pack type */
    packType: varchar("pack_type", { length: 20 }).notNull(),

    /** Sell unit label (e.g. "Pack", "Sack", "KG") */
    sellUnit: varchar("sell_unit", { length: 50 }),

    /** Sort order */
    sortOrder: integer("sort_order").default(0).notNull(),

    /** Whether this template is active */
    isActive: boolean("is_active").default(true).notNull(),

    ...timestamps,
});

// === Relations ===

export const coreProductIdentityRelations = relations(
    coreProductIdentity,
    ({ one, many }) => ({
        category: one(category, {
            fields: [coreProductIdentity.categoryId],
            references: [category.id],
        }),
        subCategory: one(subCategory, {
            fields: [coreProductIdentity.subCategoryId],
            references: [subCategory.id],
        }),
        brands: many(coreProductBrand),
        packVariants: many(coreProductPackVariant),
    }),
);

export const coreProductBrandRelations = relations(
    coreProductBrand,
    ({ one }) => ({
        coreProduct: one(coreProductIdentity, {
            fields: [coreProductBrand.coreProductId],
            references: [coreProductIdentity.id],
        }),
        brand: one(brand, {
            fields: [coreProductBrand.brandId],
            references: [brand.id],
        }),
    }),
);

export const coreProductPackVariantRelations = relations(
    coreProductPackVariant,
    ({ one }) => ({
        coreProduct: one(coreProductIdentity, {
            fields: [coreProductPackVariant.coreProductId],
            references: [coreProductIdentity.id],
        }),
    }),
);

// === Types ===

export type CoreProductIdentity = typeof coreProductIdentity.$inferSelect;
export type NewCoreProductIdentity = typeof coreProductIdentity.$inferInsert;
export type CoreProductBrand = typeof coreProductBrand.$inferSelect;
export type NewCoreProductBrand = typeof coreProductBrand.$inferInsert;
export type CoreProductPackVariant = typeof coreProductPackVariant.$inferSelect;
export type NewCoreProductPackVariant = typeof coreProductPackVariant.$inferInsert;
