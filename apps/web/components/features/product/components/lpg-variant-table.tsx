"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  parseSizeList,
  salePriceError,
  salePriceKey,
  type SizeSaleTypes,
  type VariantTableRow,
} from "./lpg-variant-table-model";
import { PriceInput } from "./product-delivery-pricing";

/**
 * The client's Variant Table: one row per Type option. Row 1 shows; the
 * rest open on request. Each row ticks the Type options and lists the sizes
 * sold that way. The Overview below groups the sizes by row.
 */
export function LpgVariantTable({
  typeOptions,
  rows,
  onRowsChange,
}: {
  typeOptions: readonly string[];
  rows: VariantTableRow[];
  onRowsChange: (rows: VariantTableRow[]) => void;
}) {
  const idPrefix = useId();
  const usedExtraRows = rows.slice(1).some(
    (row) => row.types.length > 0 || row.sizes.trim() !== "",
  );
  const [expanded, setExpanded] = useState(usedExtraRows);
  const showAll = expanded || usedExtraRows;
  const visibleRows = showAll ? rows : rows.slice(0, 1);
  const hiddenCount = rows.length - 1;

  const updateRow = (index: number, patch: Partial<VariantTableRow>) => {
    onRowsChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  };

  const toggleType = (index: number, type: string, checked: boolean) => {
    const current = rows[index]?.types ?? [];
    const next = checked
      ? [...current.filter((item) => item !== type), type]
      : current.filter((item) => item !== type);
    updateRow(index, {
      types: typeOptions.filter((option) => next.includes(option)),
    });
  };

  const overviewRows = rows
    .map((row) => ({ row, sizes: parseSizeList(row.sizes).sizes }))
    .filter(({ row, sizes }) => row.types.length > 0 && sizes.length > 0);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
          <span>Available Type — select one or more</span>
          <span>Available Size</span>
        </div>
        <div className="divide-y">
          {visibleRows.map((row, index) => {
            const { invalid } = parseSizeList(row.sizes);
            const sizesId = `${idPrefix}-sizes-${index}`;
            return (
              <div
                // Rows are fixed slots, so the index is a stable key.
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots
                key={index}
                className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] sm:gap-4"
              >
                <fieldset className="min-w-0">
                  <legend className="mb-2 text-xs font-medium text-muted-foreground sm:sr-only">
                    Row {index + 1} Type
                  </legend>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 @xl/product-form:grid-cols-3">
                    {typeOptions.map((type) => {
                      const checkboxId = `${idPrefix}-${index}-${type}`;
                      return (
                        <label
                          key={type}
                          htmlFor={checkboxId}
                          className="flex min-w-0 cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            id={checkboxId}
                            checked={row.types.includes(type)}
                            onCheckedChange={(checked) =>
                              toggleType(index, type, checked === true)
                            }
                          />
                          <span className="truncate">{type}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <div className="min-w-0">
                  <label
                    htmlFor={sizesId}
                    className="mb-2 block text-xs font-medium text-muted-foreground sm:sr-only"
                  >
                    Row {index + 1} sizes
                  </label>
                  <Input
                    id={sizesId}
                    value={row.sizes}
                    inputMode="decimal"
                    placeholder="e.g. 10, 12, 15"
                    aria-invalid={invalid.length > 0 || undefined}
                    onChange={(event) =>
                      updateRow(index, { sizes: event.target.value })
                    }
                  />
                  {invalid.length > 0 ? (
                    <p role="alert" className="mt-1.5 text-xs text-destructive">
                      Not a size in KG: {invalid.join(", ")}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Sizes in KG, separated by commas.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {hiddenCount > 0 && !usedExtraRows && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-full rounded-none border-t text-xs text-muted-foreground"
            aria-expanded={showAll}
            onClick={() => setExpanded((open) => !open)}
          >
            <ChevronDown
              className={`size-4 transition-transform ${showAll ? "rotate-180" : ""}`}
            />
            {showAll
              ? "Show fewer rows"
              : `Show ${hiddenCount} more ${hiddenCount === 1 ? "row" : "rows"}`}
          </Button>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">Overview</h3>
        {overviewRows.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            Tick a Type and enter sizes to see the overview.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Available Type</span>
              <span>Available Size</span>
            </div>
            <div className="divide-y">
              {overviewRows.map(({ row, sizes }, index) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: derived from fixed slots
                  key={index}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-4 px-3 py-2.5"
                >
                  <span className="text-sm font-medium">
                    {row.types.join(", ")}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {sizes.map((size) => (
                      <span
                        key={size.value}
                        className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                      >
                        {size.label}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Variant Pricing: one row per size, one column per Type option in use.
 * A size not sold a given way shows "—" in that column. Prices are optional.
 */
export function LpgVariantPricing({
  entries,
  prices,
  onPriceChange,
}: {
  entries: SizeSaleTypes[];
  prices: Record<string, string>;
  onPriceChange: (key: string, value: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        Prices appear here once the Variant Table has a Type and a size.
      </p>
    );
  }

  const columns = [
    ...new Set(entries.flatMap((entry) => entry.types)),
  ];
  const errors = entries
    .map((entry) => salePriceError(entry, prices))
    .filter((error): error is string => Boolean(error));
  const gridStyle = {
    gridTemplateColumns: `minmax(4.5rem,1fr) repeat(${columns.length}, minmax(6.5rem,8rem))`,
  };

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div
            className="grid gap-3 border-b pb-2 text-xs font-medium text-muted-foreground"
            style={gridStyle}
          >
            <span>Size</span>
            {columns.map((type) => (
              <span key={type} className="text-right">
                {type} price
              </span>
            ))}
          </div>
          <div className="divide-y">
            {entries.map((entry) => (
              <div
                key={entry.size.value}
                className="grid items-center gap-3 py-2"
                style={gridStyle}
              >
                <span className="text-sm font-medium">{entry.size.label}</span>
                {columns.map((type) => {
                  const key = salePriceKey(entry.size.value, type);
                  return entry.types.includes(type) ? (
                    <PriceInput
                      key={type}
                      label={`${entry.size.label} ${type} price`}
                      value={prices[key] ?? ""}
                      onChange={(value) => onPriceChange(key, value)}
                    />
                  ) : (
                    <span
                      key={type}
                      className="text-right text-xs text-muted-foreground"
                      title={`${entry.size.label} is not sold as ${type}`}
                    >
                      —
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {errors.map((error) => (
        <p key={error} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ))}
      <p className="text-xs text-muted-foreground">
        Only New and Exchange can be ordered for now; other prices are saved
        for later.
      </p>
    </div>
  );
}
