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
 * Carton packaging configurations for a product variant.
 *
 * A product variant (e.g. "ACI + 1KG Pack @ ৳58") can have multiple
 * carton options — e.g. "10-pack carton → 10KG @ ৳580", "50-pack carton → 50KG @ ৳880".
 *
 * This table is relational (not JSONB) so that orders can FK to individual
 * carton configs for consistent pricing across the system.
 */
export const variantCartonConfig = pgTable(
    "variant_carton_config",
    {
        id: serial("id").primaryKey(),

        /** Parent product variant (brand × variant option specific) */
        productVariantId: integer("product_variant_id")
            .notNull()
            .references(() => productVariant.id, { onDelete: "cascade" }),

        /** Number of packs in this carton (e.g. 10, 50) */
        packCount: integer("pack_count").notNull(),

        /** Total weight of the carton in KG (e.g. 10KG for 10×1KG, 50KG for 50×1KG) */
        totalWeightKg: decimal("total_weight_kg", {
            precision: 10,
            scale: 2,
        }).notNull(),

        /** Price for the entire carton (e.g. ৳580 for a 10-pack carton) */
        cartonPrice: decimal("carton_price", {
            precision: 10,
            scale: 2,
        }).notNull(),

        /** Display sort order */
        sortOrder: integer("sort_order").default(0).notNull(),

        /** Whether this carton config is active */
        isActive: boolean("is_active").default(true).notNull(),

        ...timestamps,
    },
    (table) => [
        index("cartonConfig_variantId_idx").on(table.productVariantId),
    ],
);

// === Relations ===

export const variantCartonConfigRelations = relations(
    variantCartonConfig,
    ({ one }) => ({
        productVariant: one(productVariant, {
            fields: [variantCartonConfig.productVariantId],
            references: [productVariant.id],
        }),
    }),
);

// === Types ===

export type VariantCartonConfig = typeof variantCartonConfig.$inferSelect;
export type NewVariantCartonConfig = typeof variantCartonConfig.$inferInsert;
