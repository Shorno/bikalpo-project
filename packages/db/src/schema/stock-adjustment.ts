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
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";
import { productVariant } from "./product-variant";

// ── Enums ──

export const adjustmentTypeEnum = pgEnum("adjustment_type", [
    "increase",
    "decrease",
    "damage",
    "loss",
    "correction",
]);

export const adjustmentReasonEnum = pgEnum("adjustment_reason", [
    "physical_count",
    "damage",
    "expired",
    "theft",
    "system_error",
    "other",
]);

export const adjustmentStatusEnum = pgEnum("adjustment_status", [
    "draft",
    "submitted",
    "approved",
    "rejected",
]);

// ── Stock Adjustment (header) ──

export const stockAdjustment = pgTable(
    "stock_adjustment",
    {
        id: serial("id").primaryKey(),

        /** Auto-generated adjustment number (ADJ-0001, ADJ-0002, ...) */
        adjustmentNo: varchar("adjustment_no", { length: 20 }).notNull().unique(),

        /** Which warehouse owns this adjustment */
        warehouseId: text("warehouse_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** Type of adjustment */
        adjustmentType: adjustmentTypeEnum("adjustment_type").notNull(),

        /** Reason for adjustment */
        reason: adjustmentReasonEnum("reason").notNull(),

        /** Optional reference/note */
        referenceNote: text("reference_note"),

        /** Date of the adjustment */
        adjustmentDate: date("adjustment_date").notNull(),

        /** Approval/workflow status */
        status: adjustmentStatusEnum("status").default("draft").notNull(),

        /** Computed: number of line items */
        totalItems: integer("total_items").default(0).notNull(),

        /** Computed: total signed quantity change (positive or negative) */
        totalQtyChange: decimal("total_qty_change", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),

        /** Who created this adjustment */
        createdById: text("created_by_id").references(() => user.id, {
            onDelete: "set null",
        }),

        ...timestamps,
    },
    (table) => [
        index("stockAdj_warehouseId_idx").on(table.warehouseId),
        index("stockAdj_status_idx").on(table.status),
        index("stockAdj_adjustmentDate_idx").on(table.adjustmentDate),
        index("stockAdj_adjustmentNo_idx").on(table.adjustmentNo),
    ],
);

// ── Stock Adjustment Item (line items) ──

export const stockAdjustmentItem = pgTable(
    "stock_adjustment_item",
    {
        id: serial("id").primaryKey(),

        /** FK to parent adjustment */
        adjustmentId: integer("adjustment_id")
            .notNull()
            .references(() => stockAdjustment.id, { onDelete: "cascade" }),

        /** Which variant is being adjusted */
        variantId: integer("variant_id")
            .notNull()
            .references(() => productVariant.id, { onDelete: "cascade" }),

        /** Snapshot of current qty at creation time */
        currentQty: decimal("current_qty", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),

        /** Signed adjustment amount (+10 or -20) */
        adjustQty: decimal("adjust_qty", { precision: 12, scale: 2 }).notNull(),

        /** Computed: currentQty + adjustQty */
        afterQty: decimal("after_qty", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),

        /** Optional per-item note */
        note: text("note"),
    },
    (table) => [
        index("stockAdjItem_adjustmentId_idx").on(table.adjustmentId),
        index("stockAdjItem_variantId_idx").on(table.variantId),
    ],
);

// ── Relations ──

export const stockAdjustmentRelations = relations(stockAdjustment, ({ one, many }) => ({
    warehouse: one(user, {
        fields: [stockAdjustment.warehouseId],
        references: [user.id],
        relationName: "adjustmentWarehouse",
    }),
    createdBy: one(user, {
        fields: [stockAdjustment.createdById],
        references: [user.id],
        relationName: "adjustmentCreator",
    }),
    items: many(stockAdjustmentItem),
}));

export const stockAdjustmentItemRelations = relations(stockAdjustmentItem, ({ one }) => ({
    adjustment: one(stockAdjustment, {
        fields: [stockAdjustmentItem.adjustmentId],
        references: [stockAdjustment.id],
    }),
    variant: one(productVariant, {
        fields: [stockAdjustmentItem.variantId],
        references: [productVariant.id],
    }),
}));

// ── Types ──

export type StockAdjustment = typeof stockAdjustment.$inferSelect;
export type NewStockAdjustment = typeof stockAdjustment.$inferInsert;
export type StockAdjustmentItem = typeof stockAdjustmentItem.$inferSelect;
export type NewStockAdjustmentItem = typeof stockAdjustmentItem.$inferInsert;
