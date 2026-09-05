import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const storeItemRequest = pgTable(
  "store_item_request",
  {
    id: serial("id").primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    customerId: text("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    itemName: text("item_name").notNull(),
    brand: text("brand"),
    quantity: integer("quantity").notNull(),
    description: text("description"),
    status: text("status")
      .$type<"pending" | "available" | "unavailable">()
      .notNull()
      .default("pending"),
    response: text("response"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("store_item_request_quantity_check", sql`${table.quantity} > 0`),
    check(
      "store_item_request_status_check",
      sql`${table.status} IN ('pending', 'available', 'unavailable')`,
    ),
    index("store_item_request_shop_idx").on(table.shopId),
    index("store_item_request_customer_idx").on(table.customerId),
  ],
);
