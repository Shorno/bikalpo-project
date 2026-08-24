import { relations } from "drizzle-orm";
import {
    type AnyPgColumn,
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
import { financePaymentAccount } from "./finance-payment-account";
import { type Order, order } from "./order";
import { purchase } from "./purchase";

// Payment transaction status (different from order payment status)
export const paymentTransactionStatusEnum = pgEnum("payment_transaction_status", [
    "pending",
    "processing",
    "completed",
    "failed",
    "refund_pending",
    "refunded",
    "partially_refunded",
    "cancelled",
]);

export const paymentEntryTypeEnum = pgEnum("payment_entry_type", [
    "payment",
    "refund",
]);

export const purchasePaymentPurposeEnum = pgEnum("purchase_payment_purpose", [
    "order_payment",
    "supplier_advance",
    "payable_settlement",
]);

export const purchasePaymentTimingEnum = pgEnum("purchase_payment_timing", [
    "before_receipt",
    "at_receipt",
    "after_receipt",
]);

export const payment = pgTable(
    "payment",
    {
        id: serial("id").primaryKey(),
        orderId: integer("order_id").references(() => order.id, {
            onDelete: "restrict",
        }),
        purchaseId: integer("purchase_id").references(() => purchase.id, {
            onDelete: "restrict",
        }),

        transactionId: varchar("transaction_id", { length: 255 }).unique(),
        idempotencyKey: varchar("idempotency_key", { length: 100 }),
        entryType: paymentEntryTypeEnum("entry_type").default("payment").notNull(),
        paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
        paymentProvider: varchar("payment_provider", { length: 50 }).default(
            "sslcommerz",
        ),
        paymentAccountId: integer("payment_account_id").references(
            () => financePaymentAccount.id,
            { onDelete: "set null" },
        ),
        purchasePurpose: purchasePaymentPurposeEnum("purchase_purpose"),
        purchaseTiming: purchasePaymentTimingEnum("purchase_timing"),
        referenceNo: varchar("reference_no", { length: 180 }),
        relatedPaymentId: integer("related_payment_id").references(
            (): AnyPgColumn => payment.id,
            { onDelete: "set null" },
        ),

        status: paymentTransactionStatusEnum("status").default("pending").notNull(),

        amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
        refundedAmount: decimal("refunded_amount", { precision: 10, scale: 2 })
            .default("0")
            .notNull(),
        currency: varchar("currency", { length: 3 }).default("BDT").notNull(),

        // Mobile Banking Details (for bKash, Nagad, Rocket) - For Manual Verification
        senderNumber: varchar("sender_number", { length: 20 }),
        receiverNumber: varchar("receiver_number", { length: 20 }),

        // Timestamps
        completedAt: timestamp("completed_at"),
        verifiedAt: timestamp("verified_at"),
        failedAt: timestamp("failed_at"),
        ...timestamps,
    },
    (table) => [
        index("payment_orderId_idx").on(table.orderId),
        index("payment_purchaseId_idx").on(table.purchaseId),
        index("payment_purchasePurpose_idx").on(table.purchasePurpose),
        index("payment_paymentAccount_idx").on(table.paymentAccountId),
        uniqueIndex("payment_idempotencyKey_unique").on(table.idempotencyKey),
    ],
);

export const paymentRelations = relations(payment, ({ one }) => ({
    order: one(order, {
        fields: [payment.orderId],
        references: [order.id],
    }),
    purchase: one(purchase, {
        fields: [payment.purchaseId],
        references: [purchase.id],
    }),
    paymentAccount: one(financePaymentAccount, {
        fields: [payment.paymentAccountId],
        references: [financePaymentAccount.id],
    }),
    relatedPayment: one(payment, {
        fields: [payment.relatedPaymentId],
        references: [payment.id],
    }),
}));

export interface PaymentWithOrder extends Payment {
    order: Order;
}

export type Payment = typeof payment.$inferSelect;
