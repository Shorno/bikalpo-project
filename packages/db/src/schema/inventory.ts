import { relations } from "drizzle-orm";
import {
    decimal,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
} from "drizzle-orm/pg-core";
import { productVariant } from "./product-variant";

/**
 * Owner type for inventory: who holds this stock
 * - super_seller: Admin/dealer warehouse stock (TRADE variants)
 * - shop: Shop owner stock (RETAIL variants after conversion)
 */
export const inventoryOwnerTypeEnum = pgEnum("inventory_owner_type", [
    "super_seller",
    "shop",
    "warehouse",
]);

/**
 * Owner-based inventory table — live snapshot of current stock.
 * Same product/variant can exist in multiple owners' inventories.
 */
export const inventory = pgTable(
    "inventory",
    {
        id: serial("id").primaryKey(),

        /** Who owns this stock */
        ownerType: inventoryOwnerTypeEnum("owner_type").notNull(),

        /** Owner ID — userId for super_seller, userId for shop owner */
        ownerId: text("owner_id").notNull(),

        /** Which variant this stock belongs to */
        variantId: integer("variant_id")
            .notNull()
            .references(() => productVariant.id, { onDelete: "cascade" }),

        /** Currently available quantity (can be sold) */
        availableQty: decimal("available_qty", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),

        /** Reserved quantity (locked by pending orders) */
        reservedQty: decimal("reserved_qty", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),

        /** Shop owner's retail selling price (set by shop owner) */
        retailPrice: decimal("retail_price", { precision: 10, scale: 2 }),

        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("inventory_owner_idx").on(table.ownerType, table.ownerId),
        index("inventory_variant_idx").on(table.variantId),
        index("inventory_owner_variant_idx").on(
            table.ownerType,
            table.ownerId,
            table.variantId,
        ),
    ],
);

export const inventoryRelations = relations(inventory, ({ one }) => ({
    variant: one(productVariant, {
        fields: [inventory.variantId],
        references: [productVariant.id],
    }),
}));

export type Inventory = typeof inventory.$inferSelect;
export type NewInventory = typeof inventory.$inferInsert;
