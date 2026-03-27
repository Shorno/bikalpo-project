import { relations } from "drizzle-orm";
import {
    boolean,
    decimal,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
} from "drizzle-orm/pg-core";
import { order, orderItem } from "./order";
import { user } from "./auth-schema";

/**
 * Bid status lifecycle:
 *   available → locked → submitted   (happy path)
 *   available → locked → expired      (timeout)
 *   available → locked → released     (shop released)
 *   submitted → lost                  (another bid won)
 */
export const openOrderBidStatusEnum = pgEnum("open_order_bid_status", [
    "available",
    "locked",
    "submitted",
    "expired",
    "released",
    "lost",
]);

/**
 * Tracks each seller's bid on an open sub-order.
 * Each eligible seller gets one bid record per sub-order when broadcast starts.
 */
export const openOrderBid = pgTable(
    "open_order_bid",
    {
        id: serial("id").primaryKey(),

        /** Which sub-order this bid is for */
        subOrderId: integer("sub_order_id")
            .notNull()
            .references(() => order.id, { onDelete: "cascade" }),

        /** Bidding shop owner */
        shopId: text("shop_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** Matching rank (1 = nearest) */
        rank: integer("rank").notNull().default(0),

        /** Distance from consumer in km */
        distanceKm: decimal("distance_km", { precision: 8, scale: 2 }),

        /** Bid status */
        status: openOrderBidStatusEnum("status").default("available").notNull(),

        /** When the shop locked this bid */
        lockedAt: timestamp("locked_at"),

        /** When the shop submitted their offer */
        submittedAt: timestamp("submitted_at"),

        /** Lock expiry time (lockedAt + timeout) */
        expiresAt: timestamp("expires_at"),

        /** Lock timeout in seconds (default 100) */
        timeoutSeconds: integer("timeout_seconds").default(100).notNull(),

        /** Seller's delivery charge */
        deliveryCharge: decimal("delivery_charge", { precision: 10, scale: 2 }),

        /** Total bid amount: sum(sellerPrice × qty) + deliveryCharge */
        totalBid: decimal("total_bid", { precision: 10, scale: 2 }),

        /** True if this bid won */
        isWinner: boolean("is_winner").default(false).notNull(),

        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("openOrderBid_subOrder_idx").on(table.subOrderId),
        index("openOrderBid_shop_idx").on(table.shopId),
        index("openOrderBid_status_idx").on(table.status),
        index("openOrderBid_subOrder_shop_idx").on(
            table.subOrderId,
            table.shopId,
        ),
    ],
);

export const openOrderBidRelations = relations(openOrderBid, ({ one, many }) => ({
    subOrder: one(order, {
        fields: [openOrderBid.subOrderId],
        references: [order.id],
    }),
    shop: one(user, {
        fields: [openOrderBid.shopId],
        references: [user.id],
    }),
    items: many(openOrderBidItem),
}));

// ─── Bid Item (per-item prices in a bid) ───

/**
 * Per-item price in a seller's bid.
 * Stores both the platform's base price and the seller's offered price.
 */
export const openOrderBidItem = pgTable(
    "open_order_bid_item",
    {
        id: serial("id").primaryKey(),

        /** Parent bid */
        bidId: integer("bid_id")
            .notNull()
            .references(() => openOrderBid.id, { onDelete: "cascade" }),

        /** Which order item this price is for */
        orderItemId: integer("order_item_id")
            .notNull()
            .references(() => orderItem.id, { onDelete: "cascade" }),

        /** Platform's base/reference price */
        platformPrice: decimal("platform_price", { precision: 10, scale: 2 }).notNull(),

        /** Seller's offered price */
        sellerPrice: decimal("seller_price", { precision: 10, scale: 2 }),
    },
    (table) => [
        index("openOrderBidItem_bid_idx").on(table.bidId),
        index("openOrderBidItem_orderItem_idx").on(table.orderItemId),
    ],
);

export const openOrderBidItemRelations = relations(openOrderBidItem, ({ one }) => ({
    bid: one(openOrderBid, {
        fields: [openOrderBidItem.bidId],
        references: [openOrderBid.id],
    }),
}));

// ─── Types ───

export type OpenOrderBid = typeof openOrderBid.$inferSelect;
export type NewOpenOrderBid = typeof openOrderBid.$inferInsert;
export type OpenOrderBidItem = typeof openOrderBidItem.$inferSelect;
export type NewOpenOrderBidItem = typeof openOrderBidItem.$inferInsert;
export type OpenOrderBidStatus = (typeof openOrderBidStatusEnum.enumValues)[number];
