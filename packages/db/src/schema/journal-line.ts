import { relations } from "drizzle-orm";
import {
  decimal,
  index,
  integer,
  pgTable,
  serial,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { financeAccount } from "./finance-account";
import {
  financeAccountTypeEnum,
  financeNormalBalanceEnum,
} from "./finance-category";
import { journalEntry } from "./journal-entry";

export const journalLine = pgTable(
  "journal_line",
  {
    id: serial("id").primaryKey(),
    journalEntryId: integer("journal_entry_id")
      .notNull()
      .references(() => journalEntry.id, { onDelete: "cascade" }),
    financeAccountId: integer("finance_account_id")
      .notNull()
      .references(() => financeAccount.id, { onDelete: "restrict" }),
    accountCode: varchar("account_code", { length: 80 }).notNull(),
    accountName: varchar("account_name", { length: 180 }).notNull(),
    accountType: financeAccountTypeEnum("account_type").notNull(),
    normalBalance: financeNormalBalanceEnum("normal_balance").notNull(),
    debit: decimal("debit", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    credit: decimal("credit", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    memo: text("memo"),
    lineOrder: integer("line_order").default(0).notNull(),
  },
  (table) => [
    index("journalLine_entry_idx").on(table.journalEntryId),
    index("journalLine_account_idx").on(table.financeAccountId),
    index("journalLine_accountCode_idx").on(table.accountCode),
    index("journalLine_accountType_idx").on(table.accountType),
  ],
);

export const journalLineRelations = relations(journalLine, ({ one }) => ({
  account: one(financeAccount, {
    fields: [journalLine.financeAccountId],
    references: [financeAccount.id],
  }),
  journalEntry: one(journalEntry, {
    fields: [journalLine.journalEntryId],
    references: [journalEntry.id],
  }),
}));

export type JournalLine = typeof journalLine.$inferSelect;
export type NewJournalLine = typeof journalLine.$inferInsert;
