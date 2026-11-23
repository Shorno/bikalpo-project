"use client";

import {
  DELIVERY_COST_UNITS,
  type DeliveryCostUnit,
  deliveryCostUnitLabel,
  isDeliveryCostUnit,
} from "@bikalpo-project/db/product-delivery";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Up to 8 digits and 2 decimals while typing; empty is allowed. */
const MONEY_TYPING = /^\d{0,8}(\.\d{0,2})?$/;

function amount(value?: string | null) {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function moneyInput(next: string, onChange: (value: string) => void) {
  const value = next.replace(/,/g, "").trim();
  if (MONEY_TYPING.test(value)) onChange(value);
}

// ── Delivery ────────────────────────────────────────────────────

const UNIT_ENTRIES = Object.entries(DELIVERY_COST_UNITS) as Array<
  [DeliveryCostUnit, string]
>;

/**
 * "Delivery Cost" unit in Inventory Rules. Empty means automatic: the unit
 * follows the selected variants' Type until the user picks one.
 */
export function DeliveryUnitSelect({
  value,
  suggested,
  onChange,
  className = "h-9 w-full",
}: {
  value: string;
  suggested: DeliveryCostUnit | null;
  onChange: (value: string) => void;
  className?: string;
}) {
  const shown = value || suggested || "unit";
  return (
    <Select value={shown} onValueChange={onChange}>
      <SelectTrigger aria-label="Delivery cost unit" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {UNIT_ENTRIES.map(([code, label]) => (
          <SelectItem key={code} value={code}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The unit to save: the user's pick, else the one from the variant Type. */
export function resolveDeliveryUnit(
  value: string | null | undefined,
  suggested: DeliveryCostUnit | null,
): DeliveryCostUnit | null {
  return isDeliveryCostUnit(value) ? value : suggested;
}

/** "Delivery Configuration": the default delivery cost per unit. */
export function DeliveryCostField({
  value,
  unit,
  onChange,
  id = "default-delivery-cost",
}: {
  value: string;
  unit: string | null;
  onChange: (value: string) => void;
  id?: string;
}) {
  const unitLabel = deliveryCostUnitLabel(unit) ?? "Unit";
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Default Delivery Cost
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
          ৳
        </span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          className="pl-7 pr-20 tabular-nums"
          value={value}
          onChange={(event) => moneyInput(event.target.value, onChange)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          per {unitLabel.toLowerCase()}
        </span>
      </div>
    </div>
  );
}

// ── Pricing ─────────────────────────────────────────────────────

export type PricingRow = {
  key: string;
  brandId: number;
  brandName: string;
  variantName: string;
  /** Cylinders are priced as Exchange and New. */
  exchange: boolean;
};

export type PricingValue = { newPrice: string; exchangePrice: string };

/** Exchange credit kept on the variant: New minus Exchange. */
export function exchangeCreditFrom(value: PricingValue) {
  const newPrice = amount(value.newPrice);
  const exchangePrice = amount(value.exchangePrice);
  if (newPrice == null || exchangePrice == null) return null;
  return Math.max(0, newPrice - exchangePrice).toFixed(2);
}

/** Exchange price shown for a saved New price and exchange credit. */
export function exchangePriceFrom(
  newPrice?: string | null,
  credit?: string | number | null,
) {
  const price = amount(newPrice == null ? null : String(newPrice));
  if (price == null) return "";
  const creditAmount = Number(credit ?? 0);
  if (!Number.isFinite(creditAmount) || creditAmount <= 0) return "";
  const exchange = price - creditAmount;
  return exchange > 0 ? exchange.toFixed(2) : "";
}

/** A saved price as an input value: empty when not set. */
export function priceInputValue(value?: string | number | null) {
  const price = amount(value == null ? null : String(value));
  return price == null ? "" : price.toFixed(2);
}

/** A seller's saved variant as Pricing inputs (New, and Exchange if any). */
export function sellerPriceInputs(variant: {
  retailPrice?: string | null;
  exchangeEnabled?: boolean | null;
  exchangeCreditAmount?: string | number | null;
}) {
  return {
    retailPrice: priceInputValue(variant.retailPrice),
    exchangePrice: variant.exchangeEnabled
      ? exchangePriceFrom(variant.retailPrice, variant.exchangeCreditAmount)
      : "",
  };
}

/** A form variant as the seller configure API expects it. */
export function sellerVariantPayload(variant: {
  variantOptionId: number;
  retailPrice?: string;
  exchangeEnabled?: boolean;
  exchangeCreditAmount?: string;
}) {
  return {
    variantOptionId: variant.variantOptionId,
    retailPrice: variant.retailPrice || null,
    exchangeEnabled: Boolean(variant.exchangeEnabled),
    exchangeCreditAmount: variant.exchangeCreditAmount ?? "0",
  };
}

/** Problem with one row, or null. Prices are optional, but not half-set. */
export function pricingRowError(row: PricingRow, value?: PricingValue) {
  const newPrice = amount(value?.newPrice);
  if (!row.exchange) return null;
  const exchangePrice = amount(value?.exchangePrice);
  if ((newPrice == null) !== (exchangePrice == null)) {
    return "Enter both Exchange and New prices, or leave both empty.";
  }
  if (newPrice != null && exchangePrice != null && exchangePrice > newPrice) {
    return "Exchange price can't be more than the New price.";
  }
  return null;
}

/** First problem across the table, with its variant, or null. */
export function firstPricingError(
  rows: PricingRow[],
  values: Record<string, PricingValue | undefined>,
) {
  for (const row of rows) {
    const error = pricingRowError(row, values[row.key]);
    if (error) return `${row.brandName} ${row.variantName}: ${error}`;
  }
  return null;
}

function PriceInput({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-muted-foreground">
        ৳
      </span>
      <Input
        aria-label={label}
        aria-invalid={invalid || undefined}
        inputMode="decimal"
        autoComplete="off"
        placeholder="—"
        className="h-9 pl-6 text-right tabular-nums"
        value={value}
        onChange={(event) => moneyInput(event.target.value, onChange)}
      />
    </div>
  );
}

/**
 * "Pricing": one row per selected variant. Cylinders take Exchange and New
 * prices, everything else a single price. Every price is optional.
 */
export function ProductPricingTable({
  rows,
  values,
  onChange,
  emptyText = "Select variants above to set their prices.",
}: {
  rows: PricingRow[];
  values: Record<string, PricingValue | undefined>;
  onChange: (key: string, patch: Partial<PricingValue>) => void;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  const hasExchange = rows.some((row) => row.exchange);
  const brandIds = [...new Set(rows.map((row) => row.brandId))];
  // No Brand column for now; a brand heading only separates several brands.
  const grouped = brandIds.length > 1;
  const columns = hasExchange
    ? "grid-cols-[minmax(0,1fr)_minmax(0,8rem)_minmax(0,8rem)]"
    : "grid-cols-[minmax(0,1fr)_minmax(0,9rem)]";

  return (
    // No box of its own: the Pricing card already frames the rows.
    <div>
      <div
        className={`grid ${columns} gap-3 border-b pb-2 text-xs font-medium text-muted-foreground`}
      >
        <span>Variant</span>
        {hasExchange ? (
          <>
            <span className="text-right">Exchange price</span>
            <span className="text-right">New price</span>
          </>
        ) : (
          <span className="text-right">Price</span>
        )}
      </div>
      <div className="divide-y">
        {brandIds.map((brandId) => {
          const brandRows = rows.filter((row) => row.brandId === brandId);
          return (
            <Fragment key={brandId}>
              {grouped && (
                <div className="pt-3 pb-1 text-xs font-semibold">
                  {brandRows[0]?.brandName}
                </div>
              )}
              {brandRows.map((row) => {
                const value = values[row.key] ?? {
                  newPrice: "",
                  exchangePrice: "",
                };
                const error = pricingRowError(row, value);
                const label = `${row.brandName} ${row.variantName}`;
                return (
                  <div key={row.key} className="py-2">
                    <div className={`grid ${columns} items-center gap-3`}>
                      <span className="min-w-0 truncate text-sm">
                        {row.variantName}
                      </span>
                      {hasExchange &&
                        (row.exchange ? (
                          <PriceInput
                            label={`${label} Exchange price`}
                            value={value.exchangePrice}
                            invalid={Boolean(error)}
                            onChange={(exchangePrice) =>
                              onChange(row.key, { exchangePrice })
                            }
                          />
                        ) : (
                          <span className="text-right text-xs text-muted-foreground">
                            No exchange
                          </span>
                        ))}
                      <PriceInput
                        label={`${label} ${hasExchange ? "New price" : "Price"}`}
                        value={value.newPrice}
                        invalid={Boolean(error)}
                        onChange={(newPrice) => onChange(row.key, { newPrice })}
                      />
                    </div>
                    {error && (
                      <p role="alert" className="mt-1.5 text-xs text-destructive">
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── Final action ────────────────────────────────────────────────

/** "Final Action": Cancel, Save Draft and Publish at the end of the form. */
export function FinalActions({
  cancelHref,
  onSaveDraft,
  onPublish,
  publishLabel,
  pending,
  disabled,
}: {
  cancelHref: string;
  onSaveDraft?: () => void;
  onPublish: () => void;
  publishLabel: string;
  pending?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        asChild
        disabled={pending}
      >
        <Link href={cancelHref}>Cancel</Link>
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {onSaveDraft && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={pending || disabled}
          >
            Save draft
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={onPublish}
          disabled={pending || disabled}
        >
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {publishLabel}
        </Button>
      </div>
    </div>
  );
}
