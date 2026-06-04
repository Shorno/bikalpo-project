import { relations } from "drizzle-orm";
import {
    index,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { timestamps } from "./columns.helpers";

export const warehouseWarehouseStatusEnum = pgEnum("warehouse_warehouse_status", [
    "active",
    "pending",
    "disconnected",
]);

/**
 * Persists supplier-network relationships between two warehouse accounts.
 *
 * The buyer warehouse requests access to the supplier warehouse. Once approved,
 * the buyer can treat the supplier warehouse as part of its warehouse network.
 */
export const warehouseWarehouseConnection = pgTable(
    "warehouse_warehouse_connection",
    {
        id: serial("id").primaryKey(),

        buyerWarehouseId: text("buyer_warehouse_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        supplierWarehouseId: text("supplier_warehouse_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        status: warehouseWarehouseStatusEnum("status").default("pending").notNull(),

        connectedAt: timestamp("connected_at"),
        lastOrderedAt: timestamp("last_ordered_at"),

        ...timestamps,
    },
    (table) => [
        uniqueIndex("wwc_buyer_supplier_idx").on(
            table.buyerWarehouseId,
            table.supplierWarehouseId,
        ),
        index("wwc_buyerWarehouseId_idx").on(table.buyerWarehouseId),
        index("wwc_supplierWarehouseId_idx").on(table.supplierWarehouseId),
        index("wwc_status_idx").on(table.status),
    ],
);

export const warehouseWarehouseConnectionRelations = relations(
    warehouseWarehouseConnection,
    ({ one }) => ({
        buyerWarehouse: one(user, {
            fields: [warehouseWarehouseConnection.buyerWarehouseId],
            references: [user.id],
            relationName: "buyerWarehouseConnections",
        }),
        supplierWarehouse: one(user, {
            fields: [warehouseWarehouseConnection.supplierWarehouseId],
            references: [user.id],
            relationName: "supplierWarehouseConnections",
        }),
    }),
);

export type WarehouseWarehouseConnection =
    typeof warehouseWarehouseConnection.$inferSelect;
export type NewWarehouseWarehouseConnection =
    typeof warehouseWarehouseConnection.$inferInsert;
