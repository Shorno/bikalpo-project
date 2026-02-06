import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// Support ticket status enum
export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

// Support ticket priority enum
export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
]);

export const supportTicket = pgTable(
  "support_ticket",
  {
    id: serial("id").primaryKey(),
    ticketNumber: text("ticket_number").notNull().unique(),
    customerId: text("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    status: ticketStatusEnum("status").default("open").notNull(),
    priority: ticketPriorityEnum("priority").default("medium").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    resolvedAt: timestamp("resolved_at"),
    closedAt: timestamp("closed_at"),
  },
  (table) => [
    index("supportTicket_customerId_idx").on(table.customerId),
    index("supportTicket_status_idx").on(table.status),
    index("supportTicket_ticketNumber_idx").on(table.ticketNumber),
  ],
);

export const supportTicketReply = pgTable(
  "support_ticket_reply",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => supportTicket.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    isStaffReply: boolean("is_staff_reply").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("supportTicketReply_ticketId_idx").on(table.ticketId),
    index("supportTicketReply_userId_idx").on(table.userId),
  ],
);

export const supportTicketRelations = relations(
  supportTicket,
  ({ one, many }) => ({
    customer: one(user, {
      fields: [supportTicket.customerId],
      references: [user.id],
    }),
    replies: many(supportTicketReply),
  }),
);

export const supportTicketReplyRelations = relations(
  supportTicketReply,
  ({ one }) => ({
    ticket: one(supportTicket, {
      fields: [supportTicketReply.ticketId],
      references: [supportTicket.id],
    }),
    user: one(user, {
      fields: [supportTicketReply.userId],
      references: [user.id],
    }),
  }),
);

export type SupportTicket = typeof supportTicket.$inferSelect;
export type SupportTicketReply = typeof supportTicketReply.$inferSelect;
export type NewSupportTicket = typeof supportTicket.$inferInsert;
export type NewSupportTicketReply = typeof supportTicketReply.$inferInsert;

export type TicketStatus = (typeof ticketStatusEnum.enumValues)[number];
export type TicketPriority = (typeof ticketPriorityEnum.enumValues)[number];

export interface SupportTicketWithReplies extends SupportTicket {
  replies: (SupportTicketReply & {
    user: { id: string; name: string; image: string | null };
  })[];
  customer?: { id: string; name: string; email: string };
}
