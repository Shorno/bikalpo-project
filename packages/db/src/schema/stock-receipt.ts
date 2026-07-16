import { relations, sql } from "drizzle-orm";
import {
    date,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    uniqueIndex,
    varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { timestamps } from "./columns.helpers";
import { supplier } from "./supplier";
import { warehouseStorageArea } from "./warehouse-storage-area";

export const stockReceiptPaymentMethodEnum = pgEnum(
    "stock_receipt_payment_method",
    ["cash", "bank"],
);

/** One atomic warehouse receiving transaction with one or more stock lines. */
export const stockReceipt = pgTable(
    "stock_receipt",
    {
        id: serial("id").primaryKey(),
        receiptNo: varchar("receipt_no", { length: 32 })
            .default(sql`'GRN-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('stock_receipt_number_seq')::text, 6, '0')`)
            .notNull(),
        warehouseId: text("warehouse_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
        supplierId: integer("supplier_id").references(() => supplier.id, {
            onDelete: "set null",
        }),
        receiptDate: date("receipt_date").notNull(),
        paymentMethod: stockReceiptPaymentMethodEnum("payment_method").notNull(),
        reference: varchar("reference", { length: 150 }),
        storageAreaId: integer("storage_area_id").references(
            () => warehouseStorageArea.id,
            { onDelete: "set null" },
        ),
        shelfRack: varchar("shelf_rack", { length: 100 }),
        note: text("note"),
        lineCount: integer("line_count").default(0).notNull(),
        ...timestamps,
    },
    (table) => [
        uniqueIndex("stockReceipt_receiptNo_unique").on(table.receiptNo),
        uniqueIndex("stockReceipt_warehouse_idempotency_unique").on(
            table.warehouseId,
            table.idempotencyKey,
        ),
        index("stockReceipt_warehouseId_idx").on(table.warehouseId),
        index("stockReceipt_supplierId_idx").on(table.supplierId),
    ],
);

export const stockReceiptRelations = relations(stockReceipt, ({ one }) => ({
    warehouse: one(user, {
        fields: [stockReceipt.warehouseId],
        references: [user.id],
    }),
    supplier: one(supplier, {
        fields: [stockReceipt.supplierId],
        references: [supplier.id],
    }),
    storageArea: one(warehouseStorageArea, {
        fields: [stockReceipt.storageAreaId],
        references: [warehouseStorageArea.id],
    }),
}));

export type StockReceipt = typeof stockReceipt.$inferSelect;
export type NewStockReceipt = typeof stockReceipt.$inferInsert;
