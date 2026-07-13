import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  index,
  boolean,
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { brand } from "./brand";
import { category, subCategory } from "./category";
import { timestamps } from "./columns.helpers";
import { coreProductIdentity } from "./core-product";
import { trackingTypeEnum } from "./tracking-type";
import { variantOption } from "./variant-option";

// Type for product features
export type ProductFeatureItem = {
  key: string;
  value: string;
};

export type ProductFeatureGroup = {
  title: string;
  items: ProductFeatureItem[];
};

// Product status enum
export const productStatusEnum = pgEnum("product_status", [
  "active",
  "inactive",
  "draft",
]);

export { trackingTypeEnum };

// Visibility enum
export const visibilityEnum = pgEnum("product_visibility", [
  "public",
  "private",
]);

/** Explicit creator of an actual product row. */
export const productCreatorSourceEnum = pgEnum("product_creator_source", [
  "admin",
  "warehouse",
  "shop",
  "unknown",
]);

export const product = pgTable(
  "product",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 150 }).notNull().unique(),
    description: text("description"),
    categoryId: integer("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    subCategoryId: integer("sub_category_id").references(() => subCategory.id, {
      onDelete: "set null",
    }),
    brandId: integer("brand_id").references(() => brand.id, {
      onDelete: "set null",
    }),

    /** Link to Core Product Identity (nullable for backward compat with existing products) */
    coreProductId: integer("core_product_id").references(
      () => coreProductIdentity.id,
      { onDelete: "restrict" },
    ),

    size: varchar("size", { length: 50 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),

    reorderLevel: integer("reorder_level").default(0).notNull(),
    sku: varchar("sku", { length: 100 }),
    supplier: text("supplier"),
    lastRestockedAt: timestamp("last_restocked_at"),

    image: varchar("image", { length: 255 }).notNull(),

    /** Short description (plain text) */
    shortDescription: text("short_description"),

    /** Optional video URL */
    videoUrl: varchar("video_url", { length: 500 }),

    // Product features stored as JSONB
    features: jsonb("features").$type<ProductFeatureGroup[]>().default([]),

    inStock: boolean("in_stock").default(true).notNull(),
    isFeatured: boolean("is_featured").default(false).notNull(),

    // === B2B + B2C Pack Return Configuration (product-level defaults) ===
    isReturnablePack: boolean("is_returnable_pack").default(false).notNull(),
    defaultPackDepositAmount: decimal("default_pack_deposit_amount", {
      precision: 10,
      scale: 2,
    }).default("0"),
    allowedPackBrands: jsonb("allowed_pack_brands")
      .$type<string[]>()
      .default([]),
    allowedPackSizes: jsonb("allowed_pack_sizes").$type<string[]>().default([]),

    // === Inventory & Product Rules (from docs) ===

    /** Whether normal product returns are allowed */
    returnPolicyEnabled: boolean("return_policy_enabled")
      .default(true)
      .notNull(),

    /** Tracking type: none, batch, serial */
    trackingType: trackingTypeEnum("tracking_type").default("none").notNull(),

    /** Whether expiry tracking is enabled */
    expiryEnabled: boolean("expiry_enabled").default(false).notNull(),

    /** Whether damage control is enabled */
    damageControlEnabled: boolean("damage_control_enabled")
      .default(false)
      .notNull(),

    /** Whether stock tracking is enabled for this product */
    stockTrackingEnabled: boolean("stock_tracking_enabled")
      .default(true)
      .notNull(),

    /** Whether minimum order quantity is enforced */
    minimumOrderEnabled: boolean("minimum_order_enabled")
      .default(true)
      .notNull(),

    /** Product-level minimum order quantity applied to generated variants */
    minimumOrderQty: decimal("minimum_order_qty", {
      precision: 12,
      scale: 2,
    })
      .default("1")
      .notNull(),

    /** Product-level inventory/order unit applied to generated variants */
    inventoryUnit: varchar("inventory_unit", { length: 20 })
      .default("unit")
      .notNull(),

    /** Product-level conversion flag, defaulted from product type behavior */
    conversionEnabled: boolean("conversion_enabled").default(false).notNull(),

    /** Whether this product supports loose inventory units */
    inventoryLooseUnitEnabled: boolean("inventory_loose_unit_enabled")
      .default(false)
      .notNull(),

    /** Loose inventory unit used when loose mode is enabled */
    inventoryLooseUnit: varchar("inventory_loose_unit", { length: 20 })
      .default("kg")
      .notNull(),

    /** Product visibility: public or private */
    visibility: visibilityEnum("visibility").default("public").notNull(),

    /** Scheduled publish date (null = publish immediately) */
    scheduledAt: timestamp("scheduled_at"),

    // Product status
    status: productStatusEnum("status").default("active").notNull(),

    /** Warehouse that created this product. NULL = admin-created (global). */
    createdByWarehouseId: text("created_by_warehouse_id").references(
      () => user.id,
      { onDelete: "set null" },
    ),

    /** Actor type that created the product. `shop` is labelled Retailer in UI. */
    creatorSource: productCreatorSourceEnum("creator_source")
      .default("unknown")
      .notNull(),

    /** User ID of the creator; for warehouse products this is the warehouse ID. */
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),

    /** Optional lineage to the product that supplied the initial defaults. */
    derivedFromProductId: integer("derived_from_product_id").references(
      (): AnyPgColumn => product.id,
      { onDelete: "set null" },
    ),

    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_core_brand_admin_unique")
      .on(table.coreProductId, table.brandId)
      .where(
        sql`${table.creatorSource} = 'admin' AND ${table.coreProductId} IS NOT NULL AND ${table.brandId} IS NOT NULL`,
      ),
    uniqueIndex("product_core_brand_warehouse_unique")
      .on(table.createdById, table.coreProductId, table.brandId)
      .where(
        sql`${table.creatorSource} = 'warehouse' AND ${table.createdById} IS NOT NULL AND ${table.coreProductId} IS NOT NULL AND ${table.brandId} IS NOT NULL`,
      ),
    uniqueIndex("product_core_brand_shop_unique")
      .on(table.createdById, table.coreProductId, table.brandId)
      .where(
        sql`${table.creatorSource} = 'shop' AND ${table.createdById} IS NOT NULL AND ${table.coreProductId} IS NOT NULL AND ${table.brandId} IS NOT NULL`,
      ),
    index("product_creator_scope_idx").on(
      table.creatorSource,
      table.createdById,
    ),
    index("product_derived_from_idx").on(table.derivedFromProductId),
  ],
);

export const productImage = pgTable("product_image", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "cascade" }),
  imageUrl: varchar("image_url", { length: 255 }).notNull(),
  ...timestamps,
});

// === Product ↔ Brand (M2M) ===

/**
 * Junction table for multi-brand product support.
 * A product like "Miniket Rice 1KG" can stock brands: Ifad, ACI, Pran.
 */
export const productBrand = pgTable(
  "product_brand",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    brandId: integer("brand_id")
      .notNull()
      .references(() => brand.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("product_brand_product_brand_unique").on(
      table.productId,
      table.brandId,
    ),
  ],
);

// === Product ↔ Variant Option Price (M2M with pricing) ===

/**
 * Links a product to variant options from Core Identity and stores the
 * consumer reference price for each variant.
 *
 * E.g. "Miniket Rice (PRAN)" → 1KG Pack → ৳60, 5KG Pack → ৳280
 */
export const productVariantPrice = pgTable("product_variant_price", {
  id: serial("id").primaryKey(),

  /** Parent product */
  productId: integer("product_id")
    .notNull()
    .references(() => product.id, { onDelete: "cascade" }),

  /** Linked global variant option (e.g. "1KG Pack", "5KG Sack") */
  variantOptionId: integer("variant_option_id")
    .notNull()
    .references(() => variantOption.id, { onDelete: "cascade" }),

  /** Brand this variant-price belongs to (for multi-brand products) */
  brandId: integer("brand_id").references(() => brand.id, {
    onDelete: "set null",
  }),

  /** Consumer reference price for this variant (seller can override) */
  consumerPrice: decimal("consumer_price", {
    precision: 10,
    scale: 2,
  })
    .default("0")
    .notNull(),

  /** Sort order within this product */
  sortOrder: integer("sort_order").default(0).notNull(),

  /** Whether this variant-price is active */
  isActive: boolean("is_active").default(true).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// === Relations ===

import { productVariant } from "./product-variant";

export const productRelations = relations(product, ({ one, many }) => ({
  category: one(category, {
    fields: [product.categoryId],
    references: [category.id],
  }),
  subCategory: one(subCategory, {
    fields: [product.subCategoryId],
    references: [subCategory.id],
  }),
  brand: one(brand, {
    fields: [product.brandId],
    references: [brand.id],
  }),
  coreProduct: one(coreProductIdentity, {
    fields: [product.coreProductId],
    references: [coreProductIdentity.id],
  }),
  createdBy: one(user, {
    fields: [product.createdById],
    references: [user.id],
    relationName: "productCreator",
  }),
  derivedFromProduct: one(product, {
    fields: [product.derivedFromProductId],
    references: [product.id],
    relationName: "derivedProductLineage",
  }),
  images: many(productImage),
  productBrands: many(productBrand),
  variants: many(productVariant),
  variantPrices: many(productVariantPrice),
}));

export const productImageRelations = relations(productImage, ({ one }) => ({
  product: one(product, {
    fields: [productImage.productId],
    references: [product.id],
  }),
}));

export const productBrandRelations = relations(productBrand, ({ one }) => ({
  product: one(product, {
    fields: [productBrand.productId],
    references: [product.id],
  }),
  brand: one(brand, {
    fields: [productBrand.brandId],
    references: [brand.id],
  }),
}));

export const productVariantPriceRelations = relations(
  productVariantPrice,
  ({ one }) => ({
    product: one(product, {
      fields: [productVariantPrice.productId],
      references: [product.id],
    }),
    variantOption: one(variantOption, {
      fields: [productVariantPrice.variantOptionId],
      references: [variantOption.id],
    }),
    brand: one(brand, {
      fields: [productVariantPrice.brandId],
      references: [brand.id],
    }),
  }),
);

// === Types ===

export type Product = typeof product.$inferSelect;
export type ProductImage = typeof productImage.$inferSelect;
export type NewProduct = typeof product.$inferInsert;
export type NewProductImage = typeof productImage.$inferInsert;
export type ProductVariantPrice = typeof productVariantPrice.$inferSelect;
export type NewProductVariantPrice = typeof productVariantPrice.$inferInsert;

export type ProductWithRelations = Omit<Product, "price"> & {
  price: string | number;
  category: {
    name: string;
    slug: string;
  };
  subCategory?: {
    name: string;
  } | null;
  brand?: {
    id: number;
    name: string;
    slug: string;
    logo: string | null;
  } | null;
  images?: ProductImage[];
};
