import { relations } from "drizzle-orm";
import {
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
  "confirmed",
  "processing",
  "delivered",
  "cancelled",
]);

// Payment status enum
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

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
