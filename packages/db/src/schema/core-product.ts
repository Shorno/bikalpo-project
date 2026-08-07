import { relations } from "drizzle-orm";
import { BRAND_CREATION_MODES } from "../brand-creation";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { category, subCategory } from "./category";
import { timestamps } from "./columns.helpers";
import type { ProductFeatureGroup } from "./product";

/** Who created a catalog entity (core product identity) */
export const catalogCreatorSourceEnum = pgEnum("catalog_creator_source", [
  "admin",
  "warehouse",
  "shop",
]);

export const brandCreationModeEnum = pgEnum(
  "brand_creation_mode",
  BRAND_CREATION_MODES,
);

// === Core Product Identity ===

/**
 * Core Product Identity — admin-controlled global product catalog.
 *
 * This is the canonical product definition that all sellers must follow.
 * Admin creates these as the "master product list" and sellers can only
 * list variants/stock against existing Core Identities.
 *
 * Hierarchy: Type → Category → SubCategory → Core Product Identity
 */
export const coreProductIdentity = pgTable("core_product_identity", {
  id: serial("id").primaryKey(),

  /** Auto-generated SKU code (e.g. "001", "002") — unique within subcategory scope */
  sku: varchar("sku", { length: 20 }).notNull(),

  /** Global product name (e.g. "Miniket Rice") — must be unique */
  name: varchar("name", { length: 150 }).notNull().unique(),

  /** URL-friendly slug */
  slug: varchar("slug", { length: 150 }).notNull().unique(),

  /** Optional description */
  description: text("description"),

  /** Representative product image */
  image: varchar("image", { length: 255 }).notNull(),

  /** Parent category */
  categoryId: integer("category_id")
    .notNull()
    .references(() => category.id, { onDelete: "restrict" }),

  /** Optional sub-category */
  subCategoryId: integer("sub_category_id").references(() => subCategory.id, {
    onDelete: "set null",
  }),

  /** User who created this core product. NULL = unknown historic creator. */
  createdById: text("created_by_id").references(() => user.id, {
    onDelete: "set null",
  }),

  /** Which actor type created this core product (admin | warehouse | shop) */
  creatorSource: catalogCreatorSourceEnum("creator_source")
    .default("admin")
    .notNull(),

  /** Disabled identities remain attached to existing products but cannot be newly configured. */
  isActive: boolean("is_active").default(true).notNull(),

  /** Controls whether owners configure one Brand Product or the full brand set per save. */
  brandCreationMode: brandCreationModeEnum("brand_creation_mode")
    .default("batch")
    .notNull(),

  ...timestamps,
});

/**
 * Brand-neutral details captured during the first admin product creation.
 * Generated brand products can diverge later; this editable, versioned
 * template remains the source for products added to the core product later.
 */
export type AdminProductGenerationTemplateDetails = {
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  videoUrl?: string | null;
  size: string;
  price: string;
  image: string;
  additionalImages: string[];
  features: ProductFeatureGroup[];
  inStock: boolean;
  isFeatured: boolean;
  reorderLevel: number;
  supplier?: string | null;
  isReturnablePack: boolean;
  defaultPackDepositAmount: string;
  allowedPackBrands: string[];
  allowedPackSizes: string[];
  returnPolicyEnabled: boolean;
  trackingType: "none" | "batch" | "serial";
  expiryEnabled: boolean;
  damageControlEnabled: boolean;
  stockTrackingEnabled: boolean;
  minimumOrderEnabled: boolean;
  minimumOrderQty: string;
  inventoryUnit: string;
  conversionEnabled: boolean;
  inventoryLooseUnitEnabled: boolean;
  inventoryLooseUnit: string;
  visibility: "public" | "private";
  scheduledAt?: string | null;
  status: "active" | "inactive" | "draft";
};

export const adminProductGenerationTemplate = pgTable(
  "admin_product_generation_template",
  {
    coreProductId: integer("core_product_id")
      .primaryKey()
      .references(() => coreProductIdentity.id, { onDelete: "cascade" }),
    version: integer("version").default(1).notNull(),
    details: jsonb("details")
      .$type<AdminProductGenerationTemplateDetails>()
      .notNull(),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
);

/**
 * Editable, warehouse-owned snapshot of the admin generation defaults.
 * Brand/variant membership is intentionally derived from product rows.
 */
export const warehouseProductGenerationTemplate = pgTable(
  "warehouse_product_generation_template",
  {
    id: serial("id").primaryKey(),
    coreProductId: integer("core_product_id")
      .notNull()
      .references(() => coreProductIdentity.id, { onDelete: "cascade" }),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    version: integer("version").default(1).notNull(),
    sourceAdminTemplateVersion: integer("source_admin_template_version"),
    details: jsonb("details")
      .$type<AdminProductGenerationTemplateDetails>()
      .notNull(),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("warehouse_generation_template_owner_core_unique").on(
      table.warehouseId,
      table.coreProductId,
    ),
  ],
);

/**
 * Editable, retailer-owned snapshot of the admin generation defaults.
 * Brand/variant membership is derived from retailer-owned product rows.
 */
export const shopProductGenerationTemplate = pgTable(
  "shop_product_generation_template",
  {
    id: serial("id").primaryKey(),
    coreProductId: integer("core_product_id")
      .notNull()
      .references(() => coreProductIdentity.id, { onDelete: "cascade" }),
    shopId: text("shop_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    version: integer("version").default(1).notNull(),
    sourceAdminTemplateVersion: integer("source_admin_template_version"),
    details: jsonb("details")
      .$type<AdminProductGenerationTemplateDetails>()
      .notNull(),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("shop_generation_template_owner_core_unique").on(
      table.shopId,
      table.coreProductId,
    ),
  ],
);

// === Relations ===

export const coreProductIdentityRelations = relations(
  coreProductIdentity,
  ({ one }) => ({
    category: one(category, {
      fields: [coreProductIdentity.categoryId],
      references: [category.id],
    }),
    subCategory: one(subCategory, {
      fields: [coreProductIdentity.subCategoryId],
      references: [subCategory.id],
    }),
    createdBy: one(user, {
      fields: [coreProductIdentity.createdById],
      references: [user.id],
    }),
    adminProductGenerationTemplate: one(adminProductGenerationTemplate),
  }),
);

export const adminProductGenerationTemplateRelations = relations(
  adminProductGenerationTemplate,
  ({ one }) => ({
    coreProduct: one(coreProductIdentity, {
      fields: [adminProductGenerationTemplate.coreProductId],
      references: [coreProductIdentity.id],
    }),
    createdBy: one(user, {
      fields: [adminProductGenerationTemplate.createdById],
      references: [user.id],
    }),
  }),
);

export const warehouseProductGenerationTemplateRelations = relations(
  warehouseProductGenerationTemplate,
  ({ one }) => ({
    coreProduct: one(coreProductIdentity, {
      fields: [warehouseProductGenerationTemplate.coreProductId],
      references: [coreProductIdentity.id],
    }),
    warehouse: one(user, {
      fields: [warehouseProductGenerationTemplate.warehouseId],
      references: [user.id],
      relationName: "warehouseGenerationTemplateOwner",
    }),
    createdBy: one(user, {
      fields: [warehouseProductGenerationTemplate.createdById],
      references: [user.id],
      relationName: "warehouseGenerationTemplateCreator",
    }),
  }),
);

export const shopProductGenerationTemplateRelations = relations(
  shopProductGenerationTemplate,
  ({ one }) => ({
    coreProduct: one(coreProductIdentity, {
      fields: [shopProductGenerationTemplate.coreProductId],
      references: [coreProductIdentity.id],
    }),
    shop: one(user, {
      fields: [shopProductGenerationTemplate.shopId],
      references: [user.id],
      relationName: "shopGenerationTemplateOwner",
    }),
    createdBy: one(user, {
      fields: [shopProductGenerationTemplate.createdById],
      references: [user.id],
      relationName: "shopGenerationTemplateCreator",
    }),
  }),
);

// === Types ===

export type CoreProductIdentity = typeof coreProductIdentity.$inferSelect;
export type NewCoreProductIdentity = typeof coreProductIdentity.$inferInsert;
export type AdminProductGenerationTemplate =
  typeof adminProductGenerationTemplate.$inferSelect;
export type WarehouseProductGenerationTemplate =
  typeof warehouseProductGenerationTemplate.$inferSelect;
export type ShopProductGenerationTemplate =
  typeof shopProductGenerationTemplate.$inferSelect;
