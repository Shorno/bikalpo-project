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
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";
import { productVariant } from "./product-variant";
import { supplier } from "./supplier";
import { warehouseStorageArea } from "./warehouse-storage-area";
import { cartonConfig } from "./carton-config";

/** Entry type: how stock was counted when entering */
export const stockEntryTypeEnum = pgEnum("stock_entry_type", [
    "loose",
    "pack",
    "carton",
]);

/** Cost type: how the purchase price was quoted */
export const stockEntryCostTypeEnum = pgEnum("stock_entry_cost_type", [
    "per_kg",
    "per_pack",
    "per_carton",
]);

/**
 * Stock Entry — a single stock-in event for a warehouse.
 * Each row represents one batch of stock added to inventory.
 * Creates an audit trail of all stock additions with cost, supplier, and batch info.
 */
export const stockEntry = pgTable(
    "stock_entry",
    {
        id: serial("id").primaryKey(),

        /** Which warehouse added this stock */
        warehouseId: text("warehouse_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** Which variant is being stocked */
        variantId: integer("variant_id")
            .notNull()
            .references(() => productVariant.id, { onDelete: "cascade" }),

        /** How the stock was entered: loose (by KG) or pack (by pack count) */
        entryType: stockEntryTypeEnum("entry_type").notNull(),

        /** Entered quantity in the chosen unit */
        quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),

        /** Unit of the entered quantity (e.g. "KG", "Pack") */
        quantityUnit: varchar("quantity_unit", { length: 20 }).notNull(),

        /** Converted quantity in KG (always computed for unified tracking) */
        convertedQtyKg: decimal("converted_qty_kg", { precision: 12, scale: 2 }).notNull(),

        /** Converted quantity in packs (always computed for unified tracking) */
        convertedQtyPacks: decimal("converted_qty_packs", { precision: 12, scale: 2 }).notNull(),

        // === Supplier & Cost ===

        /** Which supplier provided this stock */
        supplierId: integer("supplier_id")
            .notNull()
            .references(() => supplier.id, { onDelete: "restrict" }),

        /** How the purchase price was quoted */
        costType: stockEntryCostTypeEnum("cost_type").notNull(),

        /** Purchase price per unit (per KG or per Pack) */
        purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }).notNull(),

        /** Total cost for this entire entry */
        totalCost: decimal("total_cost", { precision: 12, scale: 2 }).notNull(),

        /** Invoice or challan reference number */
        reference: varchar("reference", { length: 150 }),

        // === Batch / Expiry ===

        /** Batch tracking number */
        batchNo: varchar("batch_no", { length: 100 }),

        /** Product expiry date */
        expiryDate: date("expiry_date"),

        /** Manufacture date */
        manufactureDate: date("manufacture_date"),

        // === Storage Location ===

        /** FK to warehouse storage area */
        storageAreaId: integer("storage_area_id")
            .references(() => warehouseStorageArea.id, { onDelete: "set null" }),

        /** Shelf or rack identifier (e.g. "A-01", "Rack 3B") */
        shelfRack: varchar("shelf_rack", { length: 100 }),

        /** Optional note */
        note: text("note"),

        // === Carton Entry Fields ===

        /** Number of cartons entered (when entryType = 'carton') */
        cartonCount: integer("carton_count"),

        /** Which carton config was used for this carton entry */
        cartonConfigId: integer("carton_config_id")
            .references(() => cartonConfig.id, { onDelete: "set null" }),

        /** Converted quantity in cartons (always computed when carton config exists) */
        convertedQtyCartons: decimal("converted_qty_cartons", { precision: 12, scale: 2 }),

        ...timestamps,
    },
    (table) => [
        index("stockEntry_warehouseId_idx").on(table.warehouseId),
        index("stockEntry_variantId_idx").on(table.variantId),
        index("stockEntry_supplierId_idx").on(table.supplierId),
    ],
);

// === Relations ===

export const stockEntryRelations = relations(stockEntry, ({ one }) => ({
    warehouse: one(user, {
        fields: [stockEntry.warehouseId],
        references: [user.id],
    }),
    variant: one(productVariant, {
        fields: [stockEntry.variantId],
        references: [productVariant.id],
    }),
    supplier: one(supplier, {
        fields: [stockEntry.supplierId],
        references: [supplier.id],
    }),
    storageArea: one(warehouseStorageArea, {
        fields: [stockEntry.storageAreaId],
        references: [warehouseStorageArea.id],
    }),
}));

// === Types ===

export type StockEntry = typeof stockEntry.$inferSelect;
export type NewStockEntry = typeof stockEntry.$inferInsert;
