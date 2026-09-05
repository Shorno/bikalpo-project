import { relations } from "drizzle-orm";
import {
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
import { user } from "./auth-schema";
import { timestamps } from "./columns.helpers";
import { financeAccount } from "./finance-account";
import { financeOwnerTypeEnum } from "./finance-category";

export const financePaymentAccountTypeEnum = pgEnum(
  "finance_payment_account_type",
  ["cash", "bank", "mobile_banking"],
);

export const financePaymentAccount = pgTable(
  "finance_payment_account",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    accountNumber: varchar("account_number", { length: 80 }),
    providerName: varchar("provider_name", { length: 120 }),
    type: financePaymentAccountTypeEnum("type").notNull(),
    financeAccountId: integer("finance_account_id")
      .notNull()
      .references(() => financeAccount.id, { onDelete: "restrict" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ownerType: financeOwnerTypeEnum("owner_type").notNull(),
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
    isDefault: boolean("is_default").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("financePaymentAccount_owner_code_unique").on(
      table.ownerId,
      table.ownerType,
      table.code,
    ),
    index("financePaymentAccount_owner_idx").on(table.ownerId, table.ownerType),
    index("financePaymentAccount_financeAccount_idx").on(
      table.financeAccountId,
    ),
  ],
);

export const financePaymentAccountRelations = relations(
  financePaymentAccount,
  ({ one }) => ({
    financeAccount: one(financeAccount, {
      fields: [financePaymentAccount.financeAccountId],
      references: [financeAccount.id],
    }),
    owner: one(user, {
      fields: [financePaymentAccount.ownerId],
      references: [user.id],
    }),
  }),
);

export type FinancePaymentAccount = typeof financePaymentAccount.$inferSelect;
export type NewFinancePaymentAccount =
  typeof financePaymentAccount.$inferInsert;
