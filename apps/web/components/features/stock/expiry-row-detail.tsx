"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatQuantity } from "./realtime-stock-model";
import {
  daysLeftText,
  EXPIRY_STATUS_LABELS,
  type ExpiryBatch,
  type ExpiryProduct,
  expiryProductId,
  formatExpiryDate,
} from "./expiry-stock-model";
import { ExpiryStatusIcon, type SaveExpiryAlertDays } from "./expiry-status-icon";

const BADGE: Record<ExpiryProduct["status"], string> = {
  expired:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  expiring:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
};

const DATE_TEXT: Record<ExpiryBatch["status"], string> = {
  expired: "text-red-600 dark:text-red-400",
  expiring: "text-amber-700 dark:text-amber-400",
  ok: "text-muted-foreground",
};

function receivedText(batch: ExpiryBatch, thisYear: number) {
  const received = new Date(batch.receivedAt);
  const date = Number.isNaN(received.getTime())
    ? null
    : formatExpiryDate(
        [
          received.getFullYear(),
          String(received.getMonth() + 1).padStart(2, "0"),
          String(received.getDate()).padStart(2, "0"),
        ].join("-"),
        thisYear,
      );
  return [batch.supplierName, batch.invoiceNo, date && `Received ${date}`]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The expanded Expired Products row: the status with its alert days, every
 * batch still holding stock (sold / received, what is left, expiry), and
 * Create Damage for the expired batches.
 */
export function ExpiryRowDetail({
  product,
  alertDayOptions,
  onSaveAlertDays,
  damageHref,
}: {
  product: ExpiryProduct;
  alertDayOptions: number[];
  onSaveAlertDays: SaveExpiryAlertDays;
  damageHref: string | null;
}) {
  const thisYear = new Date().getFullYear();

  return (
    <div className="sticky left-0 w-fit @3xl/catalog:mx-auto max-w-full min-w-0 space-y-4 px-5 py-4 max-md:px-3 max-md:py-3">
      <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[15px] font-semibold">
        {product.name}
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {expiryProductId(product)}
        </span>
      </h3>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-muted-foreground">Status:</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              BADGE[product.status],
            )}
          >
            <ExpiryStatusIcon status={product.status} className="size-3.5" />
            {EXPIRY_STATUS_LABELS[product.status]}
          </span>
        </div>
        <AlertDays
          product={product}
          options={alertDayOptions}
          onSave={onSaveAlertDays}
        />
      </div>

      <section aria-label="Batches with stock">
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="min-w-40 whitespace-nowrap px-3 py-2 font-medium">
                  Batch
                </th>
                <th scope="col" className="min-w-24 whitespace-nowrap px-3 py-2 font-medium">
                  Variant
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                  Sold / Received
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                  Left
                </th>
                <th scope="col" className="min-w-32 whitespace-nowrap px-3 py-2 font-medium">
                  Expiry
                </th>
              </tr>
            </thead>
            <tbody>
              {product.batches.map((batch) => (
                <tr key={batch.key} className="border-b align-top last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-medium">{batch.batchNo || "No batch no."}</span>
                    <span className="block text-xs text-muted-foreground">
                      {receivedText(batch, thisYear)}
                    </span>
                  </td>
                  <td className="px-3 py-2">{batch.variants.join(", ")}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {formatQuantity(batch.soldQty)} / {formatQuantity(batch.receivedQty)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums">
                    {formatQuantity(batch.leftQty)}{" "}
                    <span className="font-normal text-muted-foreground">{batch.unit}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      {formatExpiryDate(batch.expiryDate, thisYear, true)}
                      <ExpiryStatusIcon status={batch.status} className="size-4" />
                    </span>
                    <span className={cn("block text-xs", DATE_TEXT[batch.status])}>
                      {daysLeftText(batch.daysLeft)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {damageHref ? (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="destructive">
            <Link href={damageHref}>Create Damage</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** How many days before expiry the product shows as expiring. */
function AlertDays({
  product,
  options,
  onSave,
}: {
  product: ExpiryProduct;
  options: number[];
  onSave: SaveExpiryAlertDays;
}) {
  const [saving, setSaving] = useState(false);
  const choices = options.includes(product.alertDays)
    ? options
    : [...options, product.alertDays].sort((a, b) => a - b);
  const triggerId = `expiry-alert-${product.productId}`;

  const onChange = (value: string) => {
    const alertDays = Number(value);
    if (alertDays === product.alertDays) return;
    setSaving(true);
    onSave({ productId: product.productId, alertDays })
      .then(() => toast.success(`Expiry alert set to ${alertDays} days`))
      .catch((err: Error) => toast.error(err.message || "Could not save"))
      .finally(() => setSaving(false));
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={triggerId} className="text-muted-foreground">
        Alert before
      </label>
      <Select
        value={String(product.alertDays)}
        onValueChange={onChange}
        disabled={saving}
      >
        <SelectTrigger id={triggerId} size="sm" className="h-8 w-28 tabular-nums">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {choices.map((days) => (
            <SelectItem key={days} value={String(days)}>
              {days} days
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saving ? (
        <Loader2 aria-label="Saving" className="size-4 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}
