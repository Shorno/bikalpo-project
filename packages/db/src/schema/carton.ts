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
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";
import { productVariant } from "./product-variant";
import { cartonConfig } from "./carton-config";
import { orderItem } from "./order";
import { warehouseStorageArea } from "./warehouse-storage-area";

/**
 * Status of a physical carton in the warehouse.
 * - active: carton is packed and available
 * - broken: carton has been decomposed back into packs
 * - dispatched: carton has been sent out for delivery
 * - sold: carton has been sold/delivered
 */
export const cartonStatusEnum = pgEnum("carton_status", [
    "active",
    "reserved",
    "broken",
    "dispatched",
    "sold",
]);

/**
 * Physical Carton — an actual carton created in the warehouse.
 *
 * Single-product cartons only (V1). Each carton contains packs of ONE variant.
 * Cartons are IMMUTABLE once created — to fix a mistake, you must "Break Carton"
 * (decompose back to packs) and create a new one.
 *
 * Stock flow:
 *   Create Carton → deduct from loose/pack stock → add to in-carton stock
 *   Break Carton  → deduct from in-carton stock → return to loose/pack stock
 */
export const carton = pgTable(
    "carton",
    {
        id: serial("id").primaryKey(),

        /**
         * Human-readable unique carton ID.
         * Format: CTN-YYYY-NNNNNN (e.g. CTN-2026-000123)
         */
        cartonId: varchar("carton_id", { length: 30 }).notNull().unique(),

        /** Which warehouse created this carton */
        warehouseId: text("warehouse_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** Which carton config template was used */
        cartonConfigId: integer("carton_config_id")
            .references(() => cartonConfig.id, { onDelete: "set null" }),

        /** Which variant this carton contains (single-product only) */
        variantId: integer("variant_id")
            .notNull()
            .references(() => productVariant.id, { onDelete: "cascade" }),

        /** Total pack count inside this carton */
        totalPacks: integer("total_packs").notNull(),

        /** Total weight of carton in KG */
        totalWeightKg: decimal("total_weight_kg", {
            precision: 12,
            scale: 2,
        }).notNull(),

        /** Current status of the carton */
        status: cartonStatusEnum("status").default("active").notNull(),

        /** Approved order line that owns this physical carton reservation. */
        reservedForOrderItemId: integer("reserved_for_order_item_id").references(
            () => orderItem.id,
            { onDelete: "set null" },
        ),
        reservedAt: timestamp("reserved_at"),

        /** Auto-generated barcode value */
        barcode: varchar("barcode", { length: 100 }),

        /** Auto-generated QR code value */
        qrCode: varchar("qr_code", { length: 255 }),

        /** When carton was broken apart (null if not broken) */
        brokenAt: timestamp("broken_at"),

        /** Who broke this carton (null if not broken) */
        brokenById: text("broken_by_id").references(() => user.id, {
            onDelete: "set null",
        }),

        /** Storage location in warehouse */
        storageAreaId: integer("storage_area_id").references(
            () => warehouseStorageArea.id,
            { onDelete: "set null" },
        ),

        /** Optional note */
        note: text("note"),

        /** Override carton selling price (null = use config default) */
        cartonPrice: decimal("carton_price", {
            precision: 10,
            scale: 2,
        }),

        /** Delivery cost per unit/carton */
        deliveryCostPerUnit: decimal("delivery_cost_per_unit", {
            precision: 10,
            scale: 2,
        }),

        /** Whether creation explicitly overrode the selected configuration price */
        cartonPriceOverridden: boolean("carton_price_overridden")
            .default(false)
            .notNull(),

        /** Whether creation explicitly overrode the selected configuration delivery cost */
        deliveryCostOverridden: boolean("delivery_cost_overridden")
            .default(false)
            .notNull(),

        /** Required audit explanation when either configuration price is overridden */
        overrideReason: text("override_reason"),

        ...timestamps,
    },
    (table) => [
        index("carton_warehouseId_idx").on(table.warehouseId),
        index("carton_variantId_idx").on(table.variantId),
        index("carton_status_idx").on(table.status),
        index("carton_reservedOrderItem_idx").on(table.reservedForOrderItemId),
        index("carton_cartonId_idx").on(table.cartonId),
    ],
);

// === Relations ===

export const cartonRelations = relations(carton, ({ one }) => ({
    warehouse: one(user, {
        fields: [carton.warehouseId],
        references: [user.id],
        relationName: "cartonWarehouse",
    }),
    config: one(cartonConfig, {
        fields: [carton.cartonConfigId],
        references: [cartonConfig.id],
    }),
    variant: one(productVariant, {
        fields: [carton.variantId],
        references: [productVariant.id],
    }),
    reservedForOrderItem: one(orderItem, {
        fields: [carton.reservedForOrderItemId],
        references: [orderItem.id],
    }),
    brokenBy: one(user, {
        fields: [carton.brokenById],
        references: [user.id],
        relationName: "cartonBrokenBy",
    }),
    storageArea: one(warehouseStorageArea, {
        fields: [carton.storageAreaId],
        references: [warehouseStorageArea.id],
    }),
}));

// === Types ===

export type Carton = typeof carton.$inferSelect;
export type NewCarton = typeof carton.$inferInsert;
