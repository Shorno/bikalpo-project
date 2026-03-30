import { relations } from "drizzle-orm";
import {
    boolean,
    date,
    decimal,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";
import { expenseCategory } from "./expense-category";
import { payee } from "./payee";

/** Payment method for expenses */
export const expensePaymentMethodEnum = pgEnum("expense_payment_method", [
    "cash",
    "bank",
    "mobile_banking",
]);

/** Owner type — which entity created this expense */
export const ownerTypeEnum = pgEnum("owner_type", [
    "warehouse",
    "shop",
    "restaurant",
]);

/**
 * Expense — a PAID bill/expense record.
 *
 * CORE PRINCIPLE: Every expense is immediately paid. No pending, no unpaid.
 * Status is always "paid". No edit after save — only void + adjustment entry.
 */
export const expense = pgTable(
    "expense",
    {
        id: serial("id").primaryKey(),

        /** Auto-generated: EXP-20260331-001 */
        expenseNumber: varchar("expense_number", { length: 30 }).notNull().unique(),

        /** Expense title / description */
        title: varchar("title", { length: 200 }).notNull(),

        /** Which expense category */
        categoryId: integer("category_id")
            .notNull()
            .references(() => expenseCategory.id, { onDelete: "restrict" }),

        /** Optional payee — who was paid */
        payeeId: integer("payee_id")
            .references(() => payee.id, { onDelete: "set null" }),

        /** Amount paid (always positive) */
        amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

        /** Date of payment (defaults to today) */
        paymentDate: date("payment_date").notNull(),

        /** How was this paid */
        paymentMethod: expensePaymentMethodEnum("payment_method").notNull(),

        /** Optional bank/mobile reference number */
        referenceNo: varchar("reference_no", { length: 100 }),

        /** Bill copy / receipt (cloudinary URL) */
        attachment: text("attachment"),

        /** Any notes */
        note: text("note"),

        /** Who created this expense */
        ownerId: text("owner_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** What type of entity owns this expense */
        ownerType: ownerTypeEnum("owner_type").notNull(),

        /** Voided expenses are kept for audit but excluded from reports */
        isVoided: boolean("is_voided").default(false).notNull(),

        /** Void reason (required when voiding) */
        voidReason: text("void_reason"),

        ...timestamps,
    },
    (table) => [
        index("expense_ownerId_idx").on(table.ownerId),
        index("expense_categoryId_idx").on(table.categoryId),
        index("expense_paymentDate_idx").on(table.paymentDate),
        index("expense_ownerType_idx").on(table.ownerType),
    ],
);

export const expenseRelations = relations(expense, ({ one }) => ({
    category: one(expenseCategory, {
        fields: [expense.categoryId],
        references: [expenseCategory.id],
    }),
    payeeRef: one(payee, {
        fields: [expense.payeeId],
        references: [payee.id],
    }),
    owner: one(user, {
        fields: [expense.ownerId],
        references: [user.id],
    }),
}));

export type Expense = typeof expense.$inferSelect;
export type NewExpense = typeof expense.$inferInsert;
