import { relations } from "drizzle-orm";
import {
    boolean,
    decimal,
    index,
    integer,
    pgTable,
    serial,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { productVariant } from "./product-variant";

/**
 * Carton Configuration — defines how many packs fit in a carton and the pricing.
 *
 * A single variant can have multiple carton configs.
 * E.g. "ACI 1KG Pack" → Carton of 10 (৳580) + Carton of 50 (৳880)
 *
 * This is the TEMPLATE / PRICING layer. Physical cartons reference these configs
 * when they are created in the warehouse.
 */
export const cartonConfig = pgTable(
    "carton_config",
    {
        id: serial("id").primaryKey(),

        /** Which product variant this config belongs to */
        variantId: integer("variant_id")
            .notNull()
            .references(() => productVariant.id, { onDelete: "cascade" }),

        /** Number of packs in one carton */
        packsPerCarton: integer("packs_per_carton").notNull(),

        /**
         * Total weight of one carton in KG.
         * Auto-calculated: packsPerCarton × variant.weightKg
         * Stored for quick access and display.
         */
        cartonWeightKg: decimal("carton_weight_kg", {
            precision: 12,
            scale: 2,
        }).notNull(),

        /** Carton selling price */
        cartonPrice: decimal("carton_price", {
            precision: 10,
            scale: 2,
        }).notNull(),

        /** Carton purchase/cost price (optional, for margin calculation) */
        cartonCostPrice: decimal("carton_cost_price", {
            precision: 10,
            scale: 2,
        }),

        /** Delivery cost for this specific carton config */
        deliveryCostPerCarton: decimal("delivery_cost_per_carton", {
            precision: 10,
            scale: 2,
        }),

        /**
         * Display label e.g. "10 Pack Carton", "50 Pack Carton"
         * Auto-generated but can be overridden.
         */
        label: varchar("label", { length: 100 }),

        /** If multiple configs exist, which one is the default for this variant */
        isDefault: boolean("is_default").default(false).notNull(),

        /** Whether this config is active */
        isActive: boolean("is_active").default(true).notNull(),

        ...timestamps,
    },
    (table) => [
        index("cartonConfig_variantId_idx").on(table.variantId),
    ],
);

// === Relations ===

export const cartonConfigRelations = relations(cartonConfig, ({ one }) => ({
    variant: one(productVariant, {
        fields: [cartonConfig.variantId],
        references: [productVariant.id],
    }),
}));

// === Types ===

export type CartonConfig = typeof cartonConfig.$inferSelect;
export type NewCartonConfig = typeof cartonConfig.$inferInsert;
