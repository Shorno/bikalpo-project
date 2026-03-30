import { relations } from "drizzle-orm";
import {
    index,
    integer,
    pgTable,
    serial,
    text,
    uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";
import { category, subCategory } from "./category";

/**
 * Shop Category Assignment — tracks which categories/subcategories
 * a shop is allowed to order from.
 *
 * Assigned by admin based on the shop's businessType.
 * Used by the Category Matching Engine (Step 3) and
 * Product Visibility Rule (Step 4) in the order flow.
 */
export const shopCategoryAssignment = pgTable(
    "shop_category_assignment",
    {
        id: serial("id").primaryKey(),

        /** The shop user */
        shopId: text("shop_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** The category assigned */
        categoryId: integer("category_id")
            .notNull()
            .references(() => category.id, { onDelete: "cascade" }),

        /** Optional: specific subcategory (null = all subcategories of this category) */
        subcategoryId: integer("subcategory_id")
            .references(() => subCategory.id, { onDelete: "cascade" }),

        /** Admin who made the assignment */
        assignedBy: text("assigned_by")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        ...timestamps,
    },
    (table) => [
        index("sca_shopId_idx").on(table.shopId),
        index("sca_categoryId_idx").on(table.categoryId),
        uniqueIndex("sca_unique_idx").on(
            table.shopId,
            table.categoryId,
            table.subcategoryId,
        ),
    ],
);

export const shopCategoryAssignmentRelations = relations(
    shopCategoryAssignment,
    ({ one }) => ({
        shop: one(user, {
            fields: [shopCategoryAssignment.shopId],
            references: [user.id],
        }),
        category: one(category, {
            fields: [shopCategoryAssignment.categoryId],
            references: [category.id],
        }),
        subcategory: one(subCategory, {
            fields: [shopCategoryAssignment.subcategoryId],
            references: [subCategory.id],
        }),
        assignedByUser: one(user, {
            fields: [shopCategoryAssignment.assignedBy],
            references: [user.id],
        }),
    }),
);

export type ShopCategoryAssignment = typeof shopCategoryAssignment.$inferSelect;
export type NewShopCategoryAssignment = typeof shopCategoryAssignment.$inferInsert;
