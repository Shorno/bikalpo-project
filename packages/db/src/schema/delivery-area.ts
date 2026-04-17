import { relations } from "drizzle-orm";
import {
    boolean,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";

// Delivery area status enum
export const deliveryAreaStatusEnum = pgEnum("delivery_area_status", [
    "active",
    "inactive",
]);

/**
 * Warehouse-scoped delivery areas — defines geographic boundaries for delivery scheduling.
 * Each warehouse defines its own set of delivery areas with polygon/radius boundaries.
 * Uses Barikoi API for location search and polygon drawing.
 */
export const deliveryArea = pgTable(
    "delivery_area",
    {
        id: serial("id").primaryKey(),

        /** Which warehouse this area belongs to */
        warehouseId: text("warehouse_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        name: varchar("name", { length: 150 }).notNull(),
        slug: varchar("slug", { length: 150 }).notNull(),
        description: text("description"),

        /** GeoJSON polygon coordinates [[[lng, lat], ...]] */
        polygon: jsonb("polygon").$type<number[][][]>(),

        /** Center point for map display and radius-based areas */
        centerLat: text("center_lat"),
        centerLng: text("center_lng"),

        /** Radius in km for radius-based areas */
        radiusKm: text("radius_km"),

        status: deliveryAreaStatusEnum("status").default("active").notNull(),
        sortOrder: integer("sort_order").default(0).notNull(),

        ...timestamps,
    },
    (table) => [
        index("deliveryArea_warehouseId_idx").on(table.warehouseId),
        index("deliveryArea_slug_idx").on(table.slug),
    ],
);

/**
 * Weekly delivery schedule — which days each area gets deliveries.
 * Each entry represents one day-of-week assignment for an area.
 */
export const deliverySchedule = pgTable(
    "delivery_schedule",
    {
        id: serial("id").primaryKey(),

        /** Which delivery area this schedule belongs to */
        areaId: integer("area_id")
            .notNull()
            .references(() => deliveryArea.id, { onDelete: "cascade" }),

        /** Which warehouse (denormalized for efficient queries) */
        warehouseId: text("warehouse_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday */
        dayOfWeek: integer("day_of_week").notNull(),

        /** Default rider assigned for this day/area (optional) */
        defaultRiderId: text("default_rider_id").references(() => user.id, {
            onDelete: "set null",
        }),

        isActive: boolean("is_active").default(true).notNull(),

        ...timestamps,
    },
    (table) => [
        index("deliverySchedule_areaId_idx").on(table.areaId),
        index("deliverySchedule_warehouseId_idx").on(table.warehouseId),
        index("deliverySchedule_dayOfWeek_idx").on(table.dayOfWeek),
    ],
);

// ── Relations ──

export const deliveryAreaRelations = relations(deliveryArea, ({ many }) => ({
    schedules: many(deliverySchedule),
}));

export const deliveryScheduleRelations = relations(
    deliverySchedule,
    ({ one }) => ({
        area: one(deliveryArea, {
            fields: [deliverySchedule.areaId],
            references: [deliveryArea.id],
        }),
        defaultRider: one(user, {
            fields: [deliverySchedule.defaultRiderId],
            references: [user.id],
        }),
    }),
);

// ── Types ──

export type DeliveryArea = typeof deliveryArea.$inferSelect;
export type NewDeliveryArea = typeof deliveryArea.$inferInsert;
export type DeliverySchedule = typeof deliverySchedule.$inferSelect;
export type NewDeliverySchedule = typeof deliverySchedule.$inferInsert;
export type DeliveryAreaStatus =
    (typeof deliveryAreaStatusEnum.enumValues)[number];
