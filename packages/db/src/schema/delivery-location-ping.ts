import { relations } from "drizzle-orm";
import {
    decimal,
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { deliveryGroup } from "./delivery";

/**
 * Periodic GPS location pings during delivery route.
 * Sent every ~60 seconds from the deliveryman's browser.
 * Used for route tracking, distance calculation, and fraud detection.
 */
export const deliveryLocationPing = pgTable(
    "delivery_location_ping",
    {
        id: serial("id").primaryKey(),

        /** Which delivery group this ping belongs to */
        groupId: integer("group_id")
            .notNull()
            .references(() => deliveryGroup.id, { onDelete: "cascade" }),

        /** Deliveryman who sent the ping */
        deliverymanId: text("deliveryman_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        lat: decimal("lat", { precision: 10, scale: 7 }).notNull(),
        lng: decimal("lng", { precision: 10, scale: 7 }).notNull(),

        /** GPS accuracy in meters */
        accuracy: decimal("accuracy", { precision: 8, scale: 2 }),

        /** Speed in km/h (if available from browser) */
        speed: decimal("speed", { precision: 6, scale: 2 }),

        /** Battery percentage (if available) */
        batteryLevel: integer("battery_level"),

        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("locationPing_groupId_idx").on(table.groupId),
        index("locationPing_deliverymanId_idx").on(table.deliverymanId),
        index("locationPing_createdAt_idx").on(table.createdAt),
    ],
);

// Relations
export const deliveryLocationPingRelations = relations(
    deliveryLocationPing,
    ({ one }) => ({
        group: one(deliveryGroup, {
            fields: [deliveryLocationPing.groupId],
            references: [deliveryGroup.id],
        }),
        deliveryman: one(user, {
            fields: [deliveryLocationPing.deliverymanId],
            references: [user.id],
        }),
    }),
);

// Types
export type DeliveryLocationPing = typeof deliveryLocationPing.$inferSelect;
export type NewDeliveryLocationPing = typeof deliveryLocationPing.$inferInsert;
