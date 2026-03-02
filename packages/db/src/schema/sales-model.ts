import { relations } from "drizzle-orm";
import {
    boolean,
    index,
    integer,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { product } from "./product";

/**
 * Sales models — groups of products that can be assigned to shop owners.
 * Admin creates models (e.g. "Rice & Grain", "Oil & Spices") and assigns them to shops.
 * Shop owners can only sell products within their assigned model(s).
 */
export const salesModel = pgTable("sales_model", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 150 }).notNull().unique(),
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
});

/**
 * Product-to-model mapping — which products belong to which sales model.
 */
export const salesModelProduct = pgTable(
    "sales_model_product",
    {
        id: serial("id").primaryKey(),
        salesModelId: integer("sales_model_id")
            .notNull()
            .references(() => salesModel.id, { onDelete: "cascade" }),
        productId: integer("product_id")
            .notNull()
            .references(() => product.id, { onDelete: "cascade" }),
        ...timestamps,
    },
    (table) => [
        index("modelProduct_model_idx").on(table.salesModelId),
        index("modelProduct_product_idx").on(table.productId),
    ],
);

/**
 * Shop-to-model assignment — which models are assigned to which shop owners.
 * A shop can have multiple models. They can only sell products within their assigned models.
 */
export const shopModelAssignment = pgTable(
    "shop_model_assignment",
    {
        id: serial("id").primaryKey(),

        /** Shop owner user ID */
        shopOwnerId: text("shop_owner_id").notNull(),

        /** Assigned sales model */
        salesModelId: integer("sales_model_id")
            .notNull()
            .references(() => salesModel.id, { onDelete: "cascade" }),

        isActive: boolean("is_active").default(true).notNull(),
        ...timestamps,
    },
    (table) => [
        index("shopModel_shop_idx").on(table.shopOwnerId),
        index("shopModel_model_idx").on(table.salesModelId),
    ],
);

// Relations
export const salesModelRelations = relations(salesModel, ({ many }) => ({
    products: many(salesModelProduct),
    shopAssignments: many(shopModelAssignment),
}));

export const salesModelProductRelations = relations(
    salesModelProduct,
    ({ one }) => ({
        salesModel: one(salesModel, {
            fields: [salesModelProduct.salesModelId],
            references: [salesModel.id],
        }),
        product: one(product, {
            fields: [salesModelProduct.productId],
            references: [product.id],
        }),
    }),
);

export const shopModelAssignmentRelations = relations(
    shopModelAssignment,
    ({ one }) => ({
        salesModel: one(salesModel, {
            fields: [shopModelAssignment.salesModelId],
            references: [salesModel.id],
        }),
    }),
);

export type SalesModel = typeof salesModel.$inferSelect;
export type NewSalesModel = typeof salesModel.$inferInsert;
export type SalesModelProduct = typeof salesModelProduct.$inferSelect;
export type ShopModelAssignment = typeof shopModelAssignment.$inferSelect;
