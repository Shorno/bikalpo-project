import { relations } from "drizzle-orm";
import {
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { order } from "./order";

// Return status enum
export const returnStatusEnum = pgEnum("return_status", [
  "pending",
  "approved",
  "rejected",
  "processed",
]);

// Return type enum
export const returnTypeEnum = pgEnum("return_type", ["full", "partial"]);

// Refund type enum
export const refundTypeEnum = pgEnum("refund_type", [
  "cash",
  "wallet",
  "adjustment",
]);

// Return item interface for JSON storage
export interface ReturnItem {
  orderItemId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  reason?: string;
  attachment?: string; // Image URL as proof
}

export const orderReturn = pgTable(
  "order_return",
  {
    id: serial("id").primaryKey(),

    // Related order
    orderId: integer("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),

    // User who requested return (customer)
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Deliveryman/Staff who submitted the return request
    submittedBy: text("submitted_by").references(() => user.id, {
      onDelete: "set null",
    }),

    // Admin/Employee who processed return
    processedBy: text("processed_by").references(() => user.id, {
      onDelete: "set null",
    }),

    // Return details
    reason: text("reason").notNull(),
    returnType: returnTypeEnum("return_type").default("full").notNull(),

    // Items being returned (JSON array of ReturnItem)
    items: jsonb("items").$type<ReturnItem[]>(),

    // Amount
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),

    // Refund method
    refundType: refundTypeEnum("refund_type"),

    // Status
    status: returnStatusEnum("status").default("pending").notNull(),

    // Notes
    notes: text("notes"),
    adminNotes: text("admin_notes"),

    // Attachments (array of image URLs)
    attachments: jsonb("attachments").$type<string[]>(),

    // Restocking
    restocked: integer("restocked").default(0),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    processedAt: timestamp("processed_at"),
  },
  (table) => [
    index("orderReturn_orderId_idx").on(table.orderId),
    index("orderReturn_userId_idx").on(table.userId),
    index("orderReturn_status_idx").on(table.status),
    index("orderReturn_processedBy_idx").on(table.processedBy),
  ],
);

// Relations
export const orderReturnRelations = relations(orderReturn, ({ one }) => ({
  order: one(order, {
    fields: [orderReturn.orderId],
    references: [order.id],
  }),
  user: one(user, {
    fields: [orderReturn.userId],
    references: [user.id],
    relationName: "userReturns",
  }),
  submitter: one(user, {
    fields: [orderReturn.submittedBy],
    references: [user.id],
    relationName: "submittedReturns",
  }),
  processor: one(user, {
    fields: [orderReturn.processedBy],
    references: [user.id],
    relationName: "processedReturns",
  }),
}));

// Types
export type OrderReturn = typeof orderReturn.$inferSelect;
export type NewOrderReturn = typeof orderReturn.$inferInsert;

export type ReturnStatus = (typeof returnStatusEnum.enumValues)[number];
export type ReturnType = (typeof returnTypeEnum.enumValues)[number];
export type RefundType = (typeof refundTypeEnum.enumValues)[number];

export interface OrderReturnWithDetails extends OrderReturn {
  order?: {
    id: number;
    orderNumber: string;
    total: string;
    status: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
  };
  submitter?: {
    id: string;
    name: string;
    phoneNumber: string | null;
  } | null;
  processor?: {
    id: string;
    name: string;
  };
}
