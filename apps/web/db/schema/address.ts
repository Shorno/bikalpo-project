import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const address = pgTable(
  "address",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: text("label").notNull().default("Home"), // Home, Office, etc.
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    area: text("area"),
    postalCode: text("postal_code"),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("address_userId_idx").on(table.userId)],
);

export const addressRelations = relations(address, ({ one }) => ({
  user: one(user, {
    fields: [address.userId],
    references: [user.id],
  }),
}));

export type Address = typeof address.$inferSelect;
export type NewAddress = typeof address.$inferInsert;
