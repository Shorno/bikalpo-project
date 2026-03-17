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
    varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
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
        total: decimal("total", { precision: 12, scale: 2 })
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

        status: purchaseStatusEnum("status").default("draft").notNull(),

        note: text("note"),

        receivedAt: timestamp("received_at"),

        ...timestamps,
    },
    (table) => [
        index("purchase_warehouseId_idx").on(table.warehouseId),
        index("purchase_supplierId_idx").on(table.supplierId),
        index("purchase_status_idx").on(table.status),
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
