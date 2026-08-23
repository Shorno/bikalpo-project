import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/** A consumer following a retailer storefront. */
export const shopFollower = pgTable(
  "shop_follower",
  {
    consumerId: text("consumer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    shopId: text("shop_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.consumerId, table.shopId],
      name: "shop_follower_consumer_shop_pk",
    }),
    index("shopFollower_shopId_idx").on(table.shopId),
    index("shopFollower_consumerId_idx").on(table.consumerId),
  ],
);

export const shopFollowerRelations = relations(shopFollower, ({ one }) => ({
  consumer: one(user, {
    fields: [shopFollower.consumerId],
    references: [user.id],
    relationName: "consumerShopFollows",
  }),
  shop: one(user, {
    fields: [shopFollower.shopId],
    references: [user.id],
    relationName: "shopFollowers",
  }),
}));

export type ShopFollower = typeof shopFollower.$inferSelect;
export type NewShopFollower = typeof shopFollower.$inferInsert;
