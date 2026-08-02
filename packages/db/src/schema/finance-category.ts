import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import {
  ACCOUNTING_ACCOUNT_TYPES,
  ACCOUNTING_NORMAL_BALANCES,
  ACCOUNTING_OWNER_TYPES,
} from "../accounting";
import { user } from "./auth-schema";
import { timestamps } from "./columns.helpers";

export const financeAccountTypeEnum = pgEnum(
  "finance_account_type",
  ACCOUNTING_ACCOUNT_TYPES,
);

export const financeOwnerTypeEnum = pgEnum(
  "finance_owner_type",
  ACCOUNTING_OWNER_TYPES,
);

export const financeNormalBalanceEnum = pgEnum(
  "finance_normal_balance",
  ACCOUNTING_NORMAL_BALANCES,
);

export const financeCategory = pgTable(
  "finance_category",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    accountType: financeAccountTypeEnum("account_type").notNull(),
    description: text("description"),
    ownerId: text("owner_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    ownerType: financeOwnerTypeEnum("owner_type"),
    isSystem: boolean("is_system").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("financeCategory_owner_code_unique").on(
      table.ownerId,
      table.ownerType,
      table.code,
    ),
    index("financeCategory_accountType_idx").on(table.accountType),
    index("financeCategory_owner_idx").on(table.ownerId, table.ownerType),
  ],
);

export const financeCategoryRelations = relations(
  financeCategory,
  ({ one }) => ({
    owner: one(user, {
      fields: [financeCategory.ownerId],
      references: [user.id],
    }),
  }),
);

export type FinanceCategory = typeof financeCategory.$inferSelect;
export type NewFinanceCategory = typeof financeCategory.$inferInsert;
