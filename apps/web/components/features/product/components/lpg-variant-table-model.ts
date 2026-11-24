/**
 * LPG Variant Table (client layout): each row ticks one or more Type options
 * (New, Exchange, Refill...) and lists the sizes sold that way. A size that
 * appears in several rows is sold every way those rows tick. Stock is kept
 * per size; the Type only decides how a cylinder is sold and its price.
 */

export const DEFAULT_LPG_TYPE_OPTIONS = [
  "New",
  "Exchange",
  "Refill",
  "Regular",
  "Premium",
  "Standard",
] as const;

export type VariantTableRow = {
  types: string[];
  /** Comma-separated sizes as typed, e.g. "12 KG, 15 KG". */
  sizes: string;
};

export type LpgSize = {
  /** Kilograms as a plain number string: "12", "12.5". */
  value: string;
  label: string;
};

export type SizeSaleTypes = {
  size: LpgSize;
  /** In the order of the Type options. */
  types: string[];
};

const SIZE_PATTERN = /^(\d+(?:\.\d+)?)\s*(?:kg|kgs)?$/i;

/**
 * "30, 12 KG, 15kg" → 12 KG, 15 KG, 30 KG (smallest first, no repeats).
 * Anything else is invalid.
 */
export function parseSizeList(text: string): {
  sizes: LpgSize[];
  invalid: string[];
} {
  const sizes: LpgSize[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(",")) {
    const part = raw.trim().replace(/[.;]+$/, "").trim();
    if (!part) continue;
    const match = SIZE_PATTERN.exec(part);
    const number = match ? Number(match[1]) : Number.NaN;
    if (!match || !Number.isFinite(number) || number <= 0) {
      invalid.push(part);
      continue;
    }
    const value = String(number);
    if (sizes.some((size) => size.value === value)) continue;
    sizes.push({ value, label: `${value} KG` });
  }
  sizes.sort((a, b) => Number(a.value) - Number(b.value));
  return { sizes, invalid };
}

function orderTypes(types: Iterable<string>, typeOptions: readonly string[]) {
  const wanted = new Set(types);
  const known = typeOptions.filter((type) => wanted.has(type));
  const unknown = [...wanted].filter((type) => !typeOptions.includes(type));
  return [...known, ...unknown];
}

/**
 * Every size in the table with the Type options it is sold as, smallest
 * size first. Rows with no ticked Type or no size are ignored.
 */
export function sizeSaleTypes(
  rows: VariantTableRow[],
  typeOptions: readonly string[],
): SizeSaleTypes[] {
  const bySize = new Map<string, { size: LpgSize; types: Set<string> }>();
  for (const row of rows) {
    if (row.types.length === 0) continue;
    for (const size of parseSizeList(row.sizes).sizes) {
      const entry = bySize.get(size.value) ?? { size, types: new Set() };
      for (const type of row.types) entry.types.add(type);
      bySize.set(size.value, entry);
    }
  }
  return [...bySize.values()]
    .sort((a, b) => Number(a.size.value) - Number(b.size.value))
    .map((entry) => ({
      size: entry.size,
      types: orderTypes(entry.types, typeOptions),
    }));
}

/**
 * Saved sizes back into table rows: sizes sold the same ways share a row,
 * smallest size first. The table always has `rowCount` rows.
 */
export function rowsFromSizeSaleTypes(
  entries: SizeSaleTypes[],
  typeOptions: readonly string[],
  rowCount: number,
): VariantTableRow[] {
  const groups = new Map<string, { types: string[]; sizes: string[] }>();
  const bySize = [...entries].sort(
    (a, b) => Number(a.size.value) - Number(b.size.value),
  );
  for (const entry of bySize) {
    if (entry.types.length === 0) continue;
    const types = orderTypes(entry.types, typeOptions);
    const key = types.join("|");
    const group = groups.get(key) ?? { types, sizes: [] };
    group.sizes.push(entry.size.label);
    groups.set(key, group);
  }
  const rows: VariantTableRow[] = [...groups.values()].map((group) => ({
    types: group.types,
    sizes: group.sizes.join(", "),
  }));
  while (rows.length < rowCount) rows.push({ types: [], sizes: "" });
  return rows;
}

/** A Variant Table and the prices typed in its Pricing grid. */
export type LpgTable = {
  rows: VariantTableRow[];
  prices: Record<string, string>;
};

/**
 * Saved sizes (KG + Type → price) back into a table. A size listed twice
 * keeps its first entry; a size with no Type is left out.
 */
export function lpgTableFromSizes(
  saved: Array<{ kg: string; saleTypePrices: Record<string, string> }>,
  typeOptions: readonly string[],
): LpgTable {
  const entries: SizeSaleTypes[] = [];
  const prices: Record<string, string> = {};
  for (const item of saved) {
    if (entries.some((entry) => entry.size.value === item.kg)) continue;
    const types = Object.keys(item.saleTypePrices);
    if (types.length === 0) continue;
    entries.push({ size: { value: item.kg, label: `${item.kg} KG` }, types });
    for (const [type, price] of Object.entries(item.saleTypePrices)) {
      prices[salePriceKey(item.kg, type)] = price ?? "";
    }
  }
  return {
    rows: rowsFromSizeSaleTypes(entries, typeOptions, typeOptions.length),
    prices,
  };
}

/** Each size's Type → price map for saving ("" when not priced). */
export function saleTypePricesFor(
  entry: SizeSaleTypes,
  prices: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    entry.types.map((type) => [
      type,
      (prices[salePriceKey(entry.size.value, type)] ?? "").trim(),
    ]),
  );
}

/** Problems that stop a save: bad sizes, no size, Exchange above New. */
export function lpgTableError(
  table: LpgTable,
  typeOptions: readonly string[],
): string | null {
  const invalid = table.rows.flatMap((row) => parseSizeList(row.sizes).invalid);
  if (invalid.length > 0) return `Not a size in KG: ${invalid.join(", ")}`;
  const entries = sizeSaleTypes(table.rows, typeOptions);
  if (entries.length === 0) return "Tick a Type and enter at least one size";
  return (
    entries.map((entry) => salePriceError(entry, table.prices)).find(Boolean) ??
    null
  );
}

export function emptyVariantTableRows(rowCount: number): VariantTableRow[] {
  return Array.from({ length: rowCount }, () => ({ types: [], sizes: "" }));
}

export function salePriceKey(sizeValue: string, type: string) {
  return `${sizeValue}|${type}`;
}

/** The kilograms of a cylinder variant option, or null if it is not one. */
export function cylinderKgOf(option: {
  name?: string | null;
  definition?: unknown;
}): string | null {
  const definition = option.definition as
    | {
        kind?: string;
        value?: string;
        measurementUnit?: string;
        container?: string;
      }
    | null
    | undefined;
  if (
    definition?.kind === "measurement" &&
    definition.measurementUnit?.trim().toLowerCase() === "kg" &&
    definition.container?.trim().toLowerCase() === "cylinder"
  ) {
    const number = Number(definition.value);
    return Number.isFinite(number) && number > 0 ? String(number) : null;
  }
  if (definition?.kind) return null;
  // Older options without a definition: read "12KG Cylinder" from the name.
  const match = /(\d+(?:\.\d+)?)\s*kg\b/i.exec(option.name ?? "");
  return match ? String(Number(match[1])) : null;
}

/** "" or a non-negative amount with up to 2 decimals. */
function amount(value: string | undefined) {
  if (!value?.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** A size sold both New and Exchange cannot have Exchange dearer than New. */
export function salePriceError(
  entry: SizeSaleTypes,
  prices: Record<string, string | undefined>,
): string | null {
  if (!entry.types.includes("New") || !entry.types.includes("Exchange")) {
    return null;
  }
  const newPrice = amount(prices[salePriceKey(entry.size.value, "New")]);
  const exchangePrice = amount(
    prices[salePriceKey(entry.size.value, "Exchange")],
  );
  if (newPrice != null && exchangePrice != null && exchangePrice > newPrice) {
    return `${entry.size.label}: Exchange price can't be more than the New price.`;
  }
  return null;
}
