import { db } from "@bikalpo-project/db";
import {
  brand,
  catalogVariant,
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
 * Allocate a core product's code within its category/subcategory and build its
 * permanent catalog code (Type-Category-SubCategory-Core). Call inside the
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
      3,
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
 * True once a core product's catalog code has been handed out to products or
 * catalog variants. From then on the code, and the classification it encodes,
 * must not change.
 */
export async function isCoreCatalogCodeInUse(
  database: Database,
  coreProductId: number,
): Promise<boolean> {
  const [usedByProduct, usedByVariant] = await Promise.all([
    database.query.product.findFirst({
      where: eq(product.coreProductId, coreProductId),
      columns: { id: true },
    }),
    database.query.catalogVariant.findFirst({
      where: eq(catalogVariant.coreProductId, coreProductId),
      columns: { id: true },
    }),
  ]);
  return Boolean(usedByProduct || usedByVariant);
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
