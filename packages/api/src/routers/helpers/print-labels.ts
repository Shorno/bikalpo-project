import { db } from "@bikalpo-project/db";
import { productCodesFor } from "@bikalpo-project/db/product-code";
import {
  brand,
  coreProductIdentity,
  inventory,
  product,
  productVariant,
  productVariantPrice,
  variantOption,
} from "@bikalpo-project/db/schema";
import {
  getVariantDefinition,
  type VariantOptionLike,
} from "@bikalpo-project/db/variant-definition";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { type ProductListOwner, ownerProductCondition } from "./owner-product-list";

/**
 * Print label (client, 2026-11-25): one label per size and Type of the
 * seller's own products. A label shows the brand, "Container: number unit"
 * (the unit is typed when printing), the price on the right of a divider,
 * and the barcode with its 13-digit code.
 */

export const printLabelsInput = z.object({
  /** Only these of the seller's products; all active products when left out. */
  productIds: z.array(z.number().int().positive()).max(200).optional(),
  /** Only the seller's products of this catalog item (any brand). */
  coreProductId: z.number().int().positive().optional(),
});

export type PrintLabel = {
  /** variantId + Type, unique within the response. */
  key: string;
  variantId: number;
  /** The size as the seller sees it, e.g. "12 KG cylinder". */
  sizeLabel: string;
  saleType: string | null;
  /** The 13-digit product code the barcode carries. */
  code: string;
  /** That Type's price for the size; null when none is set. */
  price: number | null;
  /** "Cylinder", "Pack"…: the first word of the label's second line. */
  container: string;
  /** The size number, e.g. "12". */
  number: string;
  /** Suggested unit (e.g. "KG"); the seller can change it when printing. */
  unit: string;
};

export type PrintLabelProduct = {
  productId: number;
  name: string;
  brandName: string | null;
  labels: PrintLabel[];
};

export type PrintLabelRow = {
  productId: number;
  productName: string;
  brandName: string | null;
  catalogCode: string | null;
  variantId: number;
  variantOptionId: number;
  exchangeEnabled: boolean | null;
  variantOption: (VariantOptionLike & { skuCode: string | null }) | null;
  saleTypePrices: Record<string, string> | null;
  /** The seller's selling price (inventory), else the variant's base price. */
  sellingPrice: string | number | null;
};

const tidy = (value: string | null | undefined) =>
  value?.trim().replace(/\s+/g, " ") ?? "";

const capitalize = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

function toPrice(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Container, number and unit of a size for the label's second line. */
export function labelSizeParts(option: VariantOptionLike | null) {
  const definition = getVariantDefinition(option);
  if (definition?.kind === "measurement") {
    return {
      container: capitalize(tidy(definition.container)) || "Pack",
      number: tidy(definition.value),
      unit: tidy(definition.measurementUnit).toUpperCase(),
    };
  }
  if (definition?.kind === "loose") {
    return {
      container: "Loose",
      number: "",
      unit: tidy(definition.measurementUnit).toUpperCase(),
    };
  }
  if (definition?.kind === "attribute") {
    return {
      container: capitalize(tidy(definition.attribute)) || "Pack",
      number: tidy(definition.value),
      unit: "",
    };
  }
  return {
    container: "Pack",
    number: tidy(option?.size) || tidy(option?.displayAlias) || tidy(option?.name),
    unit: tidy(option?.unit).toUpperCase(),
  };
}

/**
 * The price on a label: the Pricing table's price for that Type; New (and
 * a size sold without a Type) falls back to the selling price.
 */
export function labelPrice(row: PrintLabelRow, saleType: string | null) {
  if (saleType !== null) {
    const typed = toPrice(row.saleTypePrices?.[saleType]);
    if (typed !== null) return typed;
    return saleType === "New" ? toPrice(row.sellingPrice) : null;
  }
  return toPrice(row.sellingPrice);
}

function sizeLabelOf(option: VariantOptionLike | null) {
  const parts = labelSizeParts(option);
  return (
    tidy(option?.displayAlias) ||
    tidy(option?.name) ||
    [parts.number, parts.unit, parts.container].filter(Boolean).join(" ")
  );
}

/** Groups variant rows into products with one label per size and Type. */
export function buildPrintLabels(rows: PrintLabelRow[]): PrintLabelProduct[] {
  const products = new Map<number, PrintLabelProduct>();
  for (const row of rows) {
    let entry = products.get(row.productId);
    if (!entry) {
      entry = {
        productId: row.productId,
        name: row.productName,
        brandName: row.brandName,
        labels: [],
      };
      products.set(row.productId, entry);
    }
    const codes = productCodesFor(row.catalogCode, [
      {
        variantOptionId: row.variantOptionId,
        saleTypePrices: row.saleTypePrices,
        exchangeEnabled: row.exchangeEnabled,
        variantOption: row.variantOption,
      },
    ]);
    const parts = labelSizeParts(row.variantOption);
    for (const code of codes) {
      entry.labels.push({
        key: `${row.variantId}:${code.saleType ?? ""}`,
        variantId: row.variantId,
        sizeLabel: sizeLabelOf(row.variantOption),
        saleType: code.saleType,
        code: code.code,
        price: labelPrice(row, code.saleType),
        ...parts,
      });
    }
  }
  return [...products.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      (a.brandName ?? "").localeCompare(b.brandName ?? ""),
  );
}

/** The seller's active products, sizes and Types, ready to print. */
export async function loadPrintLabels(
  owner: ProductListOwner,
  input: z.infer<typeof printLabelsInput> = {},
): Promise<PrintLabelProduct[]> {
  if (input.productIds && input.productIds.length === 0) return [];
  const variants = await db
    .select({
      productId: product.id,
      productName: product.name,
      brandName: brand.name,
      catalogCode: coreProductIdentity.catalogCode,
      variantId: productVariant.id,
      variantBrandId: productVariant.brandId,
      variantOptionId: variantOption.id,
      exchangeEnabled: productVariant.exchangeEnabled,
      variantOption: {
        name: variantOption.name,
        unit: variantOption.unit,
        size: variantOption.size,
        variantType: variantOption.variantType,
        definitionKind: variantOption.definitionKind,
        definition: variantOption.definition,
        displayAlias: variantOption.displayAlias,
        needsReview: variantOption.needsReview,
        skuCode: variantOption.skuCode,
      },
      basePrice: productVariant.price,
      retailPrice: inventory.retailPrice,
    })
    .from(product)
    .innerJoin(
      productVariant,
      and(eq(productVariant.productId, product.id), eq(productVariant.isActive, true)),
    )
    .innerJoin(variantOption, eq(productVariant.sourceVariantOptionId, variantOption.id))
    .leftJoin(brand, eq(product.brandId, brand.id))
    .leftJoin(coreProductIdentity, eq(product.coreProductId, coreProductIdentity.id))
    .leftJoin(
      inventory,
      and(
        eq(inventory.variantId, productVariant.id),
        eq(inventory.ownerType, owner.ownerType),
        eq(inventory.ownerId, owner.ownerId),
      ),
    )
    .where(
      and(
        ownerProductCondition(owner),
        eq(product.status, "active"),
        input.productIds ? inArray(product.id, input.productIds) : undefined,
        input.coreProductId ? eq(product.coreProductId, input.coreProductId) : undefined,
      ),
    )
    .orderBy(product.name, product.id, variantOption.sortOrder, productVariant.sortOrder);
  if (variants.length === 0) return [];

  const prices = await db
    .select({
      productId: productVariantPrice.productId,
      variantOptionId: productVariantPrice.variantOptionId,
      brandId: productVariantPrice.brandId,
      saleTypePrices: productVariantPrice.saleTypePrices,
    })
    .from(productVariantPrice)
    .where(
      inArray(productVariantPrice.productId, [
        ...new Set(variants.map((row) => row.productId)),
      ]),
    );
  const typePricesOf = (row: (typeof variants)[number]) => {
    const matches = prices.filter(
      (price) =>
        price.productId === row.productId &&
        price.variantOptionId === row.variantOptionId,
    );
    const match =
      matches.find((price) => price.brandId === row.variantBrandId) ?? matches[0];
    return (match?.saleTypePrices as Record<string, string> | null) ?? null;
  };

  return buildPrintLabels(
    variants.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      brandName: row.brandName,
      catalogCode: row.catalogCode,
      variantId: row.variantId,
      variantOptionId: row.variantOptionId,
      exchangeEnabled: row.exchangeEnabled,
      variantOption: row.variantOption as PrintLabelRow["variantOption"],
      saleTypePrices: typePricesOf(row),
      sellingPrice: row.retailPrice ?? row.basePrice,
    })),
  );
}
