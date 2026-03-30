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
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";

/**
 * Shop↔Warehouse connection status.
 *  - active: subcategory match found, shop can order
 *  - pending: no match, awaiting admin approval
 *  - disconnected: manually disconnected
 */
export const shopWarehouseStatusEnum = pgEnum("shop_warehouse_status", [
    "active",
    "pending",
    "disconnected",
]);

/**
 * Persists the relationship between a Shop and a Warehouse.
 *
 * Created when a shop first connects to a warehouse (Step 2).
 * Status determined by the category matching engine (Step 3).
 * `lastOrderedAt` drives the "Recent Warehouses" smart memory (Step 7).
 */
export const shopWarehouseConnection = pgTable(
    "shop_warehouse_connection",
    {
        id: serial("id").primaryKey(),

        /** The shop user */
        shopId: text("shop_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** The warehouse user */
        warehouseId: text("warehouse_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** Connection status based on category matching */
        status: shopWarehouseStatusEnum("status").default("pending").notNull(),

        /** When the connection was first established */
        connectedAt: timestamp("connected_at").defaultNow(),

        /** Last time the shop placed an order to this warehouse (for sorting) */
        lastOrderedAt: timestamp("last_ordered_at"),

        ...timestamps,
    },
    (table) => [
        uniqueIndex("swc_shop_warehouse_idx").on(table.shopId, table.warehouseId),
        index("swc_shopId_idx").on(table.shopId),
        index("swc_warehouseId_idx").on(table.warehouseId),
        index("swc_status_idx").on(table.status),
    ],
);

export const shopWarehouseConnectionRelations = relations(
    shopWarehouseConnection,
    ({ one }) => ({
        shop: one(user, {
            fields: [shopWarehouseConnection.shopId],
            references: [user.id],
            relationName: "shopConnections",
        }),
        warehouse: one(user, {
            fields: [shopWarehouseConnection.warehouseId],
            references: [user.id],
            relationName: "warehouseConnections",
        }),
    }),
);

export type ShopWarehouseConnection = typeof shopWarehouseConnection.$inferSelect;
export type NewShopWarehouseConnection = typeof shopWarehouseConnection.$inferInsert;
