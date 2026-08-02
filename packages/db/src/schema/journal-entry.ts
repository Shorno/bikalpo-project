import { relations } from "drizzle-orm";
import {
  date,
  index,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { ACCOUNTING_TRANSACTION_TYPES } from "../accounting";
import { user } from "./auth-schema";
import { timestamps } from "./columns.helpers";
import { financeOwnerTypeEnum } from "./finance-category";

export const journalTransactionTypeEnum = pgEnum(
  "journal_transaction_type",
  ACCOUNTING_TRANSACTION_TYPES,
);

export const journalSourceTypeEnum = pgEnum("journal_source_type", [
  "manual",
  "expense",
  "purchase",
  "order",
  "supplier_payment",
  "customer_advance",
  "supplier_advance",
  "opening_stock",
  "owner_capital",
  "loan",
  "adjustment",
]);

export const journalEntryStatusEnum = pgEnum("journal_entry_status", [
  "draft",
  "posted",
  "voided",
]);

export const journalEntry = pgTable(
  "journal_entry",
  {
    id: serial("id").primaryKey(),
    journalNumber: varchar("journal_number", { length: 40 }).notNull().unique(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ownerType: financeOwnerTypeEnum("owner_type").notNull(),
    transactionType: journalTransactionTypeEnum("transaction_type").notNull(),
    sourceType: journalSourceTypeEnum("source_type").notNull(),
    sourceId: varchar("source_id", { length: 120 }),
    transactionDate: date("transaction_date").notNull(),
    memo: text("memo"),
    status: journalEntryStatusEnum("status").default("posted").notNull(),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    postedAt: timestamp("posted_at").defaultNow().notNull(),
    voidedAt: timestamp("voided_at"),
    voidReason: text("void_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("journalEntry_owner_number_unique").on(
      table.ownerId,
      table.ownerType,
      table.journalNumber,
    ),
    index("journalEntry_owner_idx").on(table.ownerId, table.ownerType),
    index("journalEntry_transactionDate_idx").on(table.transactionDate),
    index("journalEntry_transactionType_idx").on(table.transactionType),
    index("journalEntry_source_idx").on(table.sourceType, table.sourceId),
    index("journalEntry_status_idx").on(table.status),
  ],
);

export const journalEntryRelations = relations(journalEntry, ({ one }) => ({
  createdBy: one(user, {
    fields: [journalEntry.createdById],
    references: [user.id],
  }),
  owner: one(user, {
    fields: [journalEntry.ownerId],
    references: [user.id],
  }),
}));

export type JournalEntry = typeof journalEntry.$inferSelect;
export type NewJournalEntry = typeof journalEntry.$inferInsert;
