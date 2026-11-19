import {
  formatVariantDefinition,
  getVariantDefinition,
  type VariantOptionLike,
} from "@bikalpo-project/db/variant-definition";

/** Labels and the LPG price table for the catalog product page. */

export type DetailVariantPrice = {
  id: number;
  consumerPrice?: string | number | null;
  exchangeEnabled?: boolean | null;
  /** Credit taken off the New price for an Exchange (cylinder swap). */
  exchangeCreditAmount?: string | number | null;
  variantOption?: (VariantOptionLike & { id: number }) | null;
};

const tidy = (value: string | null | undefined) =>
  value?.trim().replace(/\s+/g, " ") ?? "";

function amount(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** "12 KG" for a measured variant; otherwise its readable name. */
export function variantOptionLabel(
  option: DetailVariantPrice["variantOption"],
): string {
  const definition = getVariantDefinition(option);
  if (definition?.kind === "measurement") {
    return `${tidy(definition.value)} ${tidy(definition.measurementUnit).toUpperCase()}`;
  }
  if (definition) return formatVariantDefinition(definition);
  return (
    tidy(option?.displayAlias) ||
    tidy(option?.name) ||
    tidy(option?.size) ||
    "Variant"
  );
}

function sizeValue(option: DetailVariantPrice["variantOption"]) {
  const definition = getVariantDefinition(option);
  const value =
    definition?.kind === "measurement" ? Number(definition.value) : Number.NaN;
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

/** Smallest size first; unmeasured variants keep their order at the end. */
export function sortVariantsBySize<T extends DetailVariantPrice>(
  variants: T[],
): T[] {
  return variants
    .map((variant, index) => ({ variant, index }))
    .sort(
      (a, b) =>
        sizeValue(a.variant.variantOption) -
          sizeValue(b.variant.variantOption) || a.index - b.index,
    )
    .map(({ variant }) => variant);
}

/** The unit stock is counted in, e.g. "Cylinder", from the variants' container. */
export function inventoryUnitLabel(variants: DetailVariantPrice[]) {
  for (const variant of variants) {
    const definition = getVariantDefinition(variant.variantOption);
    const unit =
      definition?.kind === "measurement"
        ? definition.container
        : definition?.operationalUnit;
    const text = tidy(unit);
    if (text) return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return null;
}

export function hasExchangeOption(variants: DetailVariantPrice[]) {
  return variants.some((variant) => variant.exchangeEnabled === true);
}

export type LpgPriceRow = {
  id: number;
  capacity: string;
  /** Null when the variant does not take exchanges or has no price. */
  exchangePrice: number | null;
  newPrice: number | null;
};

/** One row per cylinder size: Exchange price = New price − exchange credit. */
export function lpgPriceRows(variants: DetailVariantPrice[]): LpgPriceRow[] {
  return sortVariantsBySize(variants).map((variant) => {
    const newPrice = amount(variant.consumerPrice);
    const credit = amount(variant.exchangeCreditAmount) ?? 0;
    return {
      id: variant.id,
      capacity: variantOptionLabel(variant.variantOption),
      newPrice,
      exchangePrice:
        variant.exchangeEnabled && newPrice !== null
          ? Math.max(0, newPrice - credit)
          : null,
    };
  });
}
