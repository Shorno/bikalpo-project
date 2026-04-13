import { index, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Invite — tracks user-to-user referral invites
 * Invite ID format: INV-XXXX (auto-generated in API layer)
 */
export const invite = pgTable(
  "invite",
  {
    id: serial("id").primaryKey(),
    inviteCode: varchar("invite_code", { length: 20 }).notNull().unique(),

    // Who sent the invite
    inviterUserId: text("inviter_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Who was invited
    invitedPhone: varchar("invited_phone", { length: 20 }).notNull(),
    invitedUserId: text("invited_user_id").references(() => user.id, { onDelete: "set null" }),

    // User type: retailer or wholesaler
    userType: varchar("user_type", { length: 20 }).default("retailer").notNull(),

    // Status: invited | joined | subscribed | rewarded | fraud
    status: varchar("status", { length: 20 }).default("invited").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("invite_inviter_idx").on(table.inviterUserId),
    index("invite_invited_phone_idx").on(table.invitedPhone),
    index("invite_status_idx").on(table.status),
  ],
);

export type Invite = typeof invite.$inferSelect;
export type NewInvite = typeof invite.$inferInsert;
