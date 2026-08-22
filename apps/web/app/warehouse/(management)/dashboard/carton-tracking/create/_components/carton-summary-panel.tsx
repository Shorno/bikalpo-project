import { Package, PackagePlus } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCartonSellingPriceBreakdown,
  operationalQuantityLabel,
  operationalUnitLabel,
} from "./carton-summary-values";
import type { CartonItem } from "./types";

type CartonSummaryPanelProps = {
  items: CartonItem[];
  nextCartonId: string;
  totalWeightKg: string;
  cartonPrice: string;
  deliveryCost: string;
  hasLooseItems: boolean;
  hasPackItems: boolean;
  canSubmit: boolean;
  isPending: boolean;
  showActions?: boolean;
  onCartonPriceChange: (value: string) => void;
  onDeliveryCostChange: (value: string) => void;
  onCreate: () => void;
};

export function CartonSummaryPanel({
  items,
  nextCartonId,
  totalWeightKg,
  cartonPrice,
  deliveryCost,
  hasLooseItems,
  hasPackItems,
  canSubmit,
  isPending,
  showActions = true,
  onCartonPriceChange,
  onDeliveryCostChange,
  onCreate,
}: CartonSummaryPanelProps) {
  const hasItems = items.length > 0;
  const totalQuantity = items.reduce((sum, item) => sum + item.packCount, 0);
  const operationalUnit = items[0]?.operationalUnit || "unit";
  const priceBreakdown = getCartonSellingPriceBreakdown(
    cartonPrice,
    totalQuantity,
  );

  if (!hasItems) {
    return (
      <div className="py-10 text-center">
        <Package size={28} className="text-foreground/20 mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground/70">Carton summary</p>
        <p className="text-sm text-foreground/45 mt-1.5 leading-relaxed max-w-[220px] mx-auto">
          Select a product to preview ID, weight, and pricing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 pb-5 border-b">
        <div>
          <p className="text-sm font-medium text-foreground/55">Carton ID</p>
          <p className="text-lg font-mono font-semibold tracking-tight text-foreground mt-1">
            {nextCartonId}
          </p>
        </div>
        <span className="text-xs font-medium text-amber-800 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 px-2.5 py-1 rounded-md">
          Draft
        </span>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground/55 mb-3">Contents</p>
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.variantId}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.productName}
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package size={16} className="text-foreground/35" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.productName}
                  </p>
                  <p className="text-sm text-foreground/50 truncate">
                    {item.variantLabel.split(" · ")[0]}
                    {item.brandName ? ` · ${item.brandName}` : ""}
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground flex-shrink-0">
                {operationalQuantityLabel(item.packCount, item.operationalUnit)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between py-3 border-y text-sm">
        <span className="font-medium text-foreground/70">Carton total</span>
        <div className="flex items-center gap-3 font-semibold text-foreground tabular-nums">
          {hasPackItems && (
            <span>
              {operationalQuantityLabel(totalQuantity, operationalUnit)}
            </span>
          )}
          {hasLooseItems && (
            <>
              {hasPackItems && (
                <span className="text-foreground/25 font-normal">·</span>
              )}
              <span>
                {items
                  .filter((i) => i.isLoose)
                  .reduce((s, i) => s + i.packCount, 0)
                  .toFixed(1)}{" "}
                KG
              </span>
            </>
          )}
          <span className="text-foreground/25 font-normal">·</span>
          <span>{totalWeightKg} KG</span>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground/70">Pricing</p>

        <div>
          <Label
            htmlFor="carton-price"
            className="mb-2 block text-sm font-medium text-foreground/80"
          >
            Carton selling price (৳)
          </Label>
          <Input
            id="carton-price"
            type="number"
            min={0}
            placeholder="Required"
            value={cartonPrice}
            onChange={(e) => onCartonPriceChange(e.target.value)}
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground/55">
            Selling price breakdown
          </p>
          {priceBreakdown ? (
            <>
              <div className="flex justify-between gap-4 text-sm">
                <span className="truncate text-foreground/60">
                  Per {operationalUnitLabel(1, operationalUnit)}
                </span>
                <span className="flex-shrink-0 font-medium tabular-nums text-foreground">
                  ৳
                  {priceBreakdown.unitPrice.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm font-medium">
                <span className="text-foreground/70">Carton selling price</span>
                <span className="tabular-nums text-foreground">
                  ৳{priceBreakdown.cartonPrice.toLocaleString()}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter the carton selling price to see its per-unit value.
            </p>
          )}
        </div>

        <div>
          <Label
            htmlFor="delivery-cost"
            className="mb-2 block text-sm font-medium text-foreground/80"
          >
            Delivery cost per carton (৳){" "}
            <span className="font-normal text-muted-foreground">Optional</span>
          </Label>
          <Input
            id="delivery-cost"
            type="number"
            min={0}
            placeholder="0"
            value={deliveryCost}
            onChange={(e) => onDeliveryCostChange(e.target.value)}
            className="h-10 text-sm"
          />
        </div>
      </div>

      {showActions && (
        <Button
          onClick={onCreate}
          disabled={!canSubmit || isPending}
          className="w-full gap-2 h-11 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <PackagePlus size={16} />
          {isPending ? "Creating..." : "Create carton"}
        </Button>
      )}
    </div>
  );
}
