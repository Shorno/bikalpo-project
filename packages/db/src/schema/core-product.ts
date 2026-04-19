import { relations } from "drizzle-orm";
import {
    boolean,
    integer,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { category, subCategory } from "./category";

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

    /** Auto-generated SKU code (e.g. "001", "002") — unique within subcategory scope */
    sku: varchar("sku", { length: 20 }).notNull(),

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

    /** Whether this core product supports pack-based variants (e.g. 1KG Pack, 5KG Sack) */
    supportsPack: boolean("supports_pack").default(true).notNull(),

    /** Whether this core product supports loose variants (e.g. per KG, per Piece) */
    supportsLoose: boolean("supports_loose").default(false).notNull(),

    ...timestamps,
});

// === Relations ===

export const coreProductIdentityRelations = relations(
    coreProductIdentity,
    ({ one }) => ({
        category: one(category, {
            fields: [coreProductIdentity.categoryId],
            references: [category.id],
        }),
        subCategory: one(subCategory, {
            fields: [coreProductIdentity.subCategoryId],
            references: [subCategory.id],
        }),
    }),
);

// === Types ===

export type CoreProductIdentity = typeof coreProductIdentity.$inferSelect;
export type NewCoreProductIdentity = typeof coreProductIdentity.$inferInsert;
