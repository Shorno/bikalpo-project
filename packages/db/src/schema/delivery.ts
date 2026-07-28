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
import { invoice, invoiceVehicleTypeEnum } from "./invoice";

// Delivery group status enum
export const deliveryGroupStatusEnum = pgEnum("delivery_group_status", [
    "pending_assignment",
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
    "returned",
]);

// Supervisor approval status
export const supervisorApprovalEnum = pgEnum("supervisor_approval", [
    "pending",
    "approved",
    "flagged",
]);

// Payment collection method
export const paymentCollectionMethodEnum = pgEnum(
    "payment_collection_method",
    ["cash", "bkash", "nagad", "bank_transfer", "other"],
);

export const deliveryGroup = pgTable(
    "delivery_group",
    {
        id: serial("id").primaryKey(),
        groupName: text("group_name").notNull(),

        // Assigned deliveryman (optional until Delivery Team assigns)
        deliverymanId: text("deliveryman_id").references(() => user.id, {
            onDelete: "cascade",
        }),

        // Which warehouse this delivery group belongs to
        warehouseId: text("warehouse_id").references(() => user.id, {
            onDelete: "cascade",
        }),

        // Which retailer store this consumer delivery group belongs to
        shopId: text("shop_id").references(() => user.id, {
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

        // ── GPS tracking ──
        startLat: decimal("start_lat", { precision: 10, scale: 7 }),
        startLng: decimal("start_lng", { precision: 10, scale: 7 }),
        endLat: decimal("end_lat", { precision: 10, scale: 7 }),
        endLng: decimal("end_lng", { precision: 10, scale: 7 }),
        startedAt: timestamp("started_at"),

        // ── Cash/Digital reconciliation ──
        totalCashCollected: decimal("total_cash_collected", {
            precision: 10,
            scale: 2,
        }).default("0").notNull(),
        totalDigitalCollected: decimal("total_digital_collected", {
            precision: 10,
            scale: 2,
        }).default("0").notNull(),
        expectedTotal: decimal("expected_total", {
            precision: 10,
            scale: 2,
        }).default("0").notNull(),
        cashReconciled: boolean("cash_reconciled").default(false).notNull(),
        packReconciled: boolean("pack_reconciled").default(false).notNull(),

        // ── Supervisor approval ──
        supervisorApproval: supervisorApprovalEnum("supervisor_approval")
            .default("pending")
            .notNull(),
        supervisorNote: text("supervisor_note"),
        approvedBy: text("approved_by").references(() => user.id, {
            onDelete: "set null",
        }),
        approvedAt: timestamp("approved_at"),

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
        index("deliveryGroup_warehouseId_idx").on(table.warehouseId),
        index("deliveryGroup_shopId_idx").on(table.shopId),
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

        // ── GPS at delivery location ──
        deliveryLat: decimal("delivery_lat", { precision: 10, scale: 7 }),
        deliveryLng: decimal("delivery_lng", { precision: 10, scale: 7 }),

        // ── Payment collection ──
        paymentMethod: paymentCollectionMethodEnum("payment_method"),
        amountCollected: decimal("amount_collected", {
            precision: 10,
            scale: 2,
        }).default("0").notNull(),
        transactionId: text("transaction_id"),

        // ── Failed delivery proof ──
        failedPhoto: text("failed_photo"),

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
