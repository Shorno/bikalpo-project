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
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";
import { productVariant } from "./product-variant";
import { inventory } from "./inventory";

// ── Enums ──

export const damageTypeEnum = pgEnum("damage_type", [
    "physical",
    "expired",
    "lost",
]);

export const damageStatusEnum = pgEnum("damage_status", [
    "active",
    "cancelled",
]);

// ── Damage Entry (header) ──

export const damageEntry = pgTable(
    "damage_entry",
    {
        id: serial("id").primaryKey(),

        /** Auto-generated entry number (DMG-0001, DMG-0002, ...) */
        entryNo: text("entry_no").notNull().unique(),

        /** Which shop owns this entry */
        shopId: text("shop_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** Type of damage */
        damageType: damageTypeEnum("damage_type").notNull(),

        /** Free-text description */
        description: text("description"),

        /** Cloudinary proof image URLs (JSON array) */
        proofImages: text("proof_images")
            .array()
            .default([])
            .notNull(),

        /** Total damaged quantity (sum of items) */
        totalQty: integer("total_qty").default(0).notNull(),

        /** Total financial loss (sum of item values) */
        totalLossValue: decimal("total_loss_value", {
            precision: 12,
            scale: 2,
        })
            .default("0")
            .notNull(),

        /** Staff who entered this damage */
        enteredByName: text("entered_by_name"),

        /** Date when damage occurred */
        entryDate: date("entry_date").notNull(),

        /** Active or cancelled */
        status: damageStatusEnum("status").default("active").notNull(),

        /** User who created the entry */
        createdById: text("created_by_id").references(() => user.id, {
            onDelete: "set null",
        }),

        ...timestamps,
    },
    (table) => [
        index("damageEntry_shopId_idx").on(table.shopId),
        index("damageEntry_status_idx").on(table.status),
        index("damageEntry_entryDate_idx").on(table.entryDate),
        index("damageEntry_entryNo_idx").on(table.entryNo),
    ],
);

// ── Damage Entry Item (line items) ──

export const damageEntryItem = pgTable(
    "damage_entry_item",
    {
        id: serial("id").primaryKey(),

        /** FK to parent damage entry */
        damageEntryId: integer("damage_entry_id")
            .notNull()
            .references(() => damageEntry.id, { onDelete: "cascade" }),

        /** Which inventory row */
        inventoryId: integer("inventory_id")
            .notNull()
            .references(() => inventory.id, { onDelete: "cascade" }),

        /** Which variant */
        variantId: integer("variant_id")
            .notNull()
            .references(() => productVariant.id, { onDelete: "cascade" }),

        /** Damaged quantity */
        qty: integer("qty").notNull(),

        /** Unit price at time of entry */
        unitPrice: decimal("unit_price", { precision: 10, scale: 2 })
            .default("0")
            .notNull(),

        /** Calculated: qty × unitPrice */
        totalValue: decimal("total_value", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),

        /** Per-item note */
        note: text("note"),
    },
    (table) => [
        index("damageItem_entryId_idx").on(table.damageEntryId),
        index("damageItem_variantId_idx").on(table.variantId),
    ],
);

// ── Relations ──

export const damageEntryRelations = relations(damageEntry, ({ one, many }) => ({
    shop: one(user, {
        fields: [damageEntry.shopId],
        references: [user.id],
        relationName: "damageEntryShop",
    }),
    createdBy: one(user, {
        fields: [damageEntry.createdById],
        references: [user.id],
        relationName: "damageEntryCreator",
    }),
    items: many(damageEntryItem),
}));

export const damageEntryItemRelations = relations(
    damageEntryItem,
    ({ one }) => ({
        damageEntry: one(damageEntry, {
            fields: [damageEntryItem.damageEntryId],
            references: [damageEntry.id],
        }),
        variant: one(productVariant, {
            fields: [damageEntryItem.variantId],
            references: [productVariant.id],
        }),
        inventory: one(inventory, {
            fields: [damageEntryItem.inventoryId],
            references: [inventory.id],
        }),
    }),
);

// ── Types ──

export type DamageEntry = typeof damageEntry.$inferSelect;
export type NewDamageEntry = typeof damageEntry.$inferInsert;
export type DamageEntryItem = typeof damageEntryItem.$inferSelect;
export type NewDamageEntryItem = typeof damageEntryItem.$inferInsert;
