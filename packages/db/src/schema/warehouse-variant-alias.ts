import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { coreProductIdentity } from "./core-product";
import { variantOption } from "./variant-option";

export const warehouseVariantAlias = pgTable(
  "warehouse_variant_alias",
  {
    id: serial("id").primaryKey(),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    coreProductId: integer("core_product_id")
      .notNull()
      .references(() => coreProductIdentity.id, { onDelete: "cascade" }),
    variantOptionId: integer("variant_option_id")
      .notNull()
      .references(() => variantOption.id, { onDelete: "cascade" }),
    alias: varchar("alias", { length: 100 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("warehouse_variant_alias_scope_unique").on(
      table.warehouseId,
      table.coreProductId,
      table.variantOptionId,
    ),
  ],
);
