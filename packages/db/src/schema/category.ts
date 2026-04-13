import { relations } from "drizzle-orm";
import {
    boolean,
    integer,
    pgTable,
    serial,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { productType } from "./product-type";

export const category = pgTable("category", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    image: varchar("image", { length: 255 }).notNull(),

    /** Parent product type (Type → Category → SubCategory) */
    typeId: integer("type_id").references(() => productType.id, {
        onDelete: "set null",
    }),

    /** Auto-generated 3-digit SKU code within its type (e.g. "001", "002"). Immutable after creation. */
    skuCode: varchar("sku_code", { length: 3 }),

    isActive: boolean("is_active").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    ...timestamps,
});

export const subCategory = pgTable("sub_category", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    categoryId: integer("category_id")
        .notNull()
        .references(() => category.id, { onDelete: "cascade" }),
    image: varchar("image", { length: 255 }).notNull(),

    /** Auto-generated 3-digit SKU code within its category (e.g. "001", "002"). Immutable after creation. */
    skuCode: varchar("sku_code", { length: 3 }),

    isActive: boolean("is_active").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    ...timestamps,
});

export const categoryRelations = relations(category, ({ one, many }) => ({
    type: one(productType, {
        fields: [category.typeId],
        references: [productType.id],
    }),
    subCategory: many(subCategory),
}));

export const subCategoryRelations = relations(subCategory, ({ one }) => ({
    category: one(category, {
        fields: [subCategory.categoryId],
        references: [category.id],
    }),
}));

export type Category = typeof category.$inferSelect;
export type SubCategory = typeof subCategory.$inferSelect;
