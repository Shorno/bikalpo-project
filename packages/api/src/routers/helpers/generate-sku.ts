/**
 * Hierarchical SKU Generator
 *
 * Generates SKU codes in the format: TT-CCC-SSS-PPP-BB-VV (15 digits)
 *
 *   01 - 001 - 001 - 001 - 01 - 04
 *   │     │     │     │     │    └── Variant Option code  (2 digits)
 *   │     │     │     │     └────── Brand code            (2 digits)
 *   │     │     │     └──────────── Core Product code     (3 digits)
 *   │     │     └────────────────── SubCategory code      (3 digits)
 *   │     └──────────────────────── Category code         (3 digits)
 *   └────────────────────────────── Product Type code     (2 digits)
 *
 * Example:
 *   Grocery(01) → Rice(001) → Miniket(001) → Miniket Rice(001) → ACI(01) → 5KG Pack(04)
 *   Full SKU: 01-001-001-001-01-04  (flat: 010010010010104)
 */

import { db } from "@bikalpo-project/db";
import { sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

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

export interface ComposeSkuInput {
    /** Product Type skuCode (2 digits) */
    typeSkuCode: string;
    /** Category skuCode (3 digits) */
    categorySkuCode: string;
    /** SubCategory skuCode (3 digits) */
    subCategorySkuCode: string;
    /** Core Product Identity sku (3 digits) */
    coreProductSkuCode: string;
    /** Brand skuCode (2 digits) */
    brandSkuCode: string;
    /** Variant Option skuCode (2 digits) */
    variantSkuCode: string;
}

/**
 * Compose a full 15-digit flat SKU from component codes.
 *
 * @example
 * composeSku({
 *   typeSkuCode: "01",
 *   categorySkuCode: "001",
 *   subCategorySkuCode: "001",
 *   coreProductSkuCode: "001",
 *   brandSkuCode: "01",
 *   variantSkuCode: "04",
 * })
 * // → "010010010010104"
 */
export function composeSku(input: ComposeSkuInput): string {
    return [
        input.typeSkuCode.padStart(2, "0"),
        input.categorySkuCode.padStart(3, "0"),
        input.subCategorySkuCode.padStart(3, "0"),
        input.coreProductSkuCode.padStart(3, "0"),
        input.brandSkuCode.padStart(2, "0"),
        input.variantSkuCode.padStart(2, "0"),
    ].join("");
}

/**
 * Format a flat 15-digit SKU into dashed display format.
 *
 * @example
 * formatSkuDisplay("010010010010104")
 * // → "01-001-001-001-01-04"
 */
export function formatSkuDisplay(sku: string): string {
    if (sku.length !== 15) return sku; // fallback for non-standard
    return [
        sku.slice(0, 2),   // Type
        sku.slice(2, 5),   // Category
        sku.slice(5, 8),   // SubCategory
        sku.slice(8, 11),  // Core Product
        sku.slice(11, 13), // Brand
        sku.slice(13, 15), // Variant
    ].join("-");
}

/**
 * Parse a flat 15-digit SKU back into component codes.
 *
 * @example
 * parseSku("010010010010104")
 * // → { typeSkuCode: "01", categorySkuCode: "001", ... }
 */
export function parseSku(sku: string): ComposeSkuInput {
    const flat = sku.replace(/-/g, "");
    if (flat.length !== 15) {
        throw new Error(`Invalid SKU length: expected 15 digits, got ${flat.length}`);
    }
    return {
        typeSkuCode: flat.slice(0, 2),
        categorySkuCode: flat.slice(2, 5),
        subCategorySkuCode: flat.slice(5, 8),
        coreProductSkuCode: flat.slice(8, 11),
        brandSkuCode: flat.slice(11, 13),
        variantSkuCode: flat.slice(13, 15),
    };
}

/**
 * Compose a partial SKU for a given level (useful for display in lists).
 *
 * @example
 * composePartialSku("type", { typeSkuCode: "01" })
 * // → "01"
 *
 * composePartialSku("category", { typeSkuCode: "01", categorySkuCode: "001" })
 * // → "01-001"
 */
export function composePartialSku(
    level: "type" | "category" | "subCategory" | "coreProduct" | "brand" | "variant",
    codes: Partial<ComposeSkuInput>,
): string {
    const parts: string[] = [];

    if (codes.typeSkuCode) parts.push(codes.typeSkuCode.padStart(2, "0"));
    if (level === "type") return parts.join("-");

    if (codes.categorySkuCode) parts.push(codes.categorySkuCode.padStart(3, "0"));
    if (level === "category") return parts.join("-");

    if (codes.subCategorySkuCode) parts.push(codes.subCategorySkuCode.padStart(3, "0"));
    if (level === "subCategory") return parts.join("-");

    if (codes.coreProductSkuCode) parts.push(codes.coreProductSkuCode.padStart(3, "0"));
    if (level === "coreProduct") return parts.join("-");

    if (codes.brandSkuCode) parts.push(codes.brandSkuCode.padStart(2, "0"));
    if (level === "brand") return parts.join("-");

    if (codes.variantSkuCode) parts.push(codes.variantSkuCode.padStart(2, "0"));
    return parts.join("-");
}

// ============================================================
// Legacy SKU generator (backward compatible)
// Used by product.ts and admin-product-variant.ts
// ============================================================

interface GenerateSkuInput {
    subCategorySlug: string;
    categorySlug: string;
    serialNumber: number;
    sizeId?: number;
    userId?: string;
}

/**
 * Legacy SKU generator for product-level and variant-level SKUs.
 * Produces a slug-based SKU like "SUG-WSG-0001" or "SUG-WSG-0001-50".
 */
export function generateSku(input: GenerateSkuInput): string {
    const catCode = input.categorySlug.slice(0, 3).toUpperCase();
    const subCatCode = input.subCategorySlug.slice(0, 3).toUpperCase();
    const serial = String(input.serialNumber).padStart(4, "0");
    const base = `${catCode}-${subCatCode}-${serial}`;
    if (input.sizeId && input.sizeId > 0) {
        return `${base}-${input.sizeId}`;
    }
    return base;
}
