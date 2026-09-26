"use client";

import type { AppRouterClient } from "@bikalpo-project/api/routers/index";
import { format } from "date-fns";
import { Check, ChevronDown, Loader2, Pencil, X } from "lucide-react";
import { Fragment, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type PriceRow = Awaited<
  ReturnType<AppRouterClient["product"]["listConsumerReferencePrices"]>
>["items"][number];
export type PriceGroup = {
  key: string;
  id: string;
  label: string;
  rows: PriceRow[];
};
export type PriceDraft = {
  id: number;
  consumerPrice: string;
  exchangePrice: string;
};

export function formatBdt(value: string) {
  return `৳ ${Number(value).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function LastUpdate({ row }: { row: PriceRow }) {
  return (
    <span
      title={
        row.updatedAt
          ? format(new Date(row.updatedAt), "d MMM yyyy, h:mm a")
          : undefined
      }
    >
      {row.updatedAt
        ? `${row.updatedByName ? `${row.updatedByName} · ` : ""}${format(new Date(row.updatedAt), "d MMM yyyy")}`
        : "—"}
    </span>
  );
}

type EditProps = {
  draft: PriceDraft | null;
  error: string;
  saving: boolean;
  onStartEdit: (row: PriceRow) => void;
  onDraftChange: (draft: PriceDraft) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ProductPriceTable({
  groups,
  expanded,
  onToggle,
  ...edit
}: EditProps & {
  groups: PriceGroup[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  const isMobile = useIsMobile();
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table className="table-fixed max-md:text-xs">
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[16%] max-md:hidden">ID</TableHead>
            <TableHead className="w-[36%] max-md:w-[54%]">
              Product Name
            </TableHead>
            <TableHead className="w-[21%] whitespace-normal max-md:w-[32%]">
              Selling Price
            </TableHead>
            <TableHead className="w-[20%] max-md:hidden">Last Update</TableHead>
            <TableHead className="w-[7%] text-center max-md:w-[14%]">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group, groupIndex) => {
            const first = group.rows[0];
            if (!first) return null;
            const isExpanded = expanded.has(group.key);
            const latest = group.rows.reduce((a, b) =>
              new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime()
                ? a
                : b,
            );
            const prices = group.rows
              .map((row) => Number(row.exchangePrice ?? row.consumerPrice))
              .filter((price) => price > 0);
            const lowestPrice = prices.length ? Math.min(...prices) : 0;
            const detailsId = `price-group-${group.key.replace(":", "-")}`;
            return (
              <Fragment key={group.key}>
                {(groupIndex === 0 ||
                  groups[groupIndex - 1]?.rows[0]?.typeId !== first.typeId) && (
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell
                      colSpan={isMobile ? 3 : 5}
                      className="py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {first.typeName}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className={cn(isExpanded && "bg-muted/20")}>
                  <TableCell className="whitespace-normal break-all font-mono text-xs text-muted-foreground max-md:hidden">
                    {group.id}
                  </TableCell>
                  <TableCell className="whitespace-normal max-md:px-2">
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center gap-2 text-left font-semibold hover:text-primary"
                      onClick={() => onToggle(group.key)}
                      aria-expanded={isExpanded}
                      aria-controls={detailsId}
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} ${group.label}`}
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 transition-transform",
                          !isExpanded && "-rotate-90",
                        )}
                      />
                      <span className="min-w-0 break-words">{group.label}</span>
                    </button>
                    <div className="space-y-1 pl-6 text-[10px] text-muted-foreground md:hidden">
                      <p className="break-all font-mono">{group.id}</p>
                      <p>
                        <LastUpdate row={latest} />
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal max-md:px-1">
                    <button
                      type="button"
                      className="min-h-11 text-left hover:text-primary"
                      onClick={() => onToggle(group.key)}
                      aria-expanded={isExpanded}
                      aria-controls={detailsId}
                    >
                      <span className="block font-semibold tabular-nums">
                        {lowestPrice
                          ? `From ${formatBdt(String(lowestPrice))}`
                          : "Not priced"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {group.rows.length} variant
                        {group.rows.length === 1 ? "" : "s"}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="whitespace-normal break-words text-xs text-muted-foreground max-md:hidden">
                    <LastUpdate row={latest} />
                  </TableCell>
                  <TableCell className="text-center max-md:px-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 max-md:size-11"
                      disabled={edit.saving}
                      aria-label={`Edit prices for ${group.label}`}
                      title="Edit prices"
                      onClick={() => {
                        if (!isExpanded) onToggle(group.key);
                        edit.onStartEdit(first);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={isMobile ? 3 : 5}
                      className="whitespace-normal p-0"
                    >
                      <div
                        id={detailsId}
                        className="border-t bg-muted/10 px-4 py-4 max-md:px-2"
                      >
                        <VariantPriceTable rows={group.rows} {...edit} />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function VariantPriceTable({
  rows,
  draft,
  error,
  saving,
  onStartEdit,
  onDraftChange,
  onSave,
  onCancel,
}: EditProps & { rows: PriceRow[] }) {
  const isMobile = useIsMobile();
  const cylinder = rows.every((row) => row.isCylinderPricing);
  const showBrand =
    !cylinder || new Set(rows.map((row) => row.brandDisplay)).size > 1;
  const columns = (showBrand ? 1 : 0) + (isMobile ? (cylinder ? 4 : 3) : 5);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSave();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };
  const priceInput = (row: PriceRow, exchange: boolean) => (
    <Input
      // Mounting the editor focuses its first input; mobile keeps the inputs in a full-width row.
      autoFocus={exchange || !row.isCylinderPricing}
      inputMode="decimal"
      disabled={saving}
      className="ml-auto block h-9 min-w-0 text-right tabular-nums max-md:h-11"
      aria-label={`${exchange ? "Exchange Price" : row.isCylinderPricing ? "New Cylinder Price" : "Price"} for ${row.brandDisplay}, ${row.variantValue}`}
      aria-invalid={!!error}
      aria-describedby={error ? `price-error-${row.variantPriceId}` : undefined}
      value={
        exchange ? (draft?.exchangePrice ?? "") : (draft?.consumerPrice ?? "")
      }
      onChange={(event) =>
        draft &&
        onDraftChange({
          ...draft,
          [exchange ? "exchangePrice" : "consumerPrice"]: event.target.value,
        })
      }
      onKeyDown={onKeyDown}
    />
  );
  const actions = () => (
    <div className="flex items-center justify-center gap-1">
      <Button
        type="button"
        size="sm"
        className="max-md:min-h-11"
        disabled={saving}
        onClick={onSave}
      >
        {saving ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5" />
        )}{" "}
        Save
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 max-md:size-11"
        disabled={saving}
        onClick={onCancel}
        aria-label="Cancel price edit"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table className="table-fixed max-md:text-[11px] max-md:[&_td]:px-1 max-md:[&_th]:px-1 max-md:[&_th]:text-[10px] max-md:[&_th]:whitespace-normal">
        <TableHeader>
          <TableRow className="bg-muted/20 hover:bg-muted/20">
            {showBrand && <TableHead className="w-[17%]">Brand</TableHead>}
            <TableHead>Variant</TableHead>
            {!cylinder && (
              <TableHead className="w-[9%] max-md:hidden">Unit</TableHead>
            )}
            {cylinder && (
              <TableHead className="w-[22%] text-right">
                Exchange Price
              </TableHead>
            )}
            <TableHead className="w-[22%] text-right">
              {cylinder ? "New Cylinder Price" : "Price"}
            </TableHead>
            <TableHead className="w-[19%] max-md:hidden">Last Update</TableHead>
            <TableHead className="w-[120px] text-center max-md:w-[52px]">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const editing = draft?.id === row.variantPriceId;
            return (
              <Fragment key={row.variantPriceId}>
                <TableRow>
                  {showBrand && (
                    <TableCell className="whitespace-normal break-words font-medium">
                      {row.brandDisplay}
                    </TableCell>
                  )}
                  <TableCell className="whitespace-normal break-words">
                    <span title={row.variantName}>
                      {isMobile ? row.variantValue : row.variantName}
                    </span>
                    <div className="mt-1 space-y-1 text-[10px] text-muted-foreground md:hidden">
                      {!cylinder && <p>{row.variantUnit}</p>}
                      <p>
                        <LastUpdate row={row} />
                      </p>
                    </div>
                  </TableCell>
                  {!cylinder && (
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {row.variantUnit}
                    </TableCell>
                  )}
                  {cylinder && (
                    <TableCell className="text-right font-semibold tabular-nums">
                      {editing && !isMobile
                        ? priceInput(row, true)
                        : row.exchangePrice == null
                          ? "—"
                          : formatBdt(row.exchangePrice)}
                    </TableCell>
                  )}
                  <TableCell className="text-right font-semibold tabular-nums">
                    {editing && !isMobile ? (
                      priceInput(row, false)
                    ) : (
                      <button
                        type="button"
                        className="min-h-11 rounded px-1 hover:bg-primary/10 hover:text-primary"
                        disabled={saving}
                        onClick={() => onStartEdit(row)}
                        aria-label={`Edit price for ${row.brandDisplay}, ${row.variantValue}`}
                      >
                        {formatBdt(row.consumerPrice)}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal break-words text-xs text-muted-foreground max-md:hidden">
                    <LastUpdate row={row} />
                  </TableCell>
                  <TableCell className="text-center">
                    {editing && !isMobile ? (
                      actions()
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 max-md:size-11"
                        disabled={saving}
                        onClick={() => onStartEdit(row)}
                        aria-label={`Edit ${row.brandDisplay} ${row.variantValue} prices`}
                        title="Edit price"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                {editing && (isMobile || error) && (
                  <TableRow>
                    <TableCell colSpan={columns} className="whitespace-normal">
                      {isMobile && (
                        <div className="space-y-3 py-2">
                          <div
                            className={cn(
                              "grid gap-3",
                              row.isCylinderPricing && "grid-cols-2",
                            )}
                          >
                            {row.isCylinderPricing && (
                              <label className="block min-w-0 space-y-1">
                                <span className="block">Exchange Price</span>
                                {priceInput(row, true)}
                              </label>
                            )}
                            <label className="block min-w-0 space-y-1">
                              <span className="block">
                                {row.isCylinderPricing
                                  ? "New Cylinder Price"
                                  : "Edit Price"}
                              </span>
                              {priceInput(row, false)}
                            </label>
                          </div>
                          {actions()}
                        </div>
                      )}
                      {error && (
                        <p
                          id={`price-error-${row.variantPriceId}`}
                          role="alert"
                          className="py-1 text-xs text-destructive"
                        >
                          {error}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
