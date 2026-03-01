import { relations } from "drizzle-orm";
import {
    boolean,
    decimal,
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
} from "drizzle-orm/pg-core";
import { product } from "./product";

/**
 * Product pack rules — seller-overridable pack return configuration.
 * 
 * Priority logic:
 * 1. If shop-level rule exists → use shop rule
 * 2. Else if super_seller rule exists → use super seller rule
 * 3. Else → use product default (product.is_returnable_pack)
 */
export const productPackRule = pgTable(
    "product_pack_rule",
    {
        id: serial("id").primaryKey(),

        /** Which product this rule applies to */
        productId: integer("product_id")
            .notNull()
            .references(() => product.id, { onDelete: "cascade" }),

        /** Who set this rule: "super_seller" or "shop" */
        ownerType: text("owner_type").notNull(),

        /** Owner's user ID */
        ownerId: text("owner_id").notNull(),

        /** Whether empty pack is returnable */
        isEmptyPackReturnable: boolean("is_empty_pack_returnable")
            .default(true)
            .notNull(),

        /** Value/deposit for the empty pack */
        emptyPackValue: decimal("empty_pack_value", {
            precision: 10,
            scale: 2,
        }).default("0"),

        /** Is this rule active */
        isActive: boolean("is_active").default(true).notNull(),

        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("packRule_product_idx").on(table.productId),
        index("packRule_owner_idx").on(table.ownerType, table.ownerId),
        index("packRule_product_owner_idx").on(
            table.productId,
            table.ownerType,
            table.ownerId,
        ),
    ],
);

export const productPackRuleRelations = relations(
    productPackRule,
    ({ one }) => ({
        product: one(product, {
            fields: [productPackRule.productId],
            references: [product.id],
        }),
    }),
);

export type ProductPackRule = typeof productPackRule.$inferSelect;
export type NewProductPackRule = typeof productPackRule.$inferInsert;
