import { relations } from "drizzle-orm";
import {
    decimal,
    integer,
    jsonb,
    pgTable,
    serial,
    text,
    timestamp,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { brand } from "./brand";
import { category, subCategory } from "./category";

// Type for product features
export type ProductFeatureItem = {
    key: string;
    value: string;
};

export type ProductFeatureGroup = {
    title: string;
    items: ProductFeatureItem[];
};

export const product = pgTable("product", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 150 }).notNull().unique(),
    description: text("description"),
    categoryId: integer("category_id")
        .notNull()
        .references(() => category.id, { onDelete: "cascade" }),
    subCategoryId: integer("sub_category_id").references(() => subCategory.id, {
        onDelete: "set null",
    }),
    brandId: integer("brand_id").references(() => brand.id, {
        onDelete: "set null",
    }),

    size: varchar("size", { length: 50 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),

    stockQuantity: integer("stock_quantity").default(0).notNull(),
    reorderLevel: integer("reorder_level").default(0).notNull(),
    sku: varchar("sku", { length: 100 }),
    supplier: text("supplier"),
    lastRestockedAt: timestamp("last_restocked_at"),

    image: varchar("image", { length: 255 }).notNull(),

    // Product features stored as JSONB
    features: jsonb("features").$type<ProductFeatureGroup[]>().default([]),

    inStock: boolean("in_stock").default(true).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),

    ...timestamps,
});

import { boolean } from "drizzle-orm/pg-core";

export const productImage = pgTable("product_image", {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
        .notNull()
        .references(() => product.id, { onDelete: "cascade" }),
    imageUrl: varchar("image_url", { length: 255 }).notNull(),
    ...timestamps,
});

export const productRelations = relations(product, ({ one, many }) => ({
    category: one(category, {
        fields: [product.categoryId],
        references: [category.id],
    }),
    subCategory: one(subCategory, {
        fields: [product.subCategoryId],
        references: [subCategory.id],
    }),
    brand: one(brand, {
        fields: [product.brandId],
        references: [brand.id],
    }),
    images: many(productImage),
}));

export const productImageRelations = relations(productImage, ({ one }) => ({
    product: one(product, {
        fields: [productImage.productId],
        references: [product.id],
    }),
}));

export type Product = typeof product.$inferSelect;
export type ProductImage = typeof productImage.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type NewProductImage = typeof productImage.$inferInsert;

export interface ProductWithRelations extends Product {
    category: {
        name: string;
        slug: string;
    };
    subCategory?: {
        name: string;
    } | null;
    brand?: {
        id: number;
        name: string;
        slug: string;
        logo: string;
    } | null;
    images?: ProductImage[];
}
