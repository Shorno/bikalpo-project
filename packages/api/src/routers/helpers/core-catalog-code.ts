import { db } from "@bikalpo-project/db";
import {
  brand,
  category,
  coreProductIdentity,
  product,
  subCategory,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import {
  catalogProductCode,
  composePartialSku,
  lockSkuAllocation,
  nextSkuCode,
  SKU_SEGMENT_DIGITS,
} from "./generate-sku";

type Database = typeof db;

const CORE_CODE_PATTERN = new RegExp(
  `^\\d{1,${SKU_SEGMENT_DIGITS.coreProduct}}$`,
);

/**
 * Allocate a core product's serial within its category/subcategory and build
 * its 8-digit catalog code (Type, Category, SubCategory, Core). Call inside the
 * transaction that inserts or updates the core product.
 */
export async function assignCoreProductCode(
  database: Database,
  input: {
    categoryId: number;
    subCategoryId?: number | null;
    /** Admin-chosen core code; auto-assigned when empty. */
    requestedSku?: string | null;
    /** The core product being re-coded, excluded from the uniqueness check. */
    excludeCoreProductId?: number;
  },
): Promise<{ sku: string; catalogCode: string }> {
  const subCategoryId = input.subCategoryId || null;
  const [cat, sub] = await Promise.all([
    database.query.category.findFirst({
      where: eq(category.id, input.categoryId),
      columns: { skuCode: true },
      with: { type: { columns: { skuCode: true } } },
    }),
    subCategoryId
      ? database.query.subCategory.findFirst({
          where: eq(subCategory.id, subCategoryId),
          columns: { skuCode: true, categoryId: true },
        })
      : Promise.resolve(null),
  ]);
  if (!cat) {
    throw new ORPCError("BAD_REQUEST", { message: "Category not found" });
  }
  if (subCategoryId && (!sub || sub.categoryId !== input.categoryId)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Sub category does not belong to selected category",
    });
  }
  if (!cat.type?.skuCode || !cat.skuCode || (sub && !sub.skuCode)) {
    throw new ORPCError("BAD_REQUEST", {
      message:
        "The selected Type, Category, or Sub Category has no code yet, so a catalog ID cannot be issued",
    });
  }

  const scope = and(
    subCategoryId
      ? eq(coreProductIdentity.subCategoryId, subCategoryId)
      : and(
          eq(coreProductIdentity.categoryId, input.categoryId),
          isNull(coreProductIdentity.subCategoryId),
        ),
    input.excludeCoreProductId
      ? ne(coreProductIdentity.id, input.excludeCoreProductId)
      : undefined,
  );

  let sku: string;
  const requested = input.requestedSku?.trim();
  if (requested) {
    if (!CORE_CODE_PATTERN.test(requested) || Number(requested) === 0) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Core product code must be a number from 1 to ${"9".repeat(SKU_SEGMENT_DIGITS.coreProduct)}`,
      });
    }
    sku = requested.padStart(SKU_SEGMENT_DIGITS.coreProduct, "0");
    await lockSkuAllocation(coreProductIdentity, database);
    const taken = await database.query.coreProductIdentity.findFirst({
      where: and(scope, eq(coreProductIdentity.sku, sku)),
      columns: { id: true },
    });
    if (taken) {
      throw new ORPCError("CONFLICT", {
        message: `Core product code "${sku}" is already used in this category`,
      });
    }
  } else {
    sku = await nextSkuCode(
      coreProductIdentity,
      coreProductIdentity.sku,
      SKU_SEGMENT_DIGITS.coreProduct,
      sql`${scope}`,
      database,
    );
  }

  return {
    sku,
    catalogCode: composePartialSku("coreProduct", {
      typeSkuCode: cat.type.skuCode,
      categorySkuCode: cat.skuCode,
      subCategorySkuCode: sub?.skuCode,
      coreProductSkuCode: sku,
    }),
  };
}

/**
 * Copy a core product's current classification and catalog code onto every
 * admin, warehouse, and shop product built from it, so the shared Catalog
 * Product ID (core code + brand code) follows a reclassification.
 */
export async function syncProductsToCoreProduct(
  database: Database,
  core: {
    id: number;
    catalogCode: string;
    categoryId: number;
    subCategoryId: number | null;
  },
): Promise<void> {
  const brandCode = sql`(SELECT LPAD(${brand.skuCode}, ${SKU_SEGMENT_DIGITS.brand}, '0') FROM ${brand} WHERE ${brand.id} = ${product.brandId} AND ${brand.skuCode} IS NOT NULL)`;
  const catalogCode = sql`${core.catalogCode} || ${brandCode}`;
  await database
    .update(product)
    .set({
      categoryId: core.categoryId,
      subCategoryId: core.subCategoryId,
      catalogCode: sql`${catalogCode}`,
      // Admin products use the Catalog Product ID as their SKU.
      sku: sql`CASE WHEN ${product.creatorSource} = 'admin' THEN COALESCE(${catalogCode}, ${product.sku}) ELSE ${product.sku} END`,
    })
    .where(eq(product.coreProductId, core.id));
}

/**
 * Rebuild the catalog codes of core products after a Type, Category, or
 * Sub Category code above them changed (for example a category moved to
 * another Type), then carry the new codes onto their products.
 */
export async function refreshCoreCatalogCodes(
  database: Database,
  scope: { categoryId: number } | { subCategoryId: number },
): Promise<void> {
  const cores = await database.query.coreProductIdentity.findMany({
    where:
      "categoryId" in scope
        ? eq(coreProductIdentity.categoryId, scope.categoryId)
        : eq(coreProductIdentity.subCategoryId, scope.subCategoryId),
    columns: {
      id: true,
      sku: true,
      catalogCode: true,
      categoryId: true,
      subCategoryId: true,
    },
    with: {
      category: {
        columns: { skuCode: true },
        with: { type: { columns: { skuCode: true } } },
      },
      subCategory: { columns: { skuCode: true } },
    },
  });

  for (const core of cores) {
    if (!core.category?.type?.skuCode || !core.category.skuCode) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "The new Type or Category has no code yet, so its products' catalog IDs cannot be issued",
      });
    }
    const catalogCode = composePartialSku("coreProduct", {
      typeSkuCode: core.category.type.skuCode,
      categorySkuCode: core.category.skuCode,
      subCategorySkuCode: core.subCategory?.skuCode,
      coreProductSkuCode: core.sku,
    });
    if (catalogCode !== core.catalogCode) {
      await database
        .update(coreProductIdentity)
        .set({ catalogCode })
        .where(eq(coreProductIdentity.id, core.id));
    }
    await syncProductsToCoreProduct(database, { ...core, catalogCode });
  }
}

/**
 * Shared Catalog Product ID for a core product + brand pair, read from the
 * stored core catalog code and brand code. Null when either is missing.
 */
export async function loadCatalogProductCode(
  database: Database,
  coreProductId: number | null | undefined,
  brandId: number | null | undefined,
): Promise<string | null> {
  if (!coreProductId || !brandId) return null;
  const [core, brandRow] = await Promise.all([
    database.query.coreProductIdentity.findFirst({
      where: eq(coreProductIdentity.id, coreProductId),
      columns: { catalogCode: true },
    }),
    database.query.brand.findFirst({
      where: eq(brand.id, brandId),
      columns: { skuCode: true },
    }),
  ]);
  return catalogProductCode(core?.catalogCode, brandRow?.skuCode);
}
