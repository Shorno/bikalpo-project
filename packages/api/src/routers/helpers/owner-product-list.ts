import { db } from "@bikalpo-project/db";
import {
  category,
  coreProductIdentity,
  inventory,
  product,
  productType,
  productVariant,
  subCategory,
  variantOption,
} from "@bikalpo-project/db/schema";
import {
  formatVariantDefinition,
  getVariantDefinition,
  type VariantOptionLike,
} from "@bikalpo-project/db/variant-definition";
import { and, eq, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

/**
 * The Products page shared by the wholesaler (Warehouse Owner) and retailer
 * (Shop Owner) panels: one row per Brand Product the owner configured, with
 * no stock columns. Stock lives on the Stock pages.
 */

export const ownerProductListInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  /** Product name or Product ID. */
  search: z.string().trim().max(100).optional(),
  typeId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  subCategoryId: z.number().int().positive().optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  sortBy: z
    .enum(["name_asc", "name_desc", "value_desc", "value_asc"])
    .default("name_asc"),
});

export type OwnerProductListInput = z.infer<typeof ownerProductListInput>;

/** One owner variant (or a product with no variants yet) as loaded from the database. */
export type OwnerProductVariantRow = {
  productId: number;
  productName: string;
  productCode: string | null;
  productStatus: string;
  coreProductName: string | null;
  typeId: number | null;
  typeName: string | null;
  /** `lpg` for the Gas type; brand-inclusive names are shown only there. */
  family: string | null;
  categoryId: number;
  categoryName: string;
  subCategoryId: number | null;
  subCategoryName: string | null;
  variantId: number | null;
  variantOption: VariantOptionLike | null;
  variantUnitLabel: string | null;
  availableQty: string | number | null;
  price: string | number | null;
};

export type OwnerProductListItem = {
  productId: number;
  /** Shared Product ID (core catalog code + brand code). */
  productCode: string | null;
  name: string;
  typeId: number | null;
  categoryId: number;
  categoryName: string;
  subCategoryId: number | null;
  variantCount: number;
  /** The short variant label when the product has exactly one variant. */
  variantLabel: string | null;
  /** Σ available quantity × the owner's selling price, over active variants. */
  value: number;
  isActive: boolean;
};

export type OwnerProductFilterOption = {
  id: number;
  name: string;
  parentId: number | null;
};

const tidy = (value: string | null | undefined) =>
  value?.trim().replace(/\s+/g, " ") ?? "";

/**
 * A variant as the list shows it: value and unit only, e.g. "12KG", "5L",
 * "500G" — no brand and no container ("Cylinder", "Bottle").
 */
export function shortVariantLabel(
  option: VariantOptionLike | null,
  fallback?: string | null,
): string {
  const definition = getVariantDefinition(option);
  if (definition?.kind === "measurement") {
    const label = `${tidy(definition.value)}${tidy(definition.measurementUnit).toUpperCase()}`;
    if (label) return label;
  }
  if (definition?.kind === "attribute") {
    // "RAM Capacity 8GB" → "8GB": the attribute name repeats the product.
    const value = tidy(definition.value);
    if (value) return value;
  }
  if (definition) return formatVariantDefinition(definition);
  return (
    tidy(option?.displayAlias) ||
    tidy(option?.name) ||
    tidy(option?.size) ||
    tidy(fallback) ||
    "—"
  );
}

function toAmount(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Collapses variant rows into one row per product. Order is preserved. */
export function groupOwnerProducts(
  rows: OwnerProductVariantRow[],
): OwnerProductListItem[] {
  const groups = new Map<
    number,
    { first: OwnerProductVariantRow; variants: OwnerProductVariantRow[] }
  >();

  for (const row of rows) {
    const group = groups.get(row.productId);
    if (!group) {
      groups.set(row.productId, {
        first: row,
        variants: row.variantId === null ? [] : [row],
      });
    } else if (row.variantId !== null) {
      group.variants.push(row);
    }
  }

  return Array.from(groups.values(), ({ first, variants }) => {
    const value = variants.reduce(
      (sum, variant) =>
        sum +
        Math.max(0, toAmount(variant.availableQty)) * toAmount(variant.price),
      0,
    );
    const onlyVariant = variants.length === 1 ? variants[0] : null;
    return {
      productId: first.productId,
      productCode: first.productCode,
      name:
        first.family === "lpg"
          ? first.productName
          : tidy(first.coreProductName) || first.productName,
      typeId: first.typeId,
      categoryId: first.categoryId,
      categoryName: first.categoryName,
      subCategoryId: first.subCategoryId,
      variantCount: variants.length,
      variantLabel: onlyVariant
        ? shortVariantLabel(
            onlyVariant.variantOption,
            onlyVariant.variantUnitLabel,
          )
        : null,
      value: Math.round(value * 100) / 100,
      isActive: first.productStatus === "active",
    };
  });
}

/** Filter options built from the owner's own products, with parent ids for cascading. */
export function ownerProductFilterOptions(rows: OwnerProductVariantRow[]) {
  const types = new Map<number, OwnerProductFilterOption>();
  const categories = new Map<number, OwnerProductFilterOption>();
  const subCategories = new Map<number, OwnerProductFilterOption>();

  for (const row of rows) {
    if (row.typeId !== null && row.typeName) {
      types.set(row.typeId, {
        id: row.typeId,
        name: row.typeName,
        parentId: null,
      });
    }
    categories.set(row.categoryId, {
      id: row.categoryId,
      name: row.categoryName,
      parentId: row.typeId,
    });
    if (row.subCategoryId !== null && row.subCategoryName) {
      subCategories.set(row.subCategoryId, {
        id: row.subCategoryId,
        name: row.subCategoryName,
        parentId: row.categoryId,
      });
    }
  }

  const sorted = (map: Map<number, OwnerProductFilterOption>) =>
    Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  return {
    types: sorted(types),
    categories: sorted(categories),
    subCategories: sorted(subCategories),
  };
}

/** Applies the list filters, sort, and page to grouped products. */
export function queryOwnerProducts(
  items: OwnerProductListItem[],
  input: OwnerProductListInput,
) {
  const term = input.search?.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (input.typeId && item.typeId !== input.typeId) return false;
    if (input.categoryId && item.categoryId !== input.categoryId) return false;
    if (input.subCategoryId && item.subCategoryId !== input.subCategoryId)
      return false;
    if (input.status === "active" && !item.isActive) return false;
    if (input.status === "inactive" && item.isActive) return false;
    if (
      term &&
      !item.name.toLowerCase().includes(term) &&
      !(item.productCode ?? "").toLowerCase().includes(term)
    )
      return false;
    return true;
  });

  const byName = (a: OwnerProductListItem, b: OwnerProductListItem) =>
    a.name.localeCompare(b.name) ||
    (a.productCode ?? "").localeCompare(b.productCode ?? "");
  filtered.sort((a, b) => {
    switch (input.sortBy) {
      case "name_desc":
        return byName(b, a);
      case "value_desc":
        return b.value - a.value || byName(a, b);
      case "value_asc":
        return a.value - b.value || byName(a, b);
      default:
        return byName(a, b);
    }
  });

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / input.pageSize));
  const page = Math.min(input.page, totalPages);
  const start = (page - 1) * input.pageSize;

  return {
    items: filtered.slice(start, start + input.pageSize),
    pagination: { page, pageSize: input.pageSize, totalCount, totalPages },
  };
}

export type ProductListOwner =
  | { ownerType: "warehouse"; ownerId: string }
  | { ownerType: "shop"; ownerId: string };

function ownerProductCondition(owner: ProductListOwner): SQL {
  if (owner.ownerType === "warehouse") {
    return and(
      eq(product.creatorSource, "warehouse"),
      or(
        eq(product.createdById, owner.ownerId),
        eq(product.createdByWarehouseId, owner.ownerId),
      ),
    )!;
  }
  return and(
    eq(product.creatorSource, "shop"),
    eq(product.createdById, owner.ownerId),
  )!;
}

/** Every product the owner configured, active and inactive, one row per active variant. */
export async function loadOwnerProductRows(
  owner: ProductListOwner,
): Promise<OwnerProductVariantRow[]> {
  return db
    .select({
      productId: product.id,
      productName: product.name,
      productCode: product.catalogCode,
      productStatus: product.status,
      coreProductName: coreProductIdentity.name,
      typeId: productType.id,
      typeName: productType.name,
      family: productType.family,
      categoryId: category.id,
      categoryName: category.name,
      subCategoryId: subCategory.id,
      subCategoryName: subCategory.name,
      variantId: productVariant.id,
      variantOption: {
        name: variantOption.name,
        unit: variantOption.unit,
        size: variantOption.size,
        variantType: variantOption.variantType,
        definitionKind: variantOption.definitionKind,
        definition: variantOption.definition,
        displayAlias: variantOption.displayAlias,
        needsReview: variantOption.needsReview,
      },
      variantUnitLabel: productVariant.unitLabel,
      availableQty: inventory.availableQty,
      price: sql<
        string | null
      >`COALESCE(${inventory.retailPrice}, ${productVariant.price})`,
    })
    .from(product)
    .innerJoin(category, eq(product.categoryId, category.id))
    .leftJoin(subCategory, eq(product.subCategoryId, subCategory.id))
    .leftJoin(productType, eq(category.typeId, productType.id))
    .leftJoin(
      coreProductIdentity,
      eq(product.coreProductId, coreProductIdentity.id),
    )
    .leftJoin(
      productVariant,
      and(
        eq(productVariant.productId, product.id),
        eq(productVariant.isActive, true),
      ),
    )
    .leftJoin(
      variantOption,
      eq(productVariant.sourceVariantOptionId, variantOption.id),
    )
    .leftJoin(
      inventory,
      and(
        eq(inventory.variantId, productVariant.id),
        eq(inventory.ownerType, owner.ownerType),
        eq(inventory.ownerId, owner.ownerId),
      ),
    )
    .where(ownerProductCondition(owner))
    .orderBy(
      product.name,
      product.id,
      variantOption.sortOrder,
      productVariant.sortOrder,
    );
}

export async function getOwnerProductList(
  owner: ProductListOwner,
  input: OwnerProductListInput,
) {
  const rows = await loadOwnerProductRows(owner);
  const { items, pagination } = queryOwnerProducts(
    groupOwnerProducts(rows),
    input,
  );
  return { items, pagination, filterOptions: ownerProductFilterOptions(rows) };
}
