import { index, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Admin Invite — tracks invites sent directly by admins
 * Invite ID format: AINV-XXXX (auto-generated in API layer)
 */
export const adminInvite = pgTable(
  "admin_invite",
  {
    id: serial("id").primaryKey(),
    inviteCode: varchar("invite_code", { length: 20 }).notNull().unique(),

    // Which admin sent the invite
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // How the invite was sent
    inviteMethod: varchar("invite_method", { length: 30 }).default("direct_call").notNull(),

    // Who was invited
    invitedPhone: varchar("invited_phone", { length: 20 }).notNull(),
    invitedName: varchar("invited_name", { length: 255 }),
    invitedUserId: text("invited_user_id").references(() => user.id, { onDelete: "set null" }),

    // User type: retailer or wholesaler
    userType: varchar("user_type", { length: 20 }).default("retailer").notNull(),

    // Status: invited | joined | converted
    status: varchar("status", { length: 20 }).default("invited").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("admin_invite_admin_idx").on(table.adminUserId),
    index("admin_invite_phone_idx").on(table.invitedPhone),
    index("admin_invite_status_idx").on(table.status),
  ],
);

export type AdminInvite = typeof adminInvite.$inferSelect;
export type NewAdminInvite = typeof adminInvite.$inferInsert;
