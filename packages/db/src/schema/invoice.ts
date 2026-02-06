import { relations } from "drizzle-orm";
import {
    type AnyPgColumn,
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
import { product } from "./product";

// Invoice type enum
export const invoiceTypeEnum = pgEnum("invoice_type", ["main", "split"]);

// Invoice payment status enum
export const invoicePaymentStatusEnum = pgEnum("invoice_payment_status", [
    "unpaid",
    "collected",
    "settled",
]);

// Invoice delivery status enum - 'not_assigned' is initial state
export const invoiceDeliveryStatusEnum = pgEnum("invoice_delivery_status", [
    "not_assigned",
    "pending",
    "out_for_delivery",
    "delivered",
    "failed",
]);

// Vehicle type for delivery assignment (optional)
export const invoiceVehicleTypeEnum = pgEnum("invoice_vehicle_type", [
    "bike",
    "car",
    "van",
    "truck",
]);

export const invoice = pgTable(
    "invoice",
    {
        id: serial("id").primaryKey(),
        invoiceNumber: text("invoice_number").notNull().unique(),

        // Related order
        orderId: integer("order_id")
            .notNull()
            .references(() => order.id, { onDelete: "cascade" }),

        // Customer
        customerId: text("customer_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        // Split invoice support
        parentInvoiceId: integer("parent_invoice_id").references(
            (): AnyPgColumn => invoice.id,
            { onDelete: "set null" },
        ),
        splitSequence: integer("split_sequence"), // 1, 2, 3 for split invoices
        invoiceType: invoiceTypeEnum("invoice_type").default("main").notNull(),

        // Status tracking (delivery and payment only - automated based on delivery group)
        paymentStatus: invoicePaymentStatusEnum("payment_status")
            .default("unpaid")
            .notNull(),
        deliveryStatus: invoiceDeliveryStatusEnum("delivery_status")
            .default("not_assigned")
            .notNull(),

        // Delivery assignment
        deliverymanId: text("deliveryman_id").references(() => user.id, {
            onDelete: "set null",
        }),
        vehicleType: invoiceVehicleTypeEnum("vehicle_type"),
        vehicleInfo: text("vehicle_info"),
        expectedDeliveryAt: timestamp("expected_delivery_at"),

        // Financial summary
        subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
        discountAmount: decimal("discount_amount", { precision: 10, scale: 2 })
            .default("0")
            .notNull(),
        deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 })
            .default("0")
            .notNull(),
        taxAmount: decimal("tax_amount", { precision: 10, scale: 2 })
            .default("0")
            .notNull(),
        grandTotal: decimal("grand_total", { precision: 10, scale: 2 }).notNull(),

        // Notes
        customerNotes: text("customer_notes"),
        adminNotes: text("admin_notes"),

        // Timestamps
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
        approvedAt: timestamp("approved_at"),
        deliveredAt: timestamp("delivered_at"),
    },
    (table) => [
        index("invoice_orderId_idx").on(table.orderId),
        index("invoice_customerId_idx").on(table.customerId),
        index("invoice_deliveryStatus_idx").on(table.deliveryStatus),
        index("invoice_invoiceNumber_idx").on(table.invoiceNumber),
        index("invoice_parentInvoiceId_idx").on(table.parentInvoiceId),
        index("invoice_deliverymanId_idx").on(table.deliverymanId),
    ],
);

export const invoiceItem = pgTable(
    "invoice_item",
    {
        id: serial("id").primaryKey(),
        invoiceId: integer("invoice_id")
            .notNull()
            .references(() => invoice.id, { onDelete: "cascade" }),
        productId: integer("product_id")
            .notNull()
            .references(() => product.id, { onDelete: "restrict" }),

        // Product snapshot at time of invoice
        productName: text("product_name").notNull(),
        productSku: text("product_sku"),
        productImage: text("product_image"),

        // Pricing
        quantity: integer("quantity").notNull(),
        unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
        lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),

        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("invoiceItem_invoiceId_idx").on(table.invoiceId),
        index("invoiceItem_productId_idx").on(table.productId),
    ],
);

// Relations
export const invoiceRelations = relations(invoice, ({ one, many }) => ({
    order: one(order, {
        fields: [invoice.orderId],
        references: [order.id],
    }),
    customer: one(user, {
        fields: [invoice.customerId],
        references: [user.id],
        relationName: "customerInvoices",
    }),
    deliveryman: one(user, {
        fields: [invoice.deliverymanId],
        references: [user.id],
        relationName: "deliverymanInvoices",
    }),
    parentInvoice: one(invoice, {
        fields: [invoice.parentInvoiceId],
        references: [invoice.id],
        relationName: "splitInvoices",
    }),
    splitInvoices: many(invoice, {
        relationName: "splitInvoices",
    }),
    items: many(invoiceItem),
}));

export const invoiceItemRelations = relations(invoiceItem, ({ one }) => ({
    invoice: one(invoice, {
        fields: [invoiceItem.invoiceId],
        references: [invoice.id],
    }),
    product: one(product, {
        fields: [invoiceItem.productId],
        references: [product.id],
    }),
}));

// Types
export type Invoice = typeof invoice.$inferSelect;
export type InvoiceItem = typeof invoiceItem.$inferSelect;
export type NewInvoice = typeof invoice.$inferInsert;
export type NewInvoiceItem = typeof invoiceItem.$inferInsert;

export type InvoiceType = (typeof invoiceTypeEnum.enumValues)[number];

export type InvoicePaymentStatus =
    (typeof invoicePaymentStatusEnum.enumValues)[number];
export type InvoiceDeliveryStatus =
    (typeof invoiceDeliveryStatusEnum.enumValues)[number];
export type InvoiceVehicleType =
    (typeof invoiceVehicleTypeEnum.enumValues)[number];

export interface InvoiceWithItems extends Invoice {
    items: InvoiceItem[];
    order?: {
        id: number;
        orderNumber: string;
        status: string;
    } | null;
    customer?: {
        id: string;
        name: string;
        email: string;
        phoneNumber: string | null;
        shopName: string | null;
        ownerName: string | null;
    } | null;
    deliveryman?: {
        id: string;
        name: string;
        phoneNumber: string | null;
    } | null;
    parentInvoice?: Invoice | null;
    splitInvoices?: Invoice[];
}
