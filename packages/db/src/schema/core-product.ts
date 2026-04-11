import { relations } from "drizzle-orm";
import {
    boolean,
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
import { coreProductVariantOption } from "./variant-option";

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
        variantLinks: many(coreProductVariantOption),
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

// === Types ===

export type CoreProductIdentity = typeof coreProductIdentity.$inferSelect;
export type NewCoreProductIdentity = typeof coreProductIdentity.$inferInsert;
export type CoreProductBrand = typeof coreProductBrand.$inferSelect;
export type NewCoreProductBrand = typeof coreProductBrand.$inferInsert;
