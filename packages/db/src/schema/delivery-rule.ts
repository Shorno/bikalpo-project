import {
    boolean,
    decimal,
    integer,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";

/**
 * Delivery rules — separate from product variants (e.g. managed in a separate tab).
 * Used at checkout to calculate "Delivery charges may or may not be applicable
 * and will be calculated and shown at the time of checkout."
 */
export const deliveryRule = pgTable("delivery_rule", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 150 }), // e.g. "Standard", "Express"

    // Optional: scope by area (null = applies to all areas)
    area: varchar("area", { length: 100 }),

    // Weight band (kg): rule applies when order total weight is in [minWeightKg, maxWeightKg]
    minWeightKg: decimal("min_weight_kg", { precision: 10, scale: 2 }),
    maxWeightKg: decimal("max_weight_kg", { precision: 10, scale: 2 }),

    // Cost: base + per-kg (e.g. base 50, per kg 2 → 50 + 2 * weight)
    baseCost: decimal("base_cost", { precision: 10, scale: 2 })
        .default("0")
        .notNull(),
    perKgCost: decimal("per_kg_cost", { precision: 10, scale: 2 })
        .default("0")
        .notNull(),

    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    note: text("note"),

    ...timestamps,
});

export type DeliveryRule = typeof deliveryRule.$inferSelect;
export type NewDeliveryRule = typeof deliveryRule.$inferInsert;
