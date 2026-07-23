import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { BALANCE_SHEET_LINES, PROFIT_AND_LOSS_LINES } from "../accounting";
import { user } from "./auth-schema";
import { timestamps } from "./columns.helpers";
import {
  financeAccountTypeEnum,
  financeCategory,
  financeNormalBalanceEnum,
  financeOwnerTypeEnum,
} from "./finance-category";

export const profitAndLossLineEnum = pgEnum(
  "profit_and_loss_line",
  PROFIT_AND_LOSS_LINES,
);

export const balanceSheetLineEnum = pgEnum(
  "balance_sheet_line",
  BALANCE_SHEET_LINES,
);

export const financeAccount = pgTable(
  "finance_account",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    accountType: financeAccountTypeEnum("account_type").notNull(),
    normalBalance: financeNormalBalanceEnum("normal_balance").notNull(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => financeCategory.id, { onDelete: "restrict" }),
    parentAccountId: integer("parent_account_id").references(
      (): AnyPgColumn => financeAccount.id,
      { onDelete: "set null" },
    ),
    ownerId: text("owner_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    ownerType: financeOwnerTypeEnum("owner_type"),
    balanceSheetLine: balanceSheetLineEnum("balance_sheet_line"),
    profitAndLossLine: profitAndLossLineEnum("profit_and_loss_line"),
    openingBalance: decimal("opening_balance", {
      precision: 14,
      scale: 2,
    })
      .default("0")
      .notNull(),
    currentBalance: decimal("current_balance", {
      precision: 14,
      scale: 2,
    })
      .default("0")
      .notNull(),
    description: text("description"),
    isSystem: boolean("is_system").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isPaymentAccount: boolean("is_payment_account").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("financeAccount_owner_code_unique").on(
      table.ownerId,
      table.ownerType,
      table.code,
    ),
    index("financeAccount_category_idx").on(table.categoryId),
    index("financeAccount_accountType_idx").on(table.accountType),
    index("financeAccount_owner_idx").on(table.ownerId, table.ownerType),
    index("financeAccount_balanceSheetLine_idx").on(table.balanceSheetLine),
    index("financeAccount_profitLossLine_idx").on(table.profitAndLossLine),
  ],
);

export const financeAccountRelations = relations(financeAccount, ({ one }) => ({
  category: one(financeCategory, {
    fields: [financeAccount.categoryId],
    references: [financeCategory.id],
  }),
  owner: one(user, {
    fields: [financeAccount.ownerId],
    references: [user.id],
  }),
  parentAccount: one(financeAccount, {
    fields: [financeAccount.parentAccountId],
    references: [financeAccount.id],
  }),
}));

export type FinanceAccount = typeof financeAccount.$inferSelect;
export type NewFinanceAccount = typeof financeAccount.$inferInsert;
