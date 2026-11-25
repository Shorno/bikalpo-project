"use client";

import { ChevronDown, Layers3, Loader2, PackageSearch, Search } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type BatchRow,
  type BatchSize,
  brandColor,
  EMPTY,
  formatBatchDate,
  formatBatchQty,
  matchesBatchSearch,
} from "./batch-stock-model";

type BatchStockQuery = {
  data?: { sizes: unknown[] };
  isLoading: boolean;
  isError: boolean;
  error: { message: string } | null;
  refetch: () => unknown;
};

/**
 * Batch (client, 2026-11-25): each product size with its batches that
 * still hold stock. View opens the batch's details under the table.
 */
export function BatchStockPage({ query }: { query: BatchStockQuery }) {
  const { data, isLoading, isError, error, refetch } = query;
  const sizes = (data?.sizes ?? []) as BatchSize[];
  const [search, setSearch] = useState("");
  const shown = sizes.filter((size) => matchesBatchSearch(size, search));

  return (
    <div className="min-w-0 space-y-4 md:space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5 shadow-sm max-md:p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Layers3 aria-hidden="true" className="size-5" />
          </span>
          <h1 className="text-lg font-semibold tracking-tight">Batch</h1>
        </div>
        <label className="relative w-full max-w-xs max-md:max-w-none">
          <span className="sr-only">Search batches</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product or batch..."
            className="pl-8"
          />
        </label>
      </header>

      {isLoading ? (
        <Notice>
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading batches…
          </span>
        </Notice>
      ) : isError ? (
        <Notice>
          <p className="font-medium">Could not load batches</p>
          <p className="text-sm text-muted-foreground">
            {error?.message || "Please try again."}
          </p>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </Notice>
      ) : shown.length === 0 ? (
        <Notice>
          <PackageSearch className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">
            {sizes.length === 0 ? "No batches with stock" : "No batch found"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {sizes.length === 0
              ? "Stock added with a batch number shows here."
              : "No product or batch matches this search."}
          </p>
        </Notice>
      ) : (
        shown.map((size) => <ProductBatches key={size.variantId} size={size} />)
      )}
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-12 text-center shadow-sm">
      {children}
    </div>
  );
}

const HEAD = "whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-muted-foreground max-md:px-3";
const CELL = "whitespace-nowrap px-4 py-2.5 tabular-nums max-md:px-3";

function ProductBatches({ size }: { size: BatchSize }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = size.batches.find((batch) => batch.key === openKey) ?? null;
  const detailId = `batch-details-${size.variantId}`;

  return (
    <section
      aria-label={`${size.productName} ${size.sizeLabel}`}
      className="overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <h2 className="border-b px-4 py-3 text-[15px] font-semibold max-md:px-3">
        {size.productName} {size.sizeLabel}
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th scope="col" className={HEAD}>Batch ID</th>
              <th scope="col" className={HEAD}>MFG Date</th>
              <th scope="col" className={HEAD}>EXP Date</th>
              <th scope="col" className={HEAD}>Manufactured</th>
              <th scope="col" className={HEAD}>Stock</th>
              <th scope="col" className={`${HEAD} text-right`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {size.batches.map((batch) => {
              const selected = batch.key === openKey;
              return (
                <tr
                  key={batch.key}
                  data-state={selected ? "selected" : undefined}
                  className="border-b last:border-0 data-[state=selected]:bg-muted/50"
                >
                  <td className={`${CELL} font-medium`}>{batch.batchNo}</td>
                  <td className={CELL}>{formatBatchDate(batch.manufactureDate)}</td>
                  <td className={CELL}>{formatBatchDate(batch.expiryDate)}</td>
                  <td className={CELL}>{batch.manufacturedCode || EMPTY}</td>
                  <td className={`${CELL} font-semibold`}>
                    {formatBatchQty(batch.stockQty, size.unit)}
                  </td>
                  <td className={`${CELL} text-right`}>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-expanded={selected}
                      aria-controls={detailId}
                      onClick={() => setOpenKey(selected ? null : batch.key)}
                    >
                      {selected ? "Hide" : "View"}
                      <ChevronDown
                        aria-hidden="true"
                        className={`size-4 transition-transform ${selected ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open ? <BatchDetails id={detailId} size={size} batch={open} /> : null}
    </section>
  );
}

function BatchDetails({
  id,
  size,
  batch,
}: {
  id: string;
  size: BatchSize;
  batch: BatchRow;
}) {
  const left: Array<[string, string]> = [
    ["Batch ID", batch.batchNo],
    ["Product", size.productName],
    ["Brand/Color", brandColor(size)],
    ["Variant/Size", size.sizeLabel],
    ["Manufacture Date", formatBatchDate(batch.manufactureDate, true)],
  ];
  const right: Array<[string, string]> = [
    ["Received Quantity", formatBatchQty(batch.receivedQty, size.unit)],
    ["Expiry Date", formatBatchDate(batch.expiryDate, true)],
    ["Supplier", batch.supplierName || EMPTY],
    ["Purchase Invoice", batch.invoiceNo || EMPTY],
    ["Sold", formatBatchQty(batch.soldQty, size.unit)],
  ];

  return (
    <div id={id} className="border-t border-l-2 border-l-primary/60 bg-muted/30 px-4 py-4 max-md:px-3">
      <h3 className="mb-3 text-sm font-semibold">Batch Details</h3>
      <div className="grid gap-x-10 gap-y-2 md:grid-cols-2">
        {[left, right].map((fields, column) => (
          <dl key={column} className="space-y-2 text-sm">
            {fields.map(([label, value]) => (
              <div key={label} className="flex gap-3">
                <dt className="w-36 shrink-0 text-muted-foreground">{label}</dt>
                <dd className="min-w-0 break-words font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </div>
  );
}
