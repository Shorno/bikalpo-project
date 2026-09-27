"use client";

import type { AppRouterClient } from "@bikalpo-project/api/routers/index";
import { Check, ChevronDown, Loader2, Pencil, X } from "lucide-react";
import { Fragment } from "react";
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
import { cn } from "@/lib/utils";
import styles from "./product-price.module.css";

export type PriceRow = Awaited<
  ReturnType<AppRouterClient["product"]["listConsumerReferencePrices"]>
>["items"][number];
export type PriceGroup = {
  key: string;
  productId: number;
  id: string;
  label: string;
  rows: PriceRow[];
};
export type PriceDraft = {
  productId: number;
  original: string;
  rows: {
    variantPriceId: number;
    consumerPrice: string;
    exchangePrice: string;
  }[];
};

export function formatBdt(value: string | number) {
  return `৳ ${Number(value).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

export function LastUpdate({ row }: { row: PriceRow }) {
  if (!row.updatedAt) return <span>—</span>;
  const date = new Date(row.updatedAt);
  const shortDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Dhaka",
  }).format(date);
  const fullDate = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(date);
  return (
    <span
      className={styles.lastUpdate}
      title={`${row.updatedById ?? "User ID not recorded"} · ${fullDate}`}
    >
      <span>{row.updatedById?.slice(-5) ?? "—"}</span>{" "}
      <span>({shortDate})</span>
    </span>
  );
}

export function ProductPriceTable({
  groups,
  expanded,
  draft,
  error,
  saving,
  onToggle,
  onStartEdit,
  onDraftChange,
  onSave,
  onCancel,
}: {
  groups: PriceGroup[];
  expanded: Set<string>;
  draft: PriceDraft | null;
  error: string;
  saving: boolean;
  onToggle: (key: string) => void;
  onStartEdit: (group: PriceGroup) => void;
  onDraftChange: (draft: PriceDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table className={styles.mainTable}>
        <caption className="sr-only">
          Product prices. Expand a product to view variants, or choose Edit to
          change prices.
        </caption>
        <colgroup>
          <col style={{ width: "18%" }} />
          <col style={{ width: "30%" }} />
          <col style={{ width: "21%" }} />
          <col style={{ width: "21%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead scope="col">ID</TableHead>
            <TableHead scope="col">Product Name</TableHead>
            <TableHead scope="col">Selling Price</TableHead>
            <TableHead scope="col">Last Update</TableHead>
            <TableHead scope="col" className="text-center">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => {
            const first = group.rows[0];
            if (!first) return null;
            const open = expanded.has(group.key);
            const editing = draft?.productId === group.productId;
            const latest = group.rows.reduce((a, b) =>
              new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime()
                ? a
                : b,
            );
            const detailsId = `price-details-${group.productId}`;
            const cylinder = group.rows.every((row) => row.isCylinderPricing);
            const showBrand =
              new Set(group.rows.map((row) => row.brandDisplay)).size > 1;
            return (
              <Fragment key={group.key}>
                <TableRow
                  className={cn(styles.productRow, open && styles.openRow)}
                >
                  <TableCell
                    className={cn(
                      styles.idCell,
                      "font-mono text-xs text-muted-foreground",
                    )}
                    title={`Product ${group.id} · ${first.productSku ?? ""}`}
                  >
                    {group.id}
                  </TableCell>
                  <TableCell>
                    <span className={styles.productName} title={group.label}>
                      {group.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className={styles.priceControl}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={styles.disclosure}
                        disabled={saving}
                        onClick={() => onToggle(group.key)}
                        aria-label={`${open ? "Collapse" : "Expand"} prices for ${group.label}`}
                        aria-expanded={open}
                        aria-controls={detailsId}
                      >
                        <ChevronDown
                          aria-hidden="true"
                          className={cn("size-4", open && "rotate-180")}
                        />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <LastUpdate row={latest} />
                  </TableCell>
                  <TableCell className={cn(styles.actionCell, "text-center")}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        styles.editButton,
                        editing && styles.editingButton,
                      )}
                      disabled={saving}
                      aria-label={`Edit prices for ${group.label}`}
                      aria-pressed={editing}
                      title="Edit Price"
                      onClick={() =>
                        editing ? onCancel() : onStartEdit(group)
                      }
                    >
                      <Pencil aria-hidden="true" className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
                {open && (
                  <TableRow>
                    <TableCell colSpan={5} className={styles.detailCell}>
                      <div id={detailsId} className={styles.details}>
                        <div className="overflow-hidden rounded-lg border bg-card">
                          <Table className={styles.variantTable}>
                            <caption className="sr-only">
                              {group.label} variant prices
                            </caption>
                            <TableHeader>
                              <TableRow>
                                {showBrand && (
                                  <TableHead scope="col">Brand</TableHead>
                                )}
                                <TableHead scope="col">Variant</TableHead>
                                {cylinder && (
                                  <TableHead scope="col" className="text-right">
                                    Exchange Price
                                  </TableHead>
                                )}
                                <TableHead scope="col" className="text-right">
                                  {cylinder ? "New Cylinder Price" : "Price"}
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.rows.map((row) => {
                                const value = draft?.rows.find(
                                  (item) =>
                                    item.variantPriceId === row.variantPriceId,
                                );
                                const input = (exchange: boolean) => (
                                  <Input
                                    inputMode="decimal"
                                    autoComplete="off"
                                    disabled={saving}
                                    className={styles.priceInput}
                                    aria-label={`${exchange ? "Exchange Price" : cylinder ? "New Cylinder Price" : "Price"} for ${row.variantName}`}
                                    aria-invalid={!!error}
                                    aria-describedby={
                                      error
                                        ? `price-error-${group.productId}`
                                        : undefined
                                    }
                                    value={
                                      exchange
                                        ? (value?.exchangePrice ?? "")
                                        : (value?.consumerPrice ?? "")
                                    }
                                    onChange={(event) =>
                                      draft &&
                                      onDraftChange({
                                        ...draft,
                                        rows: draft.rows.map((item) =>
                                          item.variantPriceId ===
                                          row.variantPriceId
                                            ? {
                                                ...item,
                                                [exchange
                                                  ? "exchangePrice"
                                                  : "consumerPrice"]:
                                                  event.target.value,
                                              }
                                            : item,
                                        ),
                                      })
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        onSave();
                                      }
                                      if (event.key === "Escape") {
                                        event.preventDefault();
                                        onCancel();
                                      }
                                    }}
                                  />
                                );
                                return (
                                  <TableRow key={row.variantPriceId}>
                                    {showBrand && (
                                      <TableCell>{row.brandDisplay}</TableCell>
                                    )}
                                    <TableCell>
                                      <span title={row.variantName}>
                                        {row.variantValue}
                                      </span>
                                      {!cylinder && (
                                        <span className={styles.unit}>
                                          {row.variantUnit}
                                        </span>
                                      )}
                                    </TableCell>
                                    {cylinder && (
                                      <TableCell className="text-right font-semibold tabular-nums">
                                        {editing
                                          ? input(true)
                                          : row.exchangePrice == null
                                            ? "—"
                                            : formatBdt(row.exchangePrice)}
                                      </TableCell>
                                    )}
                                    <TableCell className="text-right font-semibold tabular-nums">
                                      {editing
                                        ? input(false)
                                        : formatBdt(row.consumerPrice)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        {editing && (
                          <div className={styles.editFooter}>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={saving}
                                onClick={onSave}
                              >
                                {saving ? (
                                  <Loader2
                                    aria-hidden="true"
                                    className="size-4 animate-spin"
                                  />
                                ) : (
                                  <Check
                                    aria-hidden="true"
                                    className="size-4"
                                  />
                                )}
                                {saving ? "Saving…" : "Save"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={saving}
                                onClick={onCancel}
                              >
                                <X aria-hidden="true" className="size-4" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                        {editing && error && (
                          <p
                            id={`price-error-${group.productId}`}
                            role="alert"
                            className="mt-2 text-sm text-destructive"
                          >
                            {error}
                          </p>
                        )}
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
