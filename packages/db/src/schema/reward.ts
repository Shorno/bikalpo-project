import { index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { invite } from "./invite";

/**
 * Reward — tracks referral rewards, approval, fraud detection, and payouts
 * Reward ID format: RW-XXXX (auto-generated in API layer)
 */
export const reward = pgTable(
  "reward",
  {
    id: serial("id").primaryKey(),
    rewardCode: varchar("reward_code", { length: 20 }).notNull().unique(),

    // Who gets the reward (the inviter)
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Which invite triggered this reward
    inviteId: integer("invite_id").references(() => invite.id, { onDelete: "set null" }),

    // Source: referral_invite | admin_invite
    source: varchar("source", { length: 30 }).default("referral_invite").notNull(),

    // Reward amount in BDT (taka)
    amount: integer("amount").notNull(),

    // Reward type: cash_bonus | subscription_discount
    rewardType: varchar("reward_type", { length: 30 }).default("cash_bonus").notNull(),

    // Status: pending | approved | rejected | paid
    status: varchar("status", { length: 20 }).default("pending").notNull(),

    // Fraud check: passed | flagged | blocked
    fraudCheck: varchar("fraud_check", { length: 20 }).default("passed").notNull(),
    fraudReason: text("fraud_reason"),

    // Admin who approved/rejected
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
    paidAt: timestamp("paid_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("reward_user_idx").on(table.userId),
    index("reward_invite_idx").on(table.inviteId),
    index("reward_status_idx").on(table.status),
  ],
);

export type Reward = typeof reward.$inferSelect;
export type NewReward = typeof reward.$inferInsert;
