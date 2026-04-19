import { relations } from "drizzle-orm";
import {
    boolean,
    index,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";

/**
 * Warehouse Storage Area — physical locations within a warehouse.
 * e.g. "Main Warehouse", "Cold Storage", "Dry Store", "Shelf A-01"
 */
export const warehouseStorageArea = pgTable(
    "warehouse_storage_area",
    {
        id: serial("id").primaryKey(),

        /** Which warehouse this area belongs to */
        warehouseId: text("warehouse_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** Display name (e.g. "Main Warehouse", "Cold Storage Room 2") */
        name: varchar("name", { length: 150 }).notNull(),

        /** Optional description or notes */
        description: text("description"),

        /** Whether this area is active */
        isActive: boolean("is_active").default(true).notNull(),

        ...timestamps,
    },
    (table) => [
        index("warehouseStorageArea_warehouseId_idx").on(table.warehouseId),
    ],
);

// === Relations ===

export const warehouseStorageAreaRelations = relations(
    warehouseStorageArea,
    ({ one }) => ({
        warehouse: one(user, {
            fields: [warehouseStorageArea.warehouseId],
            references: [user.id],
        }),
    }),
);

// === Types ===

export type WarehouseStorageArea = typeof warehouseStorageArea.$inferSelect;
export type NewWarehouseStorageArea = typeof warehouseStorageArea.$inferInsert;
