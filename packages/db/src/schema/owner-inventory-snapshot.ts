import {
    decimal,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";
import { inventoryOwnerTypeEnum } from "./inventory";

/**
 * Month-by-month record of an owner's stock value for the Products page KPIs.
 * The current month's row is overwritten as the value changes, so once the
 * month ends it holds the value from the month's last write.
 */
export const ownerInventorySnapshot = pgTable(
    "owner_inventory_snapshot",
    {
        id: serial("id").primaryKey(),
        ownerType: inventoryOwnerTypeEnum("owner_type").notNull(),
        ownerId: text("owner_id").notNull(),
        /** Bangladesh calendar month, "YYYY-MM". */
        month: text("month").notNull(),
        /** Σ available quantity × selling price over the owner's products. */
        inventoryValue: decimal("inventory_value", { precision: 16, scale: 2 })
            .default("0")
            .notNull(),
        productCount: integer("product_count").default(0).notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        uniqueIndex("owner_inventory_snapshot_owner_month_unique").on(
            table.ownerType,
            table.ownerId,
            table.month,
        ),
    ],
);

export type OwnerInventorySnapshot = typeof ownerInventorySnapshot.$inferSelect;
