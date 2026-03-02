import { relations } from "drizzle-orm";
import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";

/**
 * Service areas/zones — defines geographic boundaries for seller permissions and delivery.
 * Areas can be polygons, radius-based, or simple named zones.
 */
export const area = pgTable("area", {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 150 }).notNull().unique(),
    description: text("description"),

    /** Parent area for hierarchical zones (e.g. City → District → Ward) */
    parentId: integer("parent_id"),

    /** GeoJSON polygon coordinates for map-based areas */
    polygon: jsonb("polygon").$type<number[][][]>(),

    /** Center point for radius-based areas */
    centerLat: text("center_lat"),
    centerLng: text("center_lng"),

    /** Radius in km for radius-based areas */
    radiusKm: text("radius_km"),

    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),

    ...timestamps,
});

/**
 * Seller-area mapping — which sellers can operate in which areas.
 */
export const sellerAreaMapping = pgTable(
    "seller_area_mapping",
    {
        id: serial("id").primaryKey(),

        /** Shop owner user ID */
        sellerId: text("seller_id").notNull(),

        /** Area this seller is permitted in */
        areaId: integer("area_id")
            .notNull()
            .references(() => area.id, { onDelete: "cascade" }),

        /** Override radius for this specific seller (null = use area default) */
        overrideRadiusKm: text("override_radius_km"),

        isActive: boolean("is_active").default(true).notNull(),

        ...timestamps,
    },
    (table) => [
        index("sellerArea_seller_idx").on(table.sellerId),
        index("sellerArea_area_idx").on(table.areaId),
    ],
);

export const areaRelations = relations(area, ({ many, one }) => ({
    children: many(area, { relationName: "areaHierarchy" }),
    parent: one(area, {
        fields: [area.parentId],
        references: [area.id],
        relationName: "areaHierarchy",
    }),
    sellerMappings: many(sellerAreaMapping),
}));

export const sellerAreaMappingRelations = relations(
    sellerAreaMapping,
    ({ one }) => ({
        area: one(area, {
            fields: [sellerAreaMapping.areaId],
            references: [area.id],
        }),
    }),
);

export type Area = typeof area.$inferSelect;
export type NewArea = typeof area.$inferInsert;
export type SellerAreaMapping = typeof sellerAreaMapping.$inferSelect;
export type NewSellerAreaMapping = typeof sellerAreaMapping.$inferInsert;
