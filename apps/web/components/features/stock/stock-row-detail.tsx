"use client";

import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Loader2,
  Minus,
  ReceiptText,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSetProductLowStockLevel } from "@/hooks/use-shop-owner-api";
import { cn } from "@/lib/utils";
import {
  formatQuantity,
  formatTotalStock,
  productIdLabel,
  type RealtimeStockProduct,
  type RealtimeStockVariant,
  type StockTrend,
  soldTrend,
  stockLevelName,
  stockTrend,
  variantSizeLabel,
  variantUnit,
} from "./realtime-stock-model";
import { StockStatusBadge } from "./stock-status-icon";

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;
const TREND_COLOR: Record<StockTrend, string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-600 dark:text-red-400",
  flat: "text-muted-foreground",
};

function TrendValue({
  trend,
  value,
  unit,
  explain,
}: {
  trend: StockTrend;
  value: number;
  unit: string;
  explain: string;
}) {
  const Icon = TREND_ICON[trend];
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span title={explain} className="inline-flex shrink-0">
        <Icon aria-hidden="true" className={cn("size-3.5", TREND_COLOR[trend])} />
        <span className="sr-only">{explain}.</span>
      </span>
      <span>
        {formatQuantity(value)}{" "}
        <span className="text-muted-foreground">{unit}</span>
      </span>
    </span>
  );
}

function stockExplain(variant: RealtimeStockVariant) {
  const sold = formatQuantity(variant.soldThisMonth);
  const added = formatQuantity(Math.max(0, variant.receivedThisMonth));
  const trend = stockTrend(variant);
  if (trend === "flat") return `No change this month (${added} in, ${sold} sold)`;
  return `${trend === "down" ? "Going down" : "Going up"} this month: ${added} in, ${sold} sold`;
}

function soldExplain(variant: RealtimeStockVariant) {
  const before = formatQuantity(variant.soldLastMonth);
  const trend = soldTrend(variant);
  if (trend === "flat") return `Same as this time last month (${before})`;
  return `${trend === "down" ? "Less" : "More"} than this time last month (${before})`;
}

/**
 * The expanded Real-time Stock row (client layout, 2026-11-25): the
 * product and its ID, stock at the core identity level, then each size's
 * stock and what sold this month, with up / down arrows.
 */
export function StockRowDetail({
  product,
  defaultLowStockLevel,
}: {
  product: RealtimeStockProduct;
  defaultLowStockLevel: number;
}) {
  const level = stockLevelName(product);
  const showBrand =
    new Set(product.variants.map((variant) => variant.brandName)).size > 1;

  return (
    // Sticky + w-fit keeps the panel in view when the wide stock table is
    // scrolled sideways; the row behind it carries the tint.
    <div className="sticky left-0 w-fit max-w-full min-w-0 space-y-4 px-5 py-4 max-md:px-3 max-md:py-3">
      <h3 className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[15px] font-semibold">
        <ReceiptText
          aria-hidden="true"
          className="size-4 shrink-0 self-center text-muted-foreground"
        />
        {product.name}
        <span className="text-sm font-medium tabular-nums text-muted-foreground">
          {productIdLabel(product)}
        </span>
      </h3>

      <section aria-label="Core identity level stock" className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Core Identity Level Stock
        </h4>
        <dl className="grid gap-1.5 text-sm">
          <div className="flex items-center gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">Total Stock:</dt>
            <dd className="font-semibold tabular-nums">
              {formatTotalStock(product)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="w-24 shrink-0 text-muted-foreground">Status:</dt>
            <dd>
              <StockStatusBadge status={product.status} />
            </dd>
          </div>
        </dl>
      </section>

      <section aria-label="Variant stock" className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <BarChart3 aria-hidden="true" className="size-3.5" />
          Variant Stock ({level} level)
        </h4>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-auto text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="min-w-28 whitespace-nowrap px-3 py-2 font-medium">
                  Size
                </th>
                <th scope="col" className="min-w-28 whitespace-nowrap px-3 py-2 font-medium">
                  Stock
                </th>
                <th scope="col" className="min-w-28 whitespace-nowrap px-3 py-2 font-medium">
                  Sold (this month)
                </th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => {
                const unit = variantUnit(variant);
                return (
                  <tr key={variant.variantId} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">
                      {variantSizeLabel(variant)}
                      {showBrand && variant.brandName ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {variant.brandName}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <TrendValue
                        trend={stockTrend(variant)}
                        value={variant.availableQty}
                        unit={unit}
                        explain={stockExplain(variant)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <TrendValue
                        trend={soldTrend(variant)}
                        value={variant.soldThisMonth}
                        unit={unit}
                        explain={soldExplain(variant)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <LowStockLimit product={product} defaultLevel={defaultLowStockLevel} />
    </div>
  );
}

/** The product's low-stock limit, editable in place. */
function LowStockLimit({
  product,
  defaultLevel,
}: {
  product: RealtimeStockProduct;
  defaultLevel: number;
}) {
  const saved = product.lowStockLevel > 0 ? String(product.lowStockLevel) : "";
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);
  const mutation = useSetProductLowStockLevel();

  const trimmed = value.trim();
  const level = trimmed === "" ? 0 : Number(trimmed);
  const invalid = !Number.isInteger(level) || level < 0 || level > 1_000_000;
  const inputId = `low-stock-${product.productId}`;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    mutation.mutate(
      { productId: product.productId, lowStockLevel: level },
      {
        onSuccess: () => toast.success("Low stock limit saved"),
        onError: (err) => toast.error(err.message || "Could not save"),
      },
    );
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm"
    >
      <Label htmlFor={inputId} className="font-normal text-muted-foreground">
        Low stock at
      </Label>
      <Input
        id={inputId}
        inputMode="numeric"
        value={value}
        placeholder={String(defaultLevel)}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={invalid}
        className="h-8 w-24 tabular-nums"
      />
      <span className="text-muted-foreground">
        {stockLevelName(product)} or fewer
        {saved === "" ? ` (default ${defaultLevel})` : ""}
      </span>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        className="h-8"
        disabled={invalid || trimmed === saved || mutation.isPending}
      >
        {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save
      </Button>
      {invalid ? (
        <p className="w-full text-destructive">Enter a whole number, 0 or more.</p>
      ) : null}
    </form>
  );
}
