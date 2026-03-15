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
 * Warehouse Category Assignment — tracks which categories/subcategories
 * are assigned to each warehouse by admin.
 *
 * A warehouse can only add products from categories assigned to them.
 */
export const warehouseCategoryAssignment = pgTable(
    "warehouse_category_assignment",
    {
        id: serial("id").primaryKey(),

        /** The warehouse user */
        warehouseId: text("warehouse_id")
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
        index("wca_warehouseId_idx").on(table.warehouseId),
        index("wca_categoryId_idx").on(table.categoryId),
        uniqueIndex("wca_unique_idx").on(
            table.warehouseId,
            table.categoryId,
            table.subcategoryId,
        ),
    ],
);

export const warehouseCategoryAssignmentRelations = relations(
    warehouseCategoryAssignment,
    ({ one }) => ({
        warehouse: one(user, {
            fields: [warehouseCategoryAssignment.warehouseId],
            references: [user.id],
        }),
        category: one(category, {
            fields: [warehouseCategoryAssignment.categoryId],
            references: [category.id],
        }),
        subcategory: one(subCategory, {
            fields: [warehouseCategoryAssignment.subcategoryId],
            references: [subCategory.id],
        }),
        assignedByUser: one(user, {
            fields: [warehouseCategoryAssignment.assignedBy],
            references: [user.id],
        }),
    }),
);

export type WarehouseCategoryAssignment = typeof warehouseCategoryAssignment.$inferSelect;
export type NewWarehouseCategoryAssignment = typeof warehouseCategoryAssignment.$inferInsert;
