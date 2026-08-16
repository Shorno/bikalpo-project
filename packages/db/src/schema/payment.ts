import { relations } from "drizzle-orm";
import {
    decimal,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    timestamp,
    uniqueIndex,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { type Order, order } from "./order";

// Payment transaction status (different from order payment status)
export const paymentTransactionStatusEnum = pgEnum("payment_transaction_status", [
    "pending",
    "processing",
    "completed",
    "failed",
    "refunded",
    "partially_refunded",
    "cancelled",
]);

export const paymentEntryTypeEnum = pgEnum("payment_entry_type", [
    "payment",
    "refund",
]);

export const payment = pgTable(
    "payment",
    {
        id: serial("id").primaryKey(),
        orderId: integer("order_id")
            .notNull()
            .references(() => order.id, { onDelete: "restrict" }),

        transactionId: varchar("transaction_id", { length: 255 }).unique(),
        idempotencyKey: varchar("idempotency_key", { length: 100 }),
        entryType: paymentEntryTypeEnum("entry_type").default("payment").notNull(),
        paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
        paymentProvider: varchar("payment_provider", { length: 50 }).default(
            "sslcommerz",
        ),

        status: paymentTransactionStatusEnum("status").default("pending").notNull(),

        amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
        currency: varchar("currency", { length: 3 }).default("BDT").notNull(),

        // Mobile Banking Details (for bKash, Nagad, Rocket) - For Manual Verification
        senderNumber: varchar("sender_number", { length: 20 }),
        receiverNumber: varchar("receiver_number", { length: 20 }),

        // Timestamps
        completedAt: timestamp("completed_at"),
        failedAt: timestamp("failed_at"),
        ...timestamps,
    },
    (table) => [
        index("payment_orderId_idx").on(table.orderId),
        uniqueIndex("payment_idempotencyKey_unique").on(table.idempotencyKey),
    ],
);

export const paymentRelations = relations(payment, ({ one }) => ({
    order: one(order, {
        fields: [payment.orderId],
        references: [order.id],
    }),
}));

export interface PaymentWithOrder extends Payment {
    order: Order;
}

export type Payment = typeof payment.$inferSelect;
