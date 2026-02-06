import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { invoice, invoiceVehicleTypeEnum } from "./invoice";

// Delivery group status enum
export const deliveryGroupStatusEnum = pgEnum("delivery_group_status", [
  "assigned",
  "out_for_delivery",
  "completed",
  "partial",
]);

// Delivery invoice status enum (renamed from delivery_order_status)
export const deliveryInvoiceStatusEnum = pgEnum("delivery_invoice_status", [
  "pending",
  "delivered",
  "failed",
]);

export const deliveryGroup = pgTable(
  "delivery_group",
  {
    id: serial("id").primaryKey(),
    groupName: text("group_name").notNull(),

    // Assigned deliveryman (required)
    deliverymanId: text("deliveryman_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),

    // Optional: vehicle and expected delivery (for assignment flow)
    vehicleType: invoiceVehicleTypeEnum("vehicle_type"),
    expectedDeliveryAt: timestamp("expected_delivery_at"),

    // Status tracking
    status: deliveryGroupStatusEnum("status").default("assigned").notNull(),
    totalInvoices: integer("total_invoices").default(0).notNull(),
    completedInvoices: integer("completed_invoices").default(0).notNull(),

    // Notes
    notes: text("notes"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    assignedAt: timestamp("assigned_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("deliveryGroup_deliverymanId_idx").on(table.deliverymanId),
    index("deliveryGroup_status_idx").on(table.status),
  ],
);

// Renamed from deliveryGroupOrder - now links to invoices instead of orders
export const deliveryGroupInvoice = pgTable(
  "delivery_group_invoice",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => deliveryGroup.id, { onDelete: "cascade" }),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoice.id, { onDelete: "cascade" }),

    // Delivery sequence (order of delivery)
    sequence: integer("sequence").default(0).notNull(),

    // Status
    status: deliveryInvoiceStatusEnum("status").default("pending").notNull(),

    // Delivery tracking
    deliveredAt: timestamp("delivered_at"),
    failedReason: text("failed_reason"),

    // Optional: proof of delivery
    deliveryPhoto: text("delivery_photo"),
    deliveryOtp: text("delivery_otp"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("deliveryGroupInvoice_groupId_idx").on(table.groupId),
    index("deliveryGroupInvoice_invoiceId_idx").on(table.invoiceId),
    index("deliveryGroupInvoice_status_idx").on(table.status),
  ],
);

// Relations
export const deliveryGroupRelations = relations(
  deliveryGroup,
  ({ one, many }) => ({
    deliveryman: one(user, {
      fields: [deliveryGroup.deliverymanId],
      references: [user.id],
    }),
    invoices: many(deliveryGroupInvoice),
  }),
);

export const deliveryGroupInvoiceRelations = relations(
  deliveryGroupInvoice,
  ({ one }) => ({
    group: one(deliveryGroup, {
      fields: [deliveryGroupInvoice.groupId],
      references: [deliveryGroup.id],
    }),
    invoice: one(invoice, {
      fields: [deliveryGroupInvoice.invoiceId],
      references: [invoice.id],
    }),
  }),
);

// Types
export type DeliveryGroup = typeof deliveryGroup.$inferSelect;
export type DeliveryGroupInvoice = typeof deliveryGroupInvoice.$inferSelect;
export type NewDeliveryGroup = typeof deliveryGroup.$inferInsert;
export type NewDeliveryGroupInvoice = typeof deliveryGroupInvoice.$inferInsert;

export type DeliveryGroupStatus =
  (typeof deliveryGroupStatusEnum.enumValues)[number];
export type DeliveryInvoiceStatus =
  (typeof deliveryInvoiceStatusEnum.enumValues)[number];

export interface DeliveryGroupWithInvoices extends DeliveryGroup {
  invoices: DeliveryGroupInvoice[];
  deliveryman?: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
  };
}

// Stats types for employee dashboard
export interface DeliveryStatsCount {
  totalGroups: number;
  activeGroups: number;
  completedGroups: number;
  totalDeliveries: number;
  delivered: number;
  failed: number;
  pending: number;
  todayDelivered: number;
  todayFailed: number;
  // Return statistics
  totalReturns: number;
  returnAmountProcessed: number;
}

export interface DeliverymanStats {
  role: "deliveryman";
  deliveries: DeliveryStatsCount;
  successRate: number;
  activeGroups: DeliveryGroupWithInvoices[];
}
