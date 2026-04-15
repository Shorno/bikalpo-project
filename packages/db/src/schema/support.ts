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
    varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// Support ticket status enum
export const ticketStatusEnum = pgEnum("ticket_status", [
    "open",
    "in_progress",
    "resolved",
    "closed",
]);

// Support ticket priority enum (added "critical")
export const ticketPriorityEnum = pgEnum("ticket_priority", [
    "low",
    "medium",
    "high",
    "critical",
]);

// Support ticket category enum
export const ticketCategoryEnum = pgEnum("ticket_category", [
    "order",
    "payment",
    "delivery",
    "account",
    "other",
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
        category: ticketCategoryEnum("category").default("other").notNull(),
        // Derived from user role for fast filtering: 'customer' | 'retailer' | 'wholesaler'
        userType: text("user_type").default("customer").notNull(),

        // ─── Hierarchical Routing ────────────────────────────────────────────

        /** User ID of the current handler (shop owner, warehouse owner, or null for admin pool) */
        assignedToId: text("assigned_to_id").references(() => user.id, {
            onDelete: "set null",
        }),

        /** Current handler level: level_1 = first responder, level_2 = escalated to admin */
        currentLevel: varchar("current_level", { length: 10 }).default("level_1").notNull(),

        /** When this ticket should auto-escalate to the next level */
        escalationDeadline: timestamp("escalation_deadline"),

        /** Whether this ticket was auto-escalated (true) vs manually escalated */
        autoEscalated: boolean("auto_escalated").default(false),

        // ─── Escalation Tracking ─────────────────────────────────────────────

        escalatedAt: timestamp("escalated_at"),
        escalatedBy: text("escalated_by").references(() => user.id, {
            onDelete: "set null",
        }),
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
        index("supportTicket_category_idx").on(table.category),
        index("supportTicket_userType_idx").on(table.userType),
        index("supportTicket_priority_idx").on(table.priority),
        index("supportTicket_assignedToId_idx").on(table.assignedToId),
        index("supportTicket_currentLevel_idx").on(table.currentLevel),
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

// Internal admin notes (not visible to the ticket creator)
export const supportTicketNote = pgTable(
    "support_ticket_note",
    {
        id: serial("id").primaryKey(),
        ticketId: integer("ticket_id")
            .notNull()
            .references(() => supportTicket.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        note: text("note").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("supportTicketNote_ticketId_idx").on(table.ticketId),
    ],
);

// File attachments for tickets
export const supportTicketAttachment = pgTable(
    "support_ticket_attachment",
    {
        id: serial("id").primaryKey(),
        ticketId: integer("ticket_id")
            .notNull()
            .references(() => supportTicket.id, { onDelete: "cascade" }),
        url: text("url").notNull(),
        fileName: text("file_name").notNull(),
        fileType: text("file_type"), // e.g. "image/png", "application/pdf"
        uploadedBy: text("uploaded_by")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("supportTicketAttachment_ticketId_idx").on(table.ticketId),
    ],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const supportTicketRelations = relations(
    supportTicket,
    ({ one, many }) => ({
        customer: one(user, {
            fields: [supportTicket.customerId],
            references: [user.id],
            relationName: "ticketCustomer",
        }),
        assignedTo: one(user, {
            fields: [supportTicket.assignedToId],
            references: [user.id],
            relationName: "ticketAssignedTo",
        }),
        escalatedByUser: one(user, {
            fields: [supportTicket.escalatedBy],
            references: [user.id],
            relationName: "ticketEscalatedBy",
        }),
        replies: many(supportTicketReply),
        notes: many(supportTicketNote),
        attachments: many(supportTicketAttachment),
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

export const supportTicketNoteRelations = relations(
    supportTicketNote,
    ({ one }) => ({
        ticket: one(supportTicket, {
            fields: [supportTicketNote.ticketId],
            references: [supportTicket.id],
        }),
        user: one(user, {
            fields: [supportTicketNote.userId],
            references: [user.id],
        }),
    }),
);

export const supportTicketAttachmentRelations = relations(
    supportTicketAttachment,
    ({ one }) => ({
        ticket: one(supportTicket, {
            fields: [supportTicketAttachment.ticketId],
            references: [supportTicket.id],
        }),
        uploader: one(user, {
            fields: [supportTicketAttachment.uploadedBy],
            references: [user.id],
        }),
    }),
);

// ─── Type Exports ────────────────────────────────────────────────────────────

export type SupportTicket = typeof supportTicket.$inferSelect;
export type SupportTicketReply = typeof supportTicketReply.$inferSelect;
export type SupportTicketNote = typeof supportTicketNote.$inferSelect;
export type SupportTicketAttachment = typeof supportTicketAttachment.$inferSelect;
export type NewSupportTicket = typeof supportTicket.$inferInsert;
export type NewSupportTicketReply = typeof supportTicketReply.$inferInsert;
export type NewSupportTicketNote = typeof supportTicketNote.$inferInsert;
export type NewSupportTicketAttachment = typeof supportTicketAttachment.$inferInsert;

export type TicketStatus = (typeof ticketStatusEnum.enumValues)[number];
export type TicketPriority = (typeof ticketPriorityEnum.enumValues)[number];
export type TicketCategory = (typeof ticketCategoryEnum.enumValues)[number];

export interface SupportTicketWithReplies extends SupportTicket {
    replies: (SupportTicketReply & {
        user: { id: string; name: string; image: string | null };
    })[];
    customer?: { id: string; name: string; email: string };
}
