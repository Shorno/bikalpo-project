import { integer, pgTable, serial, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { coreProductIdentity } from "./core-product";
import { user } from "./auth-schema";
import { variantOption } from "./variant-option";

export const warehouseVariantAlias = pgTable("warehouse_variant_alias", {
  id: serial("id").primaryKey(),
  warehouseId: text("warehouse_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  coreProductId: integer("core_product_id").notNull().references(() => coreProductIdentity.id, { onDelete: "cascade" }),
  variantOptionId: integer("variant_option_id").notNull().references(() => variantOption.id, { onDelete: "cascade" }),
  alias: varchar("alias", { length: 100 }).notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("warehouse_variant_alias_scope_unique").on(table.warehouseId, table.coreProductId, table.variantOptionId),
]);
