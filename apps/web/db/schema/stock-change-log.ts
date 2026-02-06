import { relations } from "drizzle-orm";
import {
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

export const stockChangeTypeEnum = pgEnum("stock_change_type", [
  "add",
  "reduce",
]);
export type StockChangeType = "add" | "reduce";

export const stockChangeLog = pgTable(
  "stock_change_log",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    changeType: stockChangeTypeEnum("change_type").notNull(),
    quantity: integer("quantity").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("stockChangeLog_productId_idx").on(table.productId),
    index("stockChangeLog_createdAt_idx").on(table.createdAt),
  ],
);

export const stockChangeLogRelations = relations(stockChangeLog, ({ one }) => ({
  product: one(product, {
    fields: [stockChangeLog.productId],
    references: [product.id],
  }),
  createdBy: one(user, {
    fields: [stockChangeLog.createdById],
    references: [user.id],
  }),
}));
