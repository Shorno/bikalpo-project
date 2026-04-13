import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Wallet — tracks user reward balance for payouts
 * Each user has one wallet record
 */
export const wallet = pgTable(
  "wallet",
  {
    id: serial("id").primaryKey(),

    // One wallet per user
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Balance in BDT (taka)
    balance: integer("balance").default(0).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("wallet_user_idx").on(table.userId)],
);

export type Wallet = typeof wallet.$inferSelect;
export type NewWallet = typeof wallet.$inferInsert;
