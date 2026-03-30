import { relations } from "drizzle-orm";
import {
    decimal,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/** Type of financial entry */
export const financialLedgerEntryTypeEnum = pgEnum("financial_ledger_entry_type", [
    "expense",
    "purchase_cash",
    "purchase_credit",
    "supplier_payment",
    "sale",
    "adjustment",
]);

/** Direction of the transaction */
export const financialLedgerDirectionEnum = pgEnum("financial_ledger_direction", [
    "debit",
    "credit",
]);

/** What the entry references */
export const financialLedgerRefTypeEnum = pgEnum("financial_ledger_ref_type", [
    "expense",
    "purchase",
    "supplier_payment",
    "order",
    "adjustment",
]);

/** Owner type for ledger entries */
export const ledgerOwnerTypeEnum = pgEnum("ledger_owner_type", [
    "warehouse",
    "shop",
    "restaurant",
]);

/**
 * Financial Ledger — immutable record of all financial movements.
 *
 * Every expense, purchase, supplier payment, and sale creates a ledger entry.
 * Entries are NEVER updated or deleted — only new adjustment entries are created.
 */
export const financialLedger = pgTable(
    "financial_ledger",
    {
        id: serial("id").primaryKey(),

        /** What type of financial event */
        entryType: financialLedgerEntryTypeEnum("entry_type").notNull(),

        /** Amount (always positive) */
        amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

        /** Debit = money going out, Credit = money coming in */
        direction: financialLedgerDirectionEnum("direction").notNull(),

        /** Running balance snapshots */
        balanceBefore: decimal("balance_before", { precision: 14, scale: 2 }),
        balanceAfter: decimal("balance_after", { precision: 14, scale: 2 }),

        /** What this entry references */
        referenceType: financialLedgerRefTypeEnum("reference_type").notNull(),
        referenceId: integer("reference_id").notNull(),

        /** Human-readable description */
        description: text("description"),

        /** Who owns this ledger entry */
        ownerId: text("owner_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        ownerType: ledgerOwnerTypeEnum("owner_type").notNull(),

        /** Immutable timestamp — no updatedAt */
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("financialLedger_ownerId_idx").on(table.ownerId),
        index("financialLedger_ownerType_idx").on(table.ownerType),
        index("financialLedger_entryType_idx").on(table.entryType),
        index("financialLedger_createdAt_idx").on(table.createdAt),
        index("financialLedger_ref_idx").on(table.referenceType, table.referenceId),
    ],
);

export const financialLedgerRelations = relations(financialLedger, ({ one }) => ({
    owner: one(user, {
        fields: [financialLedger.ownerId],
        references: [user.id],
    }),
}));

export type FinancialLedger = typeof financialLedger.$inferSelect;
export type NewFinancialLedger = typeof financialLedger.$inferInsert;
