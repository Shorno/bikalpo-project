import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  decimal,
  index,
  integer,
  pgTable,
  serial,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { brand } from "./brand";
import { timestamps } from "./columns.helpers";
import { coreProductIdentity } from "./core-product";
import { variantOption } from "./variant-option";

/**
 * Platform-wide identity for one orderable trade variant.
 *
 * Owner variants (Admin, warehouse, and retailer) may keep their own local
 * SKU and pricing, but they all point at this immutable identity.
 */
export const catalogVariant = pgTable(
  "catalog_variant",
  {
    id: serial("id").primaryKey(),

    globalSku: varchar("global_sku", { length: 14 })
      .default(
        sql`'BKV-' || lpad(nextval('catalog_variant_global_sku_seq')::text, 10, '0')`,
      )
      .notNull(),

    coreProductId: integer("core_product_id")
      .notNull()
      .references(() => coreProductIdentity.id, { onDelete: "restrict" }),
    brandId: integer("brand_id").references(() => brand.id, {
      onDelete: "restrict",
    }),
    variantOptionId: integer("variant_option_id")
      .notNull()
      .references(() => variantOption.id, { onDelete: "restrict" }),

    /** Issuance-time readable reference; populated in the alias rollout. */
    classificationCode: varchar("classification_code", { length: 20 }),

    /** Canonical target for carton-to-pack or bulk-to-loose conversion. */
    conversionTargetCatalogVariantId: integer(
      "conversion_target_catalog_variant_id",
    ).references((): AnyPgColumn => catalogVariant.id, {
      onDelete: "restrict",
    }),
    conversionRatio: decimal("conversion_ratio", {
      precision: 12,
      scale: 4,
    }),

    configurationState: varchar("configuration_state", { length: 24 })
      .default("configured")
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    ...timestamps,
  },
  (table) => [
    uniqueIndex("catalog_variant_global_sku_unique").on(table.globalSku),
    uniqueIndex("catalog_variant_branded_identity_unique")
      .on(table.coreProductId, table.brandId, table.variantOptionId)
      .where(sql`${table.brandId} IS NOT NULL`),
    uniqueIndex("catalog_variant_unbranded_identity_unique")
      .on(table.coreProductId, table.variantOptionId)
      .where(sql`${table.brandId} IS NULL`),
    index("catalog_variant_core_product_idx").on(table.coreProductId),
    index("catalog_variant_variant_option_idx").on(table.variantOptionId),
  ],
);

export const catalogVariantRelations = relations(catalogVariant, ({ one }) => ({
  coreProduct: one(coreProductIdentity, {
    fields: [catalogVariant.coreProductId],
    references: [coreProductIdentity.id],
  }),
  brand: one(brand, {
    fields: [catalogVariant.brandId],
    references: [brand.id],
  }),
  variantOption: one(variantOption, {
    fields: [catalogVariant.variantOptionId],
    references: [variantOption.id],
  }),
  conversionTarget: one(catalogVariant, {
    fields: [catalogVariant.conversionTargetCatalogVariantId],
    references: [catalogVariant.id],
    relationName: "catalogVariantConversionTarget",
  }),
}));

export type CatalogVariant = typeof catalogVariant.$inferSelect;
export type NewCatalogVariant = typeof catalogVariant.$inferInsert;
