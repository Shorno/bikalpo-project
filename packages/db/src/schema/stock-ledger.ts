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
import { user } from "./auth-schema";

/**
 * Stock ledger change types — every stock movement creates an immutable record.
 */
export const stockLedgerChangeTypeEnum = pgEnum("stock_ledger_change_type", [
    "in",           // Stock added (purchase, import)
    "out",          // Stock removed (sale, dispatch)
    "convert_in",   // Stock gained from conversion (TRADE → RETAIL)
    "convert_out",  // Stock consumed by conversion
    "damage",       // Stock lost to damage
    "return",       // Stock returned (customer return)
    "adjust",       // Manual admin adjustment
]);

/**
 * Reference type — what triggered this stock change.
 */
export const stockLedgerRefTypeEnum = pgEnum("stock_ledger_ref_type", [
    "order",
    "return",
    "damage",
    "manual",
    "conversion",
    "invoice",
]);

/**
 * Immutable stock ledger — EVERY stock change must create a ledger entry.
 * Records cannot be edited or deleted. balance_after stored for audit.
 */
export const stockLedger = pgTable(
    "stock_ledger",
    {
        id: serial("id").primaryKey(),

        /** Which variant changed */
        variantId: integer("variant_id")
            .notNull()
            .references(() => productVariant.id, { onDelete: "restrict" }),

        /** Stock owner */
        ownerType: text("owner_type").notNull(), // "super_seller" | "shop"
        ownerId: text("owner_id").notNull(),

        /** What happened */
        changeType: stockLedgerChangeTypeEnum("change_type").notNull(),

        /** Quantity changed (always positive — direction determined by changeType) */
        qty: decimal("qty", { precision: 12, scale: 2 }).notNull(),

        /** Human-readable reason */
        reason: text("reason"),

        /** What triggered this change */
        referenceType: stockLedgerRefTypeEnum("reference_type"),
        referenceId: text("reference_id"),

        /** Balance after this change — for audit trail */
        balanceAfter: decimal("balance_after", { precision: 12, scale: 2 }).notNull(),

        /** Who performed this action (null for system-triggered) */
        createdById: text("created_by_id").references(() => user.id, {
            onDelete: "set null",
        }),

        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("stockLedger_variant_idx").on(table.variantId),
        index("stockLedger_owner_idx").on(table.ownerType, table.ownerId),
        index("stockLedger_createdAt_idx").on(table.createdAt),
        index("stockLedger_ref_idx").on(table.referenceType, table.referenceId),
    ],
);

export const stockLedgerRelations = relations(stockLedger, ({ one }) => ({
    variant: one(productVariant, {
        fields: [stockLedger.variantId],
        references: [productVariant.id],
    }),
    createdBy: one(user, {
        fields: [stockLedger.createdById],
        references: [user.id],
    }),
}));

export type StockLedger = typeof stockLedger.$inferSelect;
export type NewStockLedger = typeof stockLedger.$inferInsert;
