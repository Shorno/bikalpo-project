import { relations } from "drizzle-orm";
import {
    date,
    decimal,
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Daily KPI snapshot per deliveryman.
 * Auto-generated when a delivery group is closed/approved.
 * Used for performance dashboards and fraud detection.
 */
export const deliveryKpi = pgTable(
    "delivery_kpi",
    {
        id: serial("id").primaryKey(),

        /** The deliveryman this KPI is for */
        deliverymanId: text("deliveryman_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** Snapshot date */
        date: date("date").notNull(),

        // ── Delivery metrics ──
        totalDeliveries: integer("total_deliveries").default(0).notNull(),
        successful: integer("successful").default(0).notNull(),
        failed: integer("failed").default(0).notNull(),

        // ── Payment metrics ──
        totalCashCollected: decimal("total_cash_collected", {
            precision: 10,
            scale: 2,
        }).default("0").notNull(),
        totalDigitalCollected: decimal("total_digital_collected", {
            precision: 10,
            scale: 2,
        }).default("0").notNull(),
        expectedTotal: decimal("expected_total", {
            precision: 10,
            scale: 2,
        }).default("0").notNull(),

        // ── Pack metrics ──
        totalPacksCollected: integer("total_packs_collected").default(0).notNull(),
        totalPacksVerified: integer("total_packs_verified").default(0).notNull(),

        // ── Performance metrics ──
        avgDeliveryTimeMins: integer("avg_delivery_time_mins"),
        totalDistanceKm: decimal("total_distance_km", {
            precision: 10,
            scale: 2,
        }),
        successRate: decimal("success_rate", {
            precision: 5,
            scale: 2,
        }),
        onTimeRate: decimal("on_time_rate", {
            precision: 5,
            scale: 2,
        }),

        // ── Flagging ──
        fraudFlags: integer("fraud_flags").default(0).notNull(),
        flagNotes: text("flag_notes"),

        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("deliveryKpi_deliverymanId_idx").on(table.deliverymanId),
        index("deliveryKpi_date_idx").on(table.date),
    ],
);

// Relations
export const deliveryKpiRelations = relations(deliveryKpi, ({ one }) => ({
    deliveryman: one(user, {
        fields: [deliveryKpi.deliverymanId],
        references: [user.id],
    }),
}));

// Types
export type DeliveryKpi = typeof deliveryKpi.$inferSelect;
export type NewDeliveryKpi = typeof deliveryKpi.$inferInsert;
