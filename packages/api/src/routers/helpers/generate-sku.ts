/**
 * Structured SKU Generator
 *
 * Generates SKU codes in the format: AT-IF-0009270210
 *
 *   AT  -  IF  -  000  92  70  210
 *   │      │      │    │   │   └── User/Owner ID (last 3 digits, zero-padded)
 *   │      │      │    │   └────── Color ID (2 digits, 00 if N/A)
 *   │      │      │    └────────── Size ID (2 digits, 00 if N/A)
 *   │      │      └────────────── Serial number (3 digits, zero-padded)
 *   │      └────────────────────── Category code (first 2 chars of slug, uppercase)
 *   └────────────────────────────── SubCategory code (first 2 chars of slug, uppercase)
 */

export interface GenerateSkuInput {
    /** Slug of the subcategory (e.g. "attar", "rice") */
    subCategorySlug: string;
    /** Slug of the parent category (e.g. "iftar-items", "grocery") */
    categorySlug: string;
    /** Sequential serial number for this product within the category */
    serialNumber: number;
    /** Size ID from the product variant (0 if N/A) */
    sizeId?: number;
    /** Color ID from the product variant (0 if N/A) */
    colorId?: number;
    /** Numeric user/warehouse ID — last 3 digits are used */
    userId: string | number;
}

/**
 * Extract the first 2 alphabetic characters from a slug and uppercase them.
 * Falls back to "XX" if the slug has fewer than 2 alpha chars.
 */
function slugCode(slug: string): string {
    const alpha = slug.replace(/[^a-zA-Z]/g, "").toUpperCase();
    return (alpha.slice(0, 2) || "XX").padEnd(2, "X");
}

/**
 * Extract the last N digits from a string/number, zero-padded.
 */
function lastDigits(value: string | number, n: number): string {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length === 0) return "0".repeat(n);
    return digits.slice(-n).padStart(n, "0");
}

/**
 * Generate a structured SKU code.
 *
 * @example
 * generateSku({
 *   subCategorySlug: "attar",
 *   categorySlug: "iftar-items",
 *   serialNumber: 0,
 *   sizeId: 92,
 *   colorId: 70,
 *   userId: 210,
 * })
 * // → "AT-IF-0009270210"
 */
export function generateSku(input: GenerateSkuInput): string {
    const subCat = slugCode(input.subCategorySlug);     // 2 chars
    const cat = slugCode(input.categorySlug);            // 2 chars
    const serial = String(input.serialNumber).padStart(3, "0").slice(-3); // 3 digits
    const size = String(input.sizeId ?? 0).padStart(2, "0").slice(-2);    // 2 digits
    const color = String(input.colorId ?? 0).padStart(2, "0").slice(-2);  // 2 digits
    const uid = lastDigits(input.userId, 3);              // 3 digits

    return `${subCat}-${cat}-${serial}${size}${color}${uid}`;
}
