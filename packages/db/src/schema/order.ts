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
import { user } from "./auth-schema";
import { product } from "./product";
import { productVariant } from "./product-variant";

// Order status enum
export const orderStatusEnum = pgEnum("order_status", [
    "pending",
    "matching_shop",
    "negotiating",
    "confirmed",
    "processing",
    "delivered",
    "returned",
    "cancelled",
]);

// Payment status enum
export const paymentStatusEnum = pgEnum("payment_status", [
    "pending",
    "paid",
    "failed",
    "refunded",
]);

// B2B order type enum (B2B = shop buying from admin, B2C = consumer buying from shop)
export const b2bOrderTypeEnum = pgEnum("b2b_order_type", ["b2b", "b2c"]);

// Payment method enum
export const paymentMethodEnum = pgEnum("payment_method", [
    "cash_on_delivery",
    "bkash",
    "nagad",
    "bank_transfer",
    "card",
]);

export const order = pgTable(
    "order",
    {
        id: serial("id").primaryKey(),
        orderNumber: text("order_number").notNull().unique(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        // Order type: b2b (shop→admin wholesale) or b2c (consumer→shop retail)
        orderType: b2bOrderTypeEnum("order_type").default("b2c").notNull(),

        // For B2C orders: which shop this order is placed with (null = B2B/admin)
        shopId: text("shop_id").references(() => user.id, { onDelete: "set null" }),

        // For warehouse orders: which warehouse this order is placed with
        warehouseId: text("warehouse_id").references(() => user.id, { onDelete: "set null" }),

        // === Open Order fields ===
        /** True if this is an open order (no shop pre-selected) */
        isOpenOrder: boolean("is_open_order").default(false).notNull(),
        /** Parent order ID for sub-orders (null = parent or normal order) */
        parentOrderId: integer("parent_order_id"),
        /** Category group label for sub-orders (e.g. "Fresh Grocery") */
        subOrderLabel: text("sub_order_label"),
        /** Broadcast deadline — all bids must be in by this time */
        broadcastExpiresAt: timestamp("broadcast_expires_at"),

        // === Area & Location tracking ===
        /** The area the consumer placed the order from */
        consumerAreaId: integer("consumer_area_id"),
        /** The area that was matched to serve the order */
        matchedAreaId: integer("matched_area_id"),
        /** Consumer's latitude at order time */
        locationLat: text("location_lat"),
        /** Consumer's longitude at order time */
        locationLng: text("location_lng"),

        // Order totals
        subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
        shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 })
            .default("0")
            .notNull(),
        discount: decimal("discount", { precision: 10, scale: 2 })
            .default("0")
            .notNull(),
        total: decimal("total", { precision: 10, scale: 2 }).notNull(),

        // Pending price change (admin changed price while order was pending)
        previousTotal: decimal("previous_total", { precision: 10, scale: 2 }),
        totalPriceChangedAt: timestamp("total_price_changed_at"),

        // Locked at confirmation – customer always sees these for confirmed+ orders
        confirmedSubtotal: decimal("confirmed_subtotal", {
            precision: 10,
            scale: 2,
        }),
        confirmedTotal: decimal("confirmed_total", { precision: 10, scale: 2 }),

        // Status
        status: orderStatusEnum("status").default("pending").notNull(),
        paymentStatus: paymentStatusEnum("payment_status")
            .default("pending")
            .notNull(),
        paymentMethod: paymentMethodEnum("payment_method")
            .default("cash_on_delivery")
            .notNull(),

        // Shipping address
        shippingName: text("shipping_name").notNull(),
        shippingPhone: text("shipping_phone").notNull(),
        shippingEmail: text("shipping_email"),
        shippingAddress: text("shipping_address").notNull(),
        shippingCity: text("shipping_city").notNull(),
        shippingArea: text("shipping_area"),
        shippingPostalCode: text("shipping_postal_code"),

        // Notes
        customerNote: text("customer_note"),
        adminNote: text("admin_note"),

        // Timestamps
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
        confirmedAt: timestamp("confirmed_at"),
        shippedAt: timestamp("shipped_at"),
        deliveredAt: timestamp("delivered_at"),
        cancelledAt: timestamp("cancelled_at"),
        adminModifiedAt: timestamp("admin_modified_at"),
    },
    (table) => [
        index("order_userId_idx").on(table.userId),
        index("order_status_idx").on(table.status),
        index("order_orderNumber_idx").on(table.orderNumber),
        index("order_orderType_idx").on(table.orderType),
        index("order_shopId_idx").on(table.shopId),
    ],
);

export const orderItem = pgTable(
    "order_item",
    {
        id: serial("id").primaryKey(),
        orderId: integer("order_id")
            .notNull()
            .references(() => order.id, { onDelete: "cascade" }),
        productId: integer("product_id")
            .notNull()
            .references(() => product.id, { onDelete: "restrict" }),
        variantId: integer("variant_id").references(() => productVariant.id, {
            onDelete: "set null",
        }),

        // Product snapshot at time of order
        productName: text("product_name").notNull(),
        productImage: text("product_image").notNull(),
        productSize: text("product_size").notNull(),

        quantity: integer("quantity").notNull(),
        unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
        totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),

        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("orderItem_orderId_idx").on(table.orderId),
        index("orderItem_productId_idx").on(table.productId),
        index("orderItem_variantId_idx").on(table.variantId),
    ],
);

export const orderRelations = relations(order, ({ one, many }) => ({
    user: one(user, {
        fields: [order.userId],
        references: [user.id],
    }),
    items: many(orderItem),
}));

export const orderItemRelations = relations(orderItem, ({ one }) => ({
    order: one(order, {
        fields: [orderItem.orderId],
        references: [order.id],
    }),
    product: one(product, {
        fields: [orderItem.productId],
        references: [product.id],
    }),
    variant: one(productVariant, {
        fields: [orderItem.variantId],
        references: [productVariant.id],
    }),
}));

export type Order = typeof order.$inferSelect;
export type OrderItem = typeof orderItem.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
export type NewOrderItem = typeof orderItem.$inferInsert;

export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type OrderType = (typeof b2bOrderTypeEnum.enumValues)[number];

export interface OrderWithItems extends Order {
    items: OrderItem[];
    user?: {
        id: string;
        name: string;
        email: string;
        phoneNumber: string | null;
        shopName: string | null;
    };
}
