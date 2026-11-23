"use client";

import {
  INVENTORY_UNIT_VARIANT,
  type InventoryUnitCode,
  isInventoryUnit,
  priceModeOf,
} from "@bikalpo-project/db/product-client-options";
import {
  getVariantDefinition,
  type VariantDefinition,
  type VariantOptionLike,
} from "@bikalpo-project/db/variant-definition";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

/**
 * The client's Variant Table and Variant Pricing.
 *
 * Variant Table: two rows; each row ticks first-attribute options and types
 * second-attribute values ("12 KG, 30 KG"). Variant Pricing: one row per
 * second value, one "<option> Price (৳)" column per ticked option.
 *
 * Saving maps the matrix onto variant options, so stock, orders and price
 * pages work as before:
 *   - New / Exchange (or Refill) price the same variant: the selling price
 *     and the exchange price.
 *   - Any other option (Red, Premium...) makes its own variant per value,
 *     e.g. "Red / M", with one price.
 */

export type VariantMatrixRow = { selected: string[]; values: string };

export type VariantMatrix = {
  rows: [VariantMatrixRow, VariantMatrixRow];
  /** Price per `${secondValue}|${firstOption}`. */
  prices: Record<string, string>;
};

export const EMPTY_VARIANT_MATRIX: VariantMatrix = {
  rows: [
    { selected: [], values: "" },
    { selected: [], values: "" },
  ],
  prices: {},
};

export function normalizeVariantValue(value: string) {
  return String(value)
    .trim()
    .replace(/[.,;]+$/, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function splitVariantValues(text: string) {
  return [
    ...new Set(text.split(",").map(normalizeVariantValue).filter(Boolean)),
  ];
}

export const priceKey = (second: string, first: string) =>
  `${normalizeVariantValue(second)}|${first}`;

/** Rows with options and values, the sizes and the price columns. */
export function matrixShape(matrix: VariantMatrix) {
  const rows = matrix.rows
    .map((row) => ({
      first: row.selected,
      seconds: splitVariantValues(row.values),
    }))
    .filter((row) => row.first.length > 0 && row.seconds.length > 0);
  return {
    rows,
    sizes: [...new Set(rows.flatMap((row) => row.seconds))],
    headers: [...new Set(rows.flatMap((row) => row.first))],
  };
}

// ── Mapping onto variant options ────────────────────────────────

const MEASUREMENT = /^(\d+(?:\.\d+)?)\s*(kg|kgs|g|gm|gram|grams|l|ltr|litre|liter|ml)$/i;

function measurementUnitLabel(unit: string) {
  const lower = unit.toLowerCase();
  if (lower.startsWith("k")) return "KG";
  if (lower.startsWith("g")) return "Gram";
  if (lower === "ml") return "ML";
  return "L";
}

/** "12 KG", "500 G", "1 L", "500 ML" when a saved size is shown again. */
function sizeUnit(unit: string) {
  const label = measurementUnitLabel(unit);
  return label === "Gram" ? "G" : label;
}

/** The container a measured value is packed in, from the Inventory Unit. */
function containerFor(inventoryUnit: string, fallback: string) {
  if (!isInventoryUnit(inventoryUnit)) return fallback;
  const mapped = INVENTORY_UNIT_VARIANT[inventoryUnit as InventoryUnitCode];
  return "container" in mapped ? mapped.container : fallback;
}

/**
 * Variant option definition for one cell group:
 *   - a plain value ("12 KG" → measurement, "M" → attribute), or
 *   - a combination ("Red" × "M" → attribute "Colour / Size" = "Red / M").
 */
export function variantDefinitionFor({
  second,
  first,
  attr1,
  attr2,
  inventoryUnit,
  defaultContainer,
}: {
  second: string;
  first: string | null;
  attr1: string;
  attr2: string;
  inventoryUnit: string;
  defaultContainer: string;
}): VariantDefinition {
  const value = normalizeVariantValue(second);
  if (first) {
    return {
      kind: "attribute",
      attribute: `${attr1} / ${attr2}`.slice(0, 30),
      value: `${first} / ${value}`.slice(0, 30),
    };
  }
  const measured = value.match(MEASUREMENT);
  if (measured) {
    return {
      kind: "measurement",
      value: measured[1]!,
      measurementUnit: measurementUnitLabel(measured[2]!),
      container: containerFor(inventoryUnit, defaultContainer),
    };
  }
  return { kind: "attribute", attribute: attr2.slice(0, 30), value };
}

const tidy = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/** Same structure, ignoring case and spacing (how the API reuses options). */
export function sameDefinition(
  option: VariantOptionLike,
  definition: VariantDefinition,
) {
  const current = getVariantDefinition(option);
  if (!current || current.kind !== definition.kind) return false;
  if (current.kind === "measurement" && definition.kind === "measurement") {
    return (
      Number(current.value) === Number(definition.value) &&
      measurementUnitLabel(current.measurementUnit) ===
        measurementUnitLabel(definition.measurementUnit) &&
      tidy(current.container) === tidy(definition.container)
    );
  }
  if (current.kind === "attribute" && definition.kind === "attribute") {
    return (
      tidy(current.attribute) === tidy(definition.attribute) &&
      tidy(current.value) === tidy(definition.value)
    );
  }
  return false;
}

export type MatrixVariant = {
  definition: VariantDefinition;
  /** Label for messages, e.g. "12 KG" or "Red / M". */
  label: string;
  newPrice: string;
  exchangePrice: string;
};

/**
 * The variants the matrix asks for.
 *   - A value is a variant when a row links it to New / Exchange; options
 *     like Red link it as "Red / M".
 *   - A pricing cell outside the rows' links becomes a variant only when it
 *     has a price.
 * An empty price keeps the variant's current price. An Exchange price needs
 * a New price, and must be lower.
 */
export function matrixVariants(
  matrix: VariantMatrix,
  context: {
    attr1: string;
    attr2: string;
    inventoryUnit: string;
    defaultContainer: string;
  },
): { variants: MatrixVariant[]; error: string | null } {
  const { rows, sizes, headers } = matrixShape(matrix);
  const linked = new Set(
    rows.flatMap((row) =>
      row.seconds.flatMap((second) =>
        row.first.map((first) =>
          priceKey(second, priceModeOf(first) ? "" : first),
        ),
      ),
    ),
  );
  const newHeader = headers.find((header) => priceModeOf(header) === "new");
  const exchangeHeader = headers.find(
    (header) => priceModeOf(header) === "exchange",
  );
  const variants: MatrixVariant[] = [];
  for (const size of sizes) {
    const price = (header?: string) =>
      header ? (matrix.prices[priceKey(size, header)] ?? "").trim() : "";
    const newPrice = price(newHeader);
    const exchangePrice = price(exchangeHeader);
    if (exchangePrice && !newPrice) {
      return {
        variants: [],
        error: `Enter the ${newHeader ?? "New"} price for ${size} before its ${exchangeHeader} price`,
      };
    }
    if (exchangePrice && Number(exchangePrice) >= Number(newPrice)) {
      return {
        variants: [],
        error: `${exchangeHeader} price for ${size} must be lower than its ${newHeader} price`,
      };
    }
    if (newPrice || exchangePrice || linked.has(priceKey(size, ""))) {
      variants.push({
        definition: variantDefinitionFor({ second: size, first: null, ...context }),
        label: size,
        newPrice,
        exchangePrice,
      });
    }
    for (const header of headers) {
      if (priceModeOf(header)) continue;
      const combined = price(header);
      if (!combined && !linked.has(priceKey(size, header))) continue;
      variants.push({
        definition: variantDefinitionFor({ second: size, first: header, ...context }),
        label: `${header} / ${size}`,
        newPrice: combined,
        exchangePrice: "",
      });
    }
  }
  return { variants, error: null };
}

/**
 * The matrix for variants a product already has, so editing shows what is
 * saved. Plain variants go under New (and Exchange when priced); variants
 * made from a combination go under their own option.
 */
export function matrixFromVariants(
  saved: Array<{
    option?: VariantOptionLike | null;
    newPrice: string;
    exchangePrice: string;
  }>,
): VariantMatrix {
  const prices: Record<string, string> = {};
  const plainSizes: string[] = [];
  const comboSizes: string[] = [];
  const comboHeaders: string[] = [];
  let hasExchange = false;
  for (const row of saved) {
    const definition = getVariantDefinition(row.option);
    if (!definition) continue;
    if (definition.kind === "attribute" && definition.value.includes(" / ")) {
      const [first, ...rest] = definition.value.split(" / ");
      const second = rest.join(" / ");
      if (!first || !second) continue;
      comboHeaders.push(first);
      comboSizes.push(second);
      if (row.newPrice) prices[priceKey(second, first)] = row.newPrice;
      continue;
    }
    const size =
      definition.kind === "measurement"
        ? `${definition.value} ${sizeUnit(definition.measurementUnit)}`
        : definition.kind === "attribute"
          ? definition.value
          : null;
    if (!size) continue;
    plainSizes.push(size);
    if (row.newPrice) prices[priceKey(size, "New")] = row.newPrice;
    if (row.exchangePrice) {
      hasExchange = true;
      prices[priceKey(size, "Exchange")] = row.exchangePrice;
    }
  }
  const unique = (values: string[]) => [...new Set(values)];
  const plainRow: VariantMatrixRow = {
    selected:
      plainSizes.length > 0 ? (hasExchange ? ["New", "Exchange"] : ["New"]) : [],
    values: unique(plainSizes).join(", "),
  };
  const comboRow: VariantMatrixRow = {
    selected: unique(comboHeaders),
    values: unique(comboSizes).join(", "),
  };
  return {
    rows:
      plainSizes.length > 0
        ? [plainRow, comboRow]
        : [comboRow, { selected: [], values: "" }],
    prices,
  };
}

// ── UI ──────────────────────────────────────────────────────────

function Empty({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
      {children}
    </div>
  );
}

const TABLE = "w-full min-w-[520px] border-collapse text-xs";
const TH =
  "border-b bg-muted/50 px-3 py-2.5 text-left font-semibold text-muted-foreground";
const TD = "border-b px-3 py-2.5 align-top";

export function VariantTable({
  attr1,
  attr2,
  options,
  matrix,
  onChange,
}: {
  attr1: string;
  attr2: string;
  /** Options of the first attribute. */
  options: string[];
  matrix: VariantMatrix;
  onChange: (matrix: VariantMatrix) => void;
}) {
  if (!attr1 || !attr2 || attr1 === attr2) {
    return (
      <Empty>
        {attr1 && attr1 === attr2
          ? "Select two different attributes in Inventory & Product Rules."
          : "Select two attributes in Inventory & Product Rules to configure variants."}
      </Empty>
    );
  }
  // Ticked options no longer in the list (from a saved product) still show.
  const shown = [
    ...options,
    ...matrix.rows
      .flatMap((row) => row.selected)
      .filter((value, index, all) => all.indexOf(value) === index)
      .filter((value) => !options.includes(value)),
  ];
  const setRow = (index: 0 | 1, patch: Partial<VariantMatrixRow>) => {
    const rows = [...matrix.rows] as VariantMatrix["rows"];
    rows[index] = { ...rows[index], ...patch };
    onChange({ ...matrix, rows });
  };
  const { rows } = matrixShape(matrix);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className={TABLE}>
          <thead>
            <tr>
              <th className={`${TH} w-[58%]`}>
                Available {attr1} — select one or more
              </th>
              <th className={TH}>Available {attr2}</th>
            </tr>
          </thead>
          <tbody>
            {([0, 1] as const).map((index) => {
              const row = matrix.rows[index];
              return (
                <tr key={index} className="last:[&>td]:border-b-0">
                  <td className={TD}>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                      {shown.map((option) => {
                        const checked = row.selected.includes(option);
                        return (
                          <label
                            key={option}
                            className="flex min-w-0 cursor-pointer items-center gap-2 font-medium"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) =>
                                setRow(index, {
                                  selected:
                                    next === true
                                      ? [...row.selected, option]
                                      : row.selected.filter(
                                          (value) => value !== option,
                                        ),
                                })
                              }
                            />
                            <span className="truncate">{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  </td>
                  <td className={TD}>
                    <Input
                      aria-label={`Available ${attr2}, row ${index + 1}`}
                      className="h-8 min-w-[140px] text-xs"
                      placeholder="e.g. 12 KG, 30 KG"
                      value={row.values}
                      onChange={(event) =>
                        setRow(index, { values: event.target.value })
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <Empty>
          Select one or more attribute options and enter values to see the
          overview.
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Available {attr1}</th>
                <th className={TH}>Available {attr2}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="last:[&>td]:border-b-0">
                  <td className={`${TD} font-semibold`}>
                    {row.first.join(", ")}
                  </td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1.5">
                      {row.seconds.map((value) => (
                        <span
                          key={value}
                          className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary"
                        >
                          {value}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function VariantPricing({
  attr2,
  matrix,
  onChange,
}: {
  attr2: string;
  matrix: VariantMatrix;
  onChange: (matrix: VariantMatrix) => void;
}) {
  const { sizes, headers } = matrixShape(matrix);
  if (sizes.length === 0 || headers.length === 0) {
    return (
      <Empty>
        Pricing table will appear when you activate options and enter values.
      </Empty>
    );
  }
  const secondLabel = attr2.toLowerCase() === "size" ? "Size" : attr2;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TH}>{secondLabel}</th>
            {headers.map((header) => (
              <th key={header} className={TH}>
                {header} Price (৳)
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sizes.map((size) => (
            <tr key={size} className="last:[&>td]:border-b-0">
              <td className={`${TD} whitespace-nowrap font-semibold`}>{size}</td>
              {headers.map((header) => {
                const key = priceKey(size, header);
                return (
                  <td key={header} className={TD}>
                    <Input
                      aria-label={`${size} ${header} price`}
                      inputMode="decimal"
                      placeholder="0"
                      className="h-8 min-w-[105px] text-xs tabular-nums"
                      value={matrix.prices[key] ?? ""}
                      onChange={(event) => {
                        const next = event.target.value.trim();
                        if (!/^\d{0,8}(\.\d{0,2})?$/.test(next)) return;
                        onChange({
                          ...matrix,
                          prices: { ...matrix.prices, [key]: next },
                        });
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
