import { relations } from "drizzle-orm";
import {
  date,
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

export const estimateStatusEnum = pgEnum("estimate_status", [
  "draft",
  "pending",
  "sent",
  "approved",
  "rejected",
  "converted",
]);

export const estimate = pgTable(
  "estimate",
  {
    id: serial("id").primaryKey(),
    estimateNumber: text("estimate_number").notNull().unique(),

    // Customer and Salesman
    customerId: text("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    salesmanId: text("salesman_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Totals
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    discount: decimal("discount", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),

    // Status and validity
    status: estimateStatusEnum("status").default("draft").notNull(),
    validUntil: date("valid_until"),

    // Notes
    notes: text("notes"),

    // Conversion tracking (placeholder for invoice - will connect to Dev2's schema)
    convertedOrderId: integer("converted_order_id"),
    // TODO: Add convertedInvoiceId when Dev2's invoice schema is ready
    // convertedInvoiceId: integer("converted_invoice_id"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    sentAt: timestamp("sent_at"),
    approvedAt: timestamp("approved_at"),
    rejectedAt: timestamp("rejected_at"),
    convertedAt: timestamp("converted_at"),
  },
  (table) => [
    index("estimate_customerId_idx").on(table.customerId),
    index("estimate_salesmanId_idx").on(table.salesmanId),
    index("estimate_status_idx").on(table.status),
    index("estimate_estimateNumber_idx").on(table.estimateNumber),
  ],
);

export const estimateItem = pgTable(
  "estimate_item",
  {
    id: serial("id").primaryKey(),
    estimateId: integer("estimate_id")
      .notNull()
      .references(() => estimate.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "restrict" }),

    // Product snapshot at time of estimate
    productName: text("product_name").notNull(),
    productImage: text("product_image"),

    // Pricing
    quantity: integer("quantity").notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    discount: decimal("discount", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("estimateItem_estimateId_idx").on(table.estimateId),
    index("estimateItem_productId_idx").on(table.productId),
  ],
);

// Relations
export const estimateRelations = relations(estimate, ({ one, many }) => ({
  customer: one(user, {
    fields: [estimate.customerId],
    references: [user.id],
    relationName: "customerEstimates",
  }),
  salesman: one(user, {
    fields: [estimate.salesmanId],
    references: [user.id],
    relationName: "salesmanEstimates",
  }),
  items: many(estimateItem),
}));

export const estimateItemRelations = relations(estimateItem, ({ one }) => ({
  estimate: one(estimate, {
    fields: [estimateItem.estimateId],
    references: [estimate.id],
  }),
  product: one(product, {
    fields: [estimateItem.productId],
    references: [product.id],
  }),
}));

// Types
export type Estimate = typeof estimate.$inferSelect;
export type EstimateItem = typeof estimateItem.$inferSelect;
export type NewEstimate = typeof estimate.$inferInsert;
export type NewEstimateItem = typeof estimateItem.$inferInsert;

export type EstimateStatus = (typeof estimateStatusEnum.enumValues)[number];

export interface EstimateWithItems extends Estimate {
  items: EstimateItem[];
  customer?: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
    shopName: string | null;
  };
  salesman?: {
    id: string;
    name: string;
    email: string;
  };
}

// Stats types for employee dashboard
export interface EstimateStatsCount {
  total: number;
  draft: number;
  sent: number;
  approved: number;
  rejected: number;
  converted: number;
  thisMonth: number;
  today: number;
  totalValue: number;
  convertedValue: number;
}

export interface RecentEstimateWithCustomer {
  id: number;
  estimateNumber: string;
  total: string;
  status: EstimateStatus;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
    shopName: string | null;
  } | null;
}

export interface SalesmanStats {
  role: "salesman";
  estimates: EstimateStatsCount;
  conversionRate: number;
  recentEstimates: RecentEstimateWithCustomer[];
}
