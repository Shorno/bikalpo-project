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
    timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { order } from "./order";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const complaintStatusEnum = pgEnum("complaint_status", [
    "open",
    "investigating",
    "resolved",
    "closed",
]);

export const complaintTypeEnum = pgEnum("complaint_type", [
    "delivery",
    "payment",
    "product",
]);

export const complaintPriorityEnum = pgEnum("complaint_priority", [
    "medium",
    "high",
    "critical",
]);

// ─── Complaint Table ─────────────────────────────────────────────────────────

export const complaint = pgTable(
    "complaint",
    {
        id: serial("id").primaryKey(),
        complaintNumber: text("complaint_number").notNull().unique(),

        // Who filed it
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        /** Derived from user role: 'customer' | 'retailer' | 'wholesaler' */
        userType: text("user_type").default("customer").notNull(),

        // What order it's about (REQUIRED — every complaint is against an order)
        orderId: integer("order_id")
            .notNull()
            .references(() => order.id, { onDelete: "cascade" }),

        // Classification
        type: complaintTypeEnum("type").default("delivery").notNull(),
        priority: complaintPriorityEnum("priority").default("medium").notNull(),
        status: complaintStatusEnum("status").default("open").notNull(),

        // User's description
        description: text("description").notNull(),
        userComment: text("user_comment"),

        // Admin assignment (direct to admin pool — no hierarchical routing)
        assignedAdminId: text("assigned_admin_id").references(() => user.id, {
            onDelete: "set null",
        }),

        // Investigation fields (admin fills in)
        delayReason: text("delay_reason"),
        investigationNotes: text("investigation_notes"),

        // Resolution
        resolution: text("resolution"),
        compensationAmount: decimal("compensation_amount", {
            precision: 10,
            scale: 2,
        }),

        // Timestamps
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
        resolvedAt: timestamp("resolved_at"),
        closedAt: timestamp("closed_at"),
    },
    (table) => [
        index("complaint_userId_idx").on(table.userId),
        index("complaint_orderId_idx").on(table.orderId),
        index("complaint_status_idx").on(table.status),
        index("complaint_type_idx").on(table.type),
        index("complaint_priority_idx").on(table.priority),
        index("complaint_complaintNumber_idx").on(table.complaintNumber),
        index("complaint_userType_idx").on(table.userType),
        index("complaint_assignedAdminId_idx").on(table.assignedAdminId),
    ],
);

// ─── Action Log Table (Immutable Audit Trail) ────────────────────────────────

export const complaintActionLog = pgTable(
    "complaint_action_log",
    {
        id: serial("id").primaryKey(),
        complaintId: integer("complaint_id")
            .notNull()
            .references(() => complaint.id, { onDelete: "cascade" }),
        /** e.g., "Delivery partner contacted", "Customer informed", "Compensation offered" */
        action: text("action").notNull(),
        performedBy: text("performed_by")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        /** Optional details about the action */
        note: text("note"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("complaintActionLog_complaintId_idx").on(table.complaintId),
        index("complaintActionLog_performedBy_idx").on(table.performedBy),
    ],
);

// ─── Reply Table (Communication Thread) ──────────────────────────────────────

export const complaintReply = pgTable(
    "complaint_reply",
    {
        id: serial("id").primaryKey(),
        complaintId: integer("complaint_id")
            .notNull()
            .references(() => complaint.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        message: text("message").notNull(),
        isAdminReply: boolean("is_admin_reply").default(false).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("complaintReply_complaintId_idx").on(table.complaintId),
        index("complaintReply_userId_idx").on(table.userId),
    ],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const complaintRelations = relations(
    complaint,
    ({ one, many }) => ({
        user: one(user, {
            fields: [complaint.userId],
            references: [user.id],
            relationName: "complaintUser",
        }),
        order: one(order, {
            fields: [complaint.orderId],
            references: [order.id],
        }),
        assignedAdmin: one(user, {
            fields: [complaint.assignedAdminId],
            references: [user.id],
            relationName: "complaintAdmin",
        }),
        actionLogs: many(complaintActionLog),
        replies: many(complaintReply),
    }),
);

export const complaintActionLogRelations = relations(
    complaintActionLog,
    ({ one }) => ({
        complaint: one(complaint, {
            fields: [complaintActionLog.complaintId],
            references: [complaint.id],
        }),
        performer: one(user, {
            fields: [complaintActionLog.performedBy],
            references: [user.id],
        }),
    }),
);

export const complaintReplyRelations = relations(
    complaintReply,
    ({ one }) => ({
        complaint: one(complaint, {
            fields: [complaintReply.complaintId],
            references: [complaint.id],
        }),
        user: one(user, {
            fields: [complaintReply.userId],
            references: [user.id],
        }),
    }),
);

// ─── Type Exports ────────────────────────────────────────────────────────────

export type Complaint = typeof complaint.$inferSelect;
export type ComplaintActionLog = typeof complaintActionLog.$inferSelect;
export type ComplaintReply = typeof complaintReply.$inferSelect;
export type NewComplaint = typeof complaint.$inferInsert;
export type NewComplaintActionLog = typeof complaintActionLog.$inferInsert;
export type NewComplaintReply = typeof complaintReply.$inferInsert;

export type ComplaintStatus = (typeof complaintStatusEnum.enumValues)[number];
export type ComplaintType = (typeof complaintTypeEnum.enumValues)[number];
export type ComplaintPriority = (typeof complaintPriorityEnum.enumValues)[number];
