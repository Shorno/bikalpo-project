import { relations } from "drizzle-orm";
import {
    date,
    decimal,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
    varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { financePaymentAccount } from "./finance-payment-account";
import { inventoryOwnerTypeEnum } from "./inventory";
import { supplier } from "./supplier";
import { productVariant } from "./product-variant";
import { timestamps } from "./columns.helpers";

/**
 * Purchase status lifecycle:
 *   draft → received (stock added to inventory)
 *   draft → partial  (some items received)
 *   draft → cancelled
 */
export const purchaseStatusEnum = pgEnum("purchase_status", [
    "draft",
    "received",
    "partial",
    "cancelled",
]);

/** Payment type for the purchase */
export const purchasePaymentTypeEnum = pgEnum("purchase_payment_type", [
    "cash",
    "credit",
]);

export const purchaseEntryModeEnum = pgEnum("purchase_entry_mode", [
    "new",
    "exchange",
]);

export const purchaseVerificationStatusEnum = pgEnum(
    "purchase_verification_status",
    ["pending", "verified", "on_hold"],
);

export const purchasePaymentStatusEnum = pgEnum("purchase_payment_status", [
    "unpaid",
    "partial",
    "paid",
    "refund_pending",
    "partially_refunded",
    "refunded",
]);

/**
 * Purchase — a stock-in entry from an external supplier to a warehouse.
 * When marked "received", inventory is incremented and a stock_ledger entry is created.
 */
export const purchase = pgTable(
    "purchase",
    {
        id: serial("id").primaryKey(),

        /** Auto-generated purchase number (e.g. PO-20260315-001) */
        purchaseNumber: text("purchase_number").notNull().unique(),

        /** Which supplier this purchase is from */
        supplierId: integer("supplier_id")
            .notNull()
            .references(() => supplier.id, { onDelete: "restrict" }),

        /** Which warehouse is receiving stock */
        warehouseId: text("warehouse_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** The inventory/accounting scope that owns this purchase. */
        ownerType: inventoryOwnerTypeEnum("owner_type")
            .default("warehouse")
            .notNull(),

        /** Supplier's own invoice reference number */
        supplierInvoiceNo: varchar("supplier_invoice_no", { length: 100 }),

        /** Date of the purchase (may differ from createdAt) */
        purchaseDate: date("purchase_date"),

        // Totals
        subtotal: decimal("subtotal", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),
        discount: decimal("discount", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),
        vatAmount: decimal("vat_amount", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),
        total: decimal("total", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),
        paidAmount: decimal("paid_amount", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),
        dueAmount: decimal("due_amount", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),

        /** Transport / delivery cost */
        transportCost: decimal("transport_cost", { precision: 10, scale: 2 })
            .default("0")
            .notNull(),

        /** Payment method: cash (deduct immediately) or credit (add to supplier payable) */
        paymentType: purchasePaymentTypeEnum("payment_type")
            .default("cash")
            .notNull(),

        paymentStatus: purchasePaymentStatusEnum("payment_status")
            .default("unpaid")
            .notNull(),
        paymentMethod: varchar("payment_method", { length: 50 }),
        paymentAccountId: integer("payment_account_id").references(
            () => financePaymentAccount.id,
            { onDelete: "set null" },
        ),

        entryMode: purchaseEntryModeEnum("entry_mode").default("new").notNull(),
        verificationStatus: purchaseVerificationStatusEnum(
            "verification_status",
        )
            .default("pending")
            .notNull(),
        verificationMessage: text("verification_message"),
        idempotencyKey: varchar("idempotency_key", { length: 120 }),
        attachmentUrl: text("attachment_url"),
        attachmentName: varchar("attachment_name", { length: 255 }),

        status: purchaseStatusEnum("status").default("draft").notNull(),

        note: text("note"),

        acceptedAt: timestamp("accepted_at"),
        receivedAt: timestamp("received_at"),
        cancelledAt: timestamp("cancelled_at"),
        createdById: text("created_by_id").references(() => user.id, {
            onDelete: "set null",
        }),

        ...timestamps,
    },
    (table) => [
        index("purchase_warehouseId_idx").on(table.warehouseId),
        index("purchase_supplierId_idx").on(table.supplierId),
        index("purchase_status_idx").on(table.status),
        index("purchase_paymentStatus_idx").on(table.paymentStatus),
        index("purchase_verificationStatus_idx").on(table.verificationStatus),
        uniqueIndex("purchase_owner_idempotency_unique").on(
            table.warehouseId,
            table.idempotencyKey,
        ),
    ],
);

/**
 * Purchase item — a single product variant in a purchase order.
 */
export const purchaseItem = pgTable(
    "purchase_item",
    {
        id: serial("id").primaryKey(),
        purchaseId: integer("purchase_id")
            .notNull()
            .references(() => purchase.id, { onDelete: "cascade" }),

        /** Which variant is being purchased (null for manual entry without a linked product) */
        variantId: integer("variant_id")
            .references(() => productVariant.id, { onDelete: "restrict" }),

        /** Snapshot of product name at purchase time */
        productName: text("product_name").notNull(),
        sku: varchar("sku", { length: 100 }),
        brandName: varchar("brand_name", { length: 180 }),
        sizeLabel: varchar("size_label", { length: 100 }),
        quantityUnit: varchar("quantity_unit", { length: 30 })
            .default("unit")
            .notNull(),

        quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
        unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
        totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull(),

        /** How many units have been received (for partial receipts) */
        receivedQty: decimal("received_qty", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),

        /** Batch tracking number */
        batchNo: varchar("batch_no", { length: 100 }),

        /** Product expiry date for this batch */
        expiryDate: date("expiry_date"),

        /** Number of empty packs returned to supplier on this item */
        returnPackQty: decimal("return_pack_qty", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),
        exchangeQty: decimal("exchange_qty", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),

        ...timestamps,
    },
    (table) => [
        index("purchaseItem_purchaseId_idx").on(table.purchaseId),
        index("purchaseItem_variantId_idx").on(table.variantId),
    ],
);

// Relations
export const purchaseRelations = relations(purchase, ({ one, many }) => ({
    supplier: one(supplier, {
        fields: [purchase.supplierId],
        references: [supplier.id],
    }),
    warehouse: one(user, {
        fields: [purchase.warehouseId],
        references: [user.id],
    }),
    createdBy: one(user, {
        fields: [purchase.createdById],
        references: [user.id],
        relationName: "purchaseCreatedBy",
    }),
    paymentAccount: one(financePaymentAccount, {
        fields: [purchase.paymentAccountId],
        references: [financePaymentAccount.id],
    }),
    items: many(purchaseItem),
}));

export const purchaseItemRelations = relations(purchaseItem, ({ one }) => ({
    purchase: one(purchase, {
        fields: [purchaseItem.purchaseId],
        references: [purchase.id],
    }),
    variant: one(productVariant, {
        fields: [purchaseItem.variantId],
        references: [productVariant.id],
    }),
}));

// Types
export type Purchase = typeof purchase.$inferSelect;
export type PurchaseItem = typeof purchaseItem.$inferSelect;
export type NewPurchase = typeof purchase.$inferInsert;
export type NewPurchaseItem = typeof purchaseItem.$inferInsert;
export type PurchaseStatus = (typeof purchaseStatusEnum.enumValues)[number];
export type PurchasePaymentType = (typeof purchasePaymentTypeEnum.enumValues)[number];
export type PurchaseEntryMode = (typeof purchaseEntryModeEnum.enumValues)[number];
export type PurchasePaymentStatus =
    (typeof purchasePaymentStatusEnum.enumValues)[number];
export type PurchaseVerificationStatus =
    (typeof purchaseVerificationStatusEnum.enumValues)[number];
