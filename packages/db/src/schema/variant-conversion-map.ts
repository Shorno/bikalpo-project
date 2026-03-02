import { relations } from "drizzle-orm";
import {
    boolean,
    decimal,
    index,
    integer,
    pgTable,
    serial,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { productVariant } from "./product-variant";

/**
 * Variant conversion map — defines how TRADE variants convert to RETAIL variants.
 * E.g. 1 Carton (TRADE) = 10 × 5kg Packs (RETAIL)
 * E.g. 1 Sack (TRADE) = 50 KG Loose (RETAIL)
 */
export const variantConversionMap = pgTable(
    "variant_conversion_map",
    {
        id: serial("id").primaryKey(),

        /** Source variant (typically TRADE) */
        fromVariantId: integer("from_variant_id")
            .notNull()
            .references(() => productVariant.id, { onDelete: "cascade" }),

        /** Destination variant (typically RETAIL) */
        toVariantId: integer("to_variant_id")
            .notNull()
            .references(() => productVariant.id, { onDelete: "cascade" }),

        /** How many destination units per 1 source unit (e.g. 10 packs per carton) */
        conversionRatio: decimal("conversion_ratio", {
            precision: 10,
            scale: 2,
        }).notNull(),

        /** Whether conversion happens automatically on B2B purchase */
        autoConvert: boolean("auto_convert").default(true).notNull(),

        ...timestamps,
    },
    (table) => [
        index("conversionMap_from_idx").on(table.fromVariantId),
        index("conversionMap_to_idx").on(table.toVariantId),
    ],
);

export const variantConversionMapRelations = relations(
    variantConversionMap,
    ({ one }) => ({
        fromVariant: one(productVariant, {
            fields: [variantConversionMap.fromVariantId],
            references: [productVariant.id],
            relationName: "conversionFrom",
        }),
        toVariant: one(productVariant, {
            fields: [variantConversionMap.toVariantId],
            references: [productVariant.id],
            relationName: "conversionTo",
        }),
    }),
);

export type VariantConversionMap = typeof variantConversionMap.$inferSelect;
export type NewVariantConversionMap = typeof variantConversionMap.$inferInsert;
