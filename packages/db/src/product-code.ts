/**
 * 13-digit product code (client spec, 2026-11-24), printed as the barcode:
 *
 *   02020117   0   03   02
 *   │          │   │    └── Type code   (2 digits: New 01, Exchange 02...)
 *   │          │   └─────── Size code   (2 digits: the variant option's code)
 *   │          └─────────── Separator   (always 0)
 *   └────────────────────── Product ID  (8 digits: the core identity's code)
 *
 * Brand is not part of it, so brands under one core identity share codes;
 * a search shows every brand with that code. Codes are worked out from the
 * stored product ID, size codes and Type prices, never stored on their own.
 */

/** Type codes, in the order of the Type variant attribute. */
export const SALE_TYPE_CODES: Readonly<Record<string, string>> = {
  New: "01",
  Exchange: "02",
  Refill: "03",
  Regular: "04",
  Premium: "05",
  Standard: "06",
};

/** Type code for products sold without a Type (everything but LPG for now). */
export const NO_SALE_TYPE_CODE = "00";

const PRODUCT_ID_PATTERN = /^\d{8}$/;
const TWO_DIGITS = /^\d{1,2}$/;
const PRODUCT_CODE_PATTERN = /^(\d{8})0(\d{2})(\d{2})$/;

/** The 13-digit code, or null when a part is missing or not digits. */
export function composeProductCode(
  productId: string | null | undefined,
  sizeCode: string | null | undefined,
  typeCode: string | null | undefined,
): string | null {
  const id = productId?.trim() ?? "";
  const size = sizeCode?.trim() ?? "";
  const type = typeCode?.trim() ?? "";
  if (!PRODUCT_ID_PATTERN.test(id) || !TWO_DIGITS.test(size)) return null;
  if (!TWO_DIGITS.test(type)) return null;
  return `${id}0${size.padStart(2, "0")}${type.padStart(2, "0")}`;
}

/** The parts of a typed or scanned 13-digit code, or null if it isn't one. */
export function parseProductCode(code: string) {
  const match = PRODUCT_CODE_PATTERN.exec(code.replace(/[\s-]/g, ""));
  if (!match) return null;
  const [, productId, sizeCode, typeCode] = match as unknown as [
    string,
    string,
    string,
    string,
  ];
  return { productId, sizeCode, typeCode };
}

type CodeVariantOption = {
  skuCode?: string | null;
  name?: string | null;
  definition?: unknown;
};

export type ProductCodeVariant = {
  variantOptionId: number;
  isActive?: boolean | null;
  /** Prices per Type from the LPG Variant Table; keys are the Types sold. */
  saleTypePrices?: Record<string, string> | null;
  exchangeEnabled?: boolean | null;
  variantOption?: CodeVariantOption | null;
};

export type ProductCode = {
  variantOptionId: number;
  /** Null for a product sold without a Type. */
  saleType: string | null;
  code: string;
};

function isCylinder(option: CodeVariantOption | null | undefined) {
  const definition = option?.definition as
    | { kind?: string; container?: string }
    | null
    | undefined;
  if (definition?.kind) {
    return definition.container?.trim().toLowerCase() === "cylinder";
  }
  return /cylinder/i.test(option?.name ?? "");
}

/**
 * The Types a size is sold as: the Variant Table's Types when saved; for a
 * cylinder saved before it, New (and Exchange when it is on); otherwise none.
 */
export function saleTypesOf(variant: ProductCodeVariant): Array<string | null> {
  const saved = variant.saleTypePrices;
  if (saved && typeof saved === "object" && Object.keys(saved).length > 0) {
    const known = Object.keys(SALE_TYPE_CODES).filter((type) => type in saved);
    const unknown = Object.keys(saved).filter(
      (type) => !(type in SALE_TYPE_CODES),
    );
    return [...known, ...unknown];
  }
  if (isCylinder(variant.variantOption)) {
    return variant.exchangeEnabled ? ["New", "Exchange"] : ["New"];
  }
  return [null];
}

/**
 * Every 13-digit code of a product: one per active size and Type. Sizes
 * without a size code and Types without a Type code get none.
 */
export function productCodesFor(
  productId: string | null | undefined,
  variants: ProductCodeVariant[] | null | undefined,
): ProductCode[] {
  const codes: ProductCode[] = [];
  for (const variant of variants ?? []) {
    if (variant.isActive === false) continue;
    const sizeCode = variant.variantOption?.skuCode;
    for (const saleType of saleTypesOf(variant)) {
      const typeCode =
        saleType === null ? NO_SALE_TYPE_CODE : SALE_TYPE_CODES[saleType];
      const code = composeProductCode(productId, sizeCode, typeCode);
      if (code) {
        codes.push({ variantOptionId: variant.variantOptionId, saleType, code });
      }
    }
  }
  return codes;
}
