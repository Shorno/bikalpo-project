import { relations } from "drizzle-orm";
import {
    boolean,
    index,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";

/**
 * Expense Category — predefined + user-custom categories for expense classification.
 *
 * System categories (isSystem=true): Electricity, Rent, Salary, Internet, Fuel, Maintenance, Transport, Miscellaneous
 * User categories (isSystem=false, ownerId set): custom categories added by individual users
 */
export const expenseCategory = pgTable(
    "expense_category",
    {
        id: serial("id").primaryKey(),
        name: varchar("name", { length: 100 }).notNull(),
        slug: varchar("slug", { length: 100 }).notNull(),

        /** System categories cannot be deleted */
        isSystem: boolean("is_system").default(false).notNull(),

        /** null = global/system category, set = user-specific custom category */
        ownerId: text("owner_id")
            .references(() => user.id, { onDelete: "cascade" }),

        ...timestamps,
    },
    (table) => [
        index("expenseCategory_ownerId_idx").on(table.ownerId),
        index("expenseCategory_slug_idx").on(table.slug),
    ],
);

export const expenseCategoryRelations = relations(expenseCategory, ({ one }) => ({
    owner: one(user, {
        fields: [expenseCategory.ownerId],
        references: [user.id],
    }),
}));

export type ExpenseCategory = typeof expenseCategory.$inferSelect;
export type NewExpenseCategory = typeof expenseCategory.$inferInsert;
