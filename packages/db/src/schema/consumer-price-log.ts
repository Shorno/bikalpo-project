import {
  decimal,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/** Append-only snapshots: retain the audit trail even if a product/user is removed. */
export const consumerPriceLog = pgTable(
  "consumer_price_log",
  {
    id: serial("id").primaryKey(),
    variantPriceId: integer("variant_price_id").notNull(),
    productId: integer("product_id").notNull(),
    actorId: text("actor_id").notNull(),
    actorName: text("actor_name").notNull(),
    source: varchar("source", { length: 20 })
      .$type<"inline" | "excel">()
      .notNull(),
    previousPrice: decimal("previous_price", {
      precision: 10,
      scale: 2,
    }).notNull(),
    newPrice: decimal("new_price", { precision: 10, scale: 2 }).notNull(),
    previousExchangePrice: decimal("previous_exchange_price", {
      precision: 10,
      scale: 2,
    }),
    newExchangePrice: decimal("new_exchange_price", {
      precision: 10,
      scale: 2,
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("consumer_price_log_variant_date_idx").on(
      table.variantPriceId,
      table.createdAt,
      table.id,
    ),
  ],
);
