"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, PackageSearch, Printer, Search } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Barcode } from "./barcode";
import {
  clampCopies,
  defaultChoice,
  filterLabelProducts,
  LABEL_PAPER,
  type LabelChoice,
  labelPriceText,
  MAX_COPIES,
  type PrintableLabel,
  type PrintLabelProduct,
  printQueue,
} from "./print-label-model";

export type PrintLabelsFilter = { productIds?: number[]; coreProductId?: number };

export type FetchPrintLabels = (
  input: PrintLabelsFilter,
) => Promise<PrintLabelProduct[]>;

/** Labels shown in the preview; printing always sends every copy. */
const PREVIEW_LIMIT = 6;

/**
 * Print label: pick the sizes and Types, type the unit, set copies, check
 * the preview, then print on 70 × 40 mm label paper. Opened for one product
 * or catalog item (its labels start ticked) or for all the seller's products.
 */
export function PrintLabelsDialog({
  open,
  onOpenChange,
  queryKey,
  fetchLabels,
  filter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Distinguishes the retailer and warehouse caches. */
  queryKey: readonly unknown[];
  fetchLabels: FetchPrintLabels;
  /** One product's (or catalog item's) labels, ticked to start; all when left out. */
  filter?: PrintLabelsFilter;
}) {
  const input = filter ?? {};
  const query = useQuery({
    queryKey: [...queryKey, "printLabels", input],
    queryFn: () => fetchLabels(input),
    enabled: open,
    staleTime: 30_000,
  });
  const products = query.data ?? [];
  const [search, setSearch] = useState("");
  const [choices, setChoices] = useState<Record<string, LabelChoice>>({});

  // Fresh choices each time the dialog opens with new data; a single
  // product's labels start ticked.
  const seeded = useRef<unknown>(null);
  useEffect(() => {
    if (!open) {
      seeded.current = null;
      return;
    }
    if (!query.data || seeded.current === query.data) return;
    seeded.current = query.data;
    const next: Record<string, LabelChoice> = {};
    for (const product of query.data) {
      for (const label of product.labels) {
        next[label.key] = defaultChoice(label, Boolean(filter));
      }
    }
    setChoices(next);
    setSearch("");
  }, [open, query.data, filter]);

  const visible = useMemo(() => filterLabelProducts(products, search), [products, search]);
  const queue = useMemo(() => printQueue(products, choices), [products, choices]);
  const labelCount = products.reduce((sum, product) => sum + product.labels.length, 0);

  const update = (key: string, change: Partial<LabelChoice>) =>
    setChoices((current) => {
      const existing = current[key];
      return existing ? { ...current, [key]: { ...existing, ...change } } : current;
    });

  const sheetRef = useRef<HTMLDivElement>(null);
  const print = () => {
    if (queue.length === 0 || !sheetRef.current) return;
    if (!printLabelSheet(sheetRef.current.innerHTML)) {
      toast.error("The labels could not be sent to the printer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Print labels</DialogTitle>
          <DialogDescription>
            Paper size: {LABEL_PAPER.name}. Choose the labels, type the unit and set
            the copies.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
          <section aria-label="Labels" className="flex min-h-0 flex-col gap-3">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product, brand, size or barcode"
                aria-label="Search labels"
                className="pl-9"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border max-md:max-h-[40dvh]">
              {query.isLoading ? (
                <Status>
                  <Loader2 className="size-4 animate-spin" />
                  Loading labels…
                </Status>
              ) : query.isError ? (
                <Status>
                  <span>{query.error?.message || "Could not load labels."}</span>
                  <Button size="sm" variant="outline" onClick={() => query.refetch()}>
                    Try again
                  </Button>
                </Status>
              ) : labelCount === 0 ? (
                <Status>
                  <PackageSearch className="size-6 text-muted-foreground" />
                  <span>
                    {products.length === 0
                      ? "No active products to print labels for."
                      : "These sizes have no barcode yet."}
                  </span>
                </Status>
              ) : visible.length === 0 ? (
                <Status>No label matches “{search.trim()}”.</Status>
              ) : (
                <ul className="divide-y">
                  {visible.map((product) => (
                    <ProductLabels
                      key={product.productId}
                      product={product}
                      choices={choices}
                      onChange={update}
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section aria-label="Preview" className="flex min-h-0 flex-col gap-2">
            <h3 className="text-sm font-medium">
              Preview <span className="text-muted-foreground">· {LABEL_PAPER.name}</span>
            </h3>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/40 p-3">
              {queue.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Tick a label to see it here.
                </p>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  {queue.slice(0, PREVIEW_LIMIT).map((label) => (
                    <div
                      key={label.id}
                      className="origin-top shadow-sm ring-1 ring-foreground/20"
                      style={{ zoom: 0.92 }}
                    >
                      <LabelCard label={label} />
                    </div>
                  ))}
                  {queue.length > PREVIEW_LIMIT ? (
                    <p className="text-xs text-muted-foreground">
                      and {queue.length - PREVIEW_LIMIT} more
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {queue.length} {queue.length === 1 ? "label" : "labels"} to print
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={print} disabled={queue.length === 0}>
              <Printer className="size-4" />
              Print
            </Button>
          </div>
        </DialogFooter>

        {/* Every copy, laid out for the printer; copied into the print frame. */}
        <div ref={sheetRef} hidden>
          {queue.map((label) => (
            <LabelCard key={label.id} label={label} printable />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductLabels({
  product,
  choices,
  onChange,
}: {
  product: PrintLabelProduct;
  choices: Record<string, LabelChoice>;
  onChange: (key: string, change: Partial<LabelChoice>) => void;
}) {
  return (
    <li className="p-3">
      <p className="text-sm font-medium">
        {product.name}
        {product.brandName && !product.name.includes(product.brandName) ? (
          <span className="text-muted-foreground"> · {product.brandName}</span>
        ) : null}
      </p>
      {product.labels.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">No barcode for these sizes yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {product.labels.map((label) => {
            const choice = choices[label.key];
            if (!choice) return null;
            const name = [label.sizeLabel, label.saleType].filter(Boolean).join(" · ");
            const id = `label-${label.key}`;
            return (
              <li
                key={label.key}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-md bg-muted/30 p-2 sm:grid-cols-[auto_minmax(0,1fr)_7rem_5rem]"
              >
                <Checkbox
                  id={id}
                  checked={choice.selected}
                  onCheckedChange={(checked) =>
                    onChange(label.key, { selected: checked === true })
                  }
                />
                <label htmlFor={id} className="min-w-0 cursor-pointer">
                  <span className="block truncate text-sm">{name}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {label.code}
                    {label.price != null ? ` · ${labelPriceText(label.price)}` : " · No price"}
                  </span>
                </label>
                <Input
                  aria-label={`Unit for ${name}`}
                  value={choice.unit}
                  onChange={(event) => onChange(label.key, { unit: event.target.value })}
                  placeholder="Unit"
                  maxLength={12}
                  className="h-8 max-sm:col-start-2"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_COPIES}
                  aria-label={`Copies of ${name}`}
                  value={choice.copies}
                  onChange={(event) =>
                    onChange(label.key, {
                      copies: clampCopies(Number(event.target.value)),
                      selected: true,
                    })
                  }
                  className="h-8 max-sm:col-start-2"
                />
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

const card: CSSProperties = {
  boxSizing: "border-box",
  width: `${LABEL_PAPER.widthMm}mm`,
  height: `${LABEL_PAPER.heightMm}mm`,
  padding: "2.5mm 3.5mm",
  display: "flex",
  flexDirection: "column",
  background: "#fff",
  color: "#000",
  fontFamily: "Arial, Helvetica, sans-serif",
  overflow: "hidden",
};

/**
 * The default label: brand; "Container: number unit" | price; the bars;
 * the 13-digit code. Inline styles so the print frame needs no app CSS.
 */
function LabelCard({ label, printable = false }: { label: PrintableLabel; printable?: boolean }) {
  return (
    <div className={printable ? "label" : undefined} style={card}>
      <div
        style={{
          fontSize: "11pt",
          fontWeight: 700,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.2,
        }}
      >
        {label.brand}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
          alignItems: "center",
          columnGap: "2.5mm",
          marginTop: "1mm",
          fontSize: "9pt",
          lineHeight: 1.2,
        }}
      >
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label.sizeText}
        </span>
        <span style={{ width: 0, height: "4.5mm", borderLeft: "0.3mm solid #000" }} />
        <span style={{ textAlign: "right", fontSize: "11pt", fontWeight: 700, whiteSpace: "nowrap" }}>
          {label.priceText}
        </span>
      </div>
      <Barcode code={label.code} style={{ flex: 1, minHeight: 0, marginTop: "2mm" }} />
      <div
        style={{
          marginTop: "1mm",
          fontSize: "9pt",
          letterSpacing: "0.12em",
          fontFamily: "'Courier New', Courier, monospace",
          lineHeight: 1.1,
        }}
      >
        {label.code}
      </div>
    </div>
  );
}

/** Prints the labels from a hidden frame, one label per 70 × 40 mm page. */
function printLabelSheet(labelsHtml: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  if (!win || !doc) {
    frame.remove();
    return false;
  }
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>` +
      `@page{size:${LABEL_PAPER.widthMm}mm ${LABEL_PAPER.heightMm}mm;margin:0}` +
      `html,body{margin:0;padding:0;background:#fff}` +
      `.label{break-after:page;page-break-after:always}` +
      `.label:last-child{break-after:auto;page-break-after:auto}` +
      `*{-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
      `</style></head><body>${labelsHtml}</body></html>`,
  );
  doc.close();
  const cleanup = () => window.setTimeout(() => frame.remove(), 500);
  win.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => {
    win.focus();
    win.print();
    // Some browsers never fire afterprint for a frame.
    window.setTimeout(() => frame.isConnected && frame.remove(), 60_000);
  }, 100);
  return true;
}
