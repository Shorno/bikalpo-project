import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { product } from "./product";

// Request status enum
export const itemRequestStatusEnum = pgEnum("item_request_status", [
  "pending",
  "approved",
  "rejected",
  "suggested", // Admin suggested an alternative product
]);

export const itemRequest = pgTable(
  "item_request",
  {
    id: serial("id").primaryKey(),
    requestNumber: text("request_number").notNull().unique(),

    // Customer info
    customerId: text("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Requested item details
    itemName: text("item_name").notNull(),
    brand: text("brand"),
    category: text("category"),
    quantity: integer("quantity").notNull().default(1),
    description: text("description"),
    image: varchar("image", { length: 500 }), // Reference image uploaded by customer

    // Status and response
    status: itemRequestStatusEnum("status").default("pending").notNull(),
    adminResponse: text("admin_response"), // Feedback/reason from admin
    suggestedProductId: integer("suggested_product_id").references(
      () => product.id,
      { onDelete: "set null" },
    ),

    // Processing info
    processedById: text("processed_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    processedAt: timestamp("processed_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("itemRequest_customerId_idx").on(table.customerId),
    index("itemRequest_status_idx").on(table.status),
    index("itemRequest_requestNumber_idx").on(table.requestNumber),
    index("itemRequest_processedById_idx").on(table.processedById),
  ],
);

// Relations
export const itemRequestRelations = relations(itemRequest, ({ one }) => ({
  customer: one(user, {
    fields: [itemRequest.customerId],
    references: [user.id],
    relationName: "customerItemRequests",
  }),
  suggestedProduct: one(product, {
    fields: [itemRequest.suggestedProductId],
    references: [product.id],
  }),
  processedBy: one(user, {
    fields: [itemRequest.processedById],
    references: [user.id],
    relationName: "processedItemRequests",
  }),
}));

// Types
export type ItemRequest = typeof itemRequest.$inferSelect;
export type NewItemRequest = typeof itemRequest.$inferInsert;
export type ItemRequestStatus =
  (typeof itemRequestStatusEnum.enumValues)[number];

export interface ItemRequestWithRelations extends ItemRequest {
  customer?: {
    id: string;
    name: string;
    email: string;
    shopName: string | null;
    phoneNumber: string | null;
  };
  suggestedProduct?: {
    id: number;
    name: string;
    price: string;
    image: string;
  } | null;
  processedBy?: {
    id: string;
    name: string;
  } | null;
}
