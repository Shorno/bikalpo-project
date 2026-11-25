import type {
  PrintLabel,
  PrintLabelProduct,
} from "@bikalpo-project/api/routers/helpers/print-labels";

/**
 * Print label (client, 2026-11-25): one default label design, printed on
 * 70 × 40 mm label paper. Shared by the retailer and warehouse panels.
 */

export type { PrintLabel, PrintLabelProduct };

export const LABEL_PAPER = { widthMm: 70, heightMm: 40, name: "70 × 40 mm" } as const;

export const MAX_COPIES = 100;

/** What the seller chose for one label: printed or not, copies, the unit typed. */
export type LabelChoice = { selected: boolean; copies: number; unit: string };

export type PrintableLabel = {
  /** Unique per printed copy. */
  id: string;
  brand: string;
  sizeText: string;
  priceText: string;
  code: string;
};

export function labelPriceText(price: number | null) {
  if (price == null) return "";
  return `৳${price.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

/** The label's second line: "Cylinder: 12 KG". */
export function labelSizeText(label: Pick<PrintLabel, "container" | "number">, unit: string) {
  const value = [label.number, unit.trim()].filter(Boolean).join(" ");
  return value ? `${label.container}: ${value}` : label.container;
}

export function defaultChoice(label: PrintLabel, selected: boolean): LabelChoice {
  return { selected, copies: 1, unit: label.unit };
}

export function clampCopies(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_COPIES, Math.max(1, Math.round(value)));
}

/** Every copy to print, in list order. */
export function printQueue(
  products: PrintLabelProduct[],
  choices: Record<string, LabelChoice>,
): PrintableLabel[] {
  const queue: PrintableLabel[] = [];
  for (const product of products) {
    for (const label of product.labels) {
      const choice = choices[label.key];
      if (!choice?.selected) continue;
      const printable = {
        brand: product.brandName || product.name,
        sizeText: labelSizeText(label, choice.unit),
        priceText: labelPriceText(label.price),
        code: label.code,
      };
      for (let copy = 0; copy < clampCopies(choice.copies); copy += 1) {
        queue.push({ ...printable, id: `${label.key}#${copy}` });
      }
    }
  }
  return queue;
}

/** Search by product, brand, size, Type or the 13-digit code. */
export function filterLabelProducts(products: PrintLabelProduct[], search: string) {
  const text = search.trim().toLowerCase();
  const digits = text.replace(/[\s-]/g, "");
  if (!text) return products;
  return products.flatMap((product) => {
    const productMatch = [product.name, product.brandName].some((field) =>
      (field ?? "").toLowerCase().includes(text),
    );
    if (productMatch) return [product];
    const labels = product.labels.filter(
      (label) =>
        (digits && label.code.includes(digits)) ||
        [label.sizeLabel, label.saleType].some((field) =>
          (field ?? "").toLowerCase().includes(text),
        ),
    );
    return labels.length ? [{ ...product, labels }] : [];
  });
}
