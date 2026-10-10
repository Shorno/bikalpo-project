/**
 * Hierarchical SKU Generator
 *
 * Catalog Product ID format: TT-CC-SS-PPP-BB (11 digits)
 * Variant SKU appends the variant option code: TT-CC-SS-PPP-BB-VV (13 digits)
 *
 *   01 - 01 - 01 - 001 - 01 - 04
 *   │    │    │    │     │    └── Variant Option code  (2 digits)
 *   │    │    │    │     └─────── Brand code            (2 digits)
 *   │    │    │    └───────────── Core Product code     (3 digits)
 *   │    │    └────────────────── SubCategory code      (2 digits, "00" when none)
 *   │    └─────────────────────── Category code         (2 digits)
 *   └──────────────────────────── Product Type code     (2 digits)
 *
 * Example:
 *   Grocery(01) → Rice(01) → Miniket(01) → Miniket Rice(001) → ACI(01) → 5KG Pack(04)
 *   Catalog Product ID: 01-01-01-001-01
 *   Variant SKU:        01-01-01-001-01-04  (flat: 0101010010104)
 */

import { db } from "@bikalpo-project/db";
import { sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

/** Digit width of each hierarchical SKU segment. */
export const SKU_SEGMENT_DIGITS = {
    type: 2,
    category: 2,
    subCategory: 2,
    coreProduct: 3,
    brand: 2,
    variant: 2,
} as const;

// ============================================================
// Auto-assign next available skuCode
// ============================================================

/**
 * Get the next available N-digit skuCode for a table.
 *
 * @param table - The Drizzle table to query
 * @param skuColumn - The skuCode column
 * @param digits - Number of digits (2 or 3)
 * @param filterConditions - Optional SQL conditions for scoped uniqueness
 * @returns Zero-padded string like "01", "001", etc.
 */
export async function nextSkuCode(
    table: PgTable,
    skuColumn: PgColumn,
    digits: 2 | 3,
    filterConditions?: ReturnType<typeof sql>,
    database: Pick<typeof db, "execute"> = db,
): Promise<string> {
    // Find the maximum existing skuCode within the scope
    const query = filterConditions
        ? sql`SELECT COALESCE(MAX(CAST(${skuColumn} AS INTEGER)), 0) AS max_code FROM ${table} WHERE ${filterConditions}`
        : sql`SELECT COALESCE(MAX(CAST(${skuColumn} AS INTEGER)), 0) AS max_code FROM ${table}`;

    const result = await database.execute(query);
    const maxCode = Number(result.rows?.[0]?.max_code ?? 0);
    const nextCode = maxCode + 1;

    const maxValue = digits === 2 ? 99 : 999;
    if (nextCode > maxValue) {
        throw new Error(
            `SKU code overflow: cannot generate a ${digits}-digit code beyond ${maxValue}`,
        );
    }

    return String(nextCode).padStart(digits, "0");
}

// ============================================================
// Compose / Parse / Format full SKU
// ============================================================

export interface CatalogProductIdInput {
    /** Product Type skuCode (2 digits) */
    typeSkuCode?: string | null;
    /** Category skuCode (2 digits) */
    categorySkuCode?: string | null;
    /** SubCategory skuCode (2 digits); "00" when the product has no subcategory */
    subCategorySkuCode?: string | null;
    /** Core Product Identity sku (3 digits) */
    coreProductSkuCode?: string | null;
    /** Brand skuCode (2 digits) */
    brandSkuCode?: string | null;
}

export interface ComposeSkuInput extends CatalogProductIdInput {
    /** Variant Option skuCode (2 digits) */
    variantSkuCode?: string | null;
}

function segment(code: string | null | undefined, digits: number): string {
    return (code?.trim() || "").padStart(digits, "0");
}

function productSegments(input: CatalogProductIdInput): string[] {
    return [
        segment(input.typeSkuCode, SKU_SEGMENT_DIGITS.type),
        segment(input.categorySkuCode, SKU_SEGMENT_DIGITS.category),
        segment(input.subCategorySkuCode, SKU_SEGMENT_DIGITS.subCategory),
        segment(input.coreProductSkuCode, SKU_SEGMENT_DIGITS.coreProduct),
        segment(input.brandSkuCode, SKU_SEGMENT_DIGITS.brand),
    ];
}

/**
 * Compose the dashed Catalog Product ID (type-category-subcategory-core-brand).
 * Missing segments are zero-filled, so a product without a subcategory gets "00".
 *
 * @example
 * composeCatalogProductId({
 *   typeSkuCode: "01",
 *   categorySkuCode: "01",
 *   subCategorySkuCode: "01",
 *   coreProductSkuCode: "001",
 *   brandSkuCode: "01",
 * })
 * // → "01-01-01-001-01"
 */
export function composeCatalogProductId(input: CatalogProductIdInput): string {
    return productSegments(input).join("-");
}

/**
 * Compose a full 13-digit flat variant SKU from component codes.
 *
 * @example
 * composeSku({ ...catalogProductCodes, variantSkuCode: "04" })
 * // → "0101010010104"
 */
export function composeSku(input: ComposeSkuInput): string {
    return [
        ...productSegments(input),
        segment(input.variantSkuCode, SKU_SEGMENT_DIGITS.variant),
    ].join("");
}

const SEGMENT_ORDER = [
    ["typeSkuCode", SKU_SEGMENT_DIGITS.type],
    ["categorySkuCode", SKU_SEGMENT_DIGITS.category],
    ["subCategorySkuCode", SKU_SEGMENT_DIGITS.subCategory],
    ["coreProductSkuCode", SKU_SEGMENT_DIGITS.coreProduct],
    ["brandSkuCode", SKU_SEGMENT_DIGITS.brand],
    ["variantSkuCode", SKU_SEGMENT_DIGITS.variant],
] as const;

const FULL_SKU_LENGTH = SEGMENT_ORDER.reduce((sum, [, digits]) => sum + digits, 0);

function splitFlatSku(flat: string): string[] {
    const parts: string[] = [];
    let offset = 0;
    for (const [, digits] of SEGMENT_ORDER) {
        parts.push(flat.slice(offset, offset + digits));
        offset += digits;
    }
    return parts;
}

/**
 * Format a flat 13-digit SKU into dashed display format.
 *
 * @example
 * formatSkuDisplay("0101010010104")
 * // → "01-01-01-001-01-04"
 */
export function formatSkuDisplay(sku: string): string {
    if (sku.length !== FULL_SKU_LENGTH) return sku; // fallback for non-standard
    return splitFlatSku(sku).join("-");
}

/**
 * Parse a 13-digit SKU (flat or dashed) back into component codes.
 *
 * @example
 * parseSku("0101010010104")
 * // → { typeSkuCode: "01", categorySkuCode: "01", ... }
 */
export function parseSku(sku: string): Required<ComposeSkuInput> {
    const flat = sku.replace(/-/g, "");
    if (flat.length !== FULL_SKU_LENGTH) {
        throw new Error(
            `Invalid SKU length: expected ${FULL_SKU_LENGTH} digits, got ${flat.length}`,
        );
    }
    const parts = splitFlatSku(flat);
    return Object.fromEntries(
        SEGMENT_ORDER.map(([key], index) => [key, parts[index]]),
    ) as Required<ComposeSkuInput>;
}

/**
 * Compose a partial SKU up to a given level (useful for display in lists).
 * Missing segments are zero-filled so every segment keeps its position.
 *
 * @example
 * composePartialSku("type", { typeSkuCode: "01" })
 * // → "01"
 *
 * composePartialSku("category", { typeSkuCode: "01", categorySkuCode: "01" })
 * // → "01-01"
 */
export function composePartialSku(
    level: "type" | "category" | "subCategory" | "coreProduct" | "brand" | "variant",
    codes: ComposeSkuInput,
): string {
    const levelKey = {
        type: "typeSkuCode",
        category: "categorySkuCode",
        subCategory: "subCategorySkuCode",
        coreProduct: "coreProductSkuCode",
        brand: "brandSkuCode",
        variant: "variantSkuCode",
    }[level];

    const parts: string[] = [];
    for (const [key, digits] of SEGMENT_ORDER) {
        parts.push(segment(codes[key], digits));
        if (key === levelKey) break;
    }
    return parts.join("-");
}
