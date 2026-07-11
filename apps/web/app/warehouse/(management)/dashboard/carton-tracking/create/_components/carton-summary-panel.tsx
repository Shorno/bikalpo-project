import { Package, PackagePlus } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CartonItem } from "./types";

type CartonConfig = {
  cartonPrice?: string | number | null;
  deliveryCostPerCarton?: string | number | null;
};

type CartonSummaryPanelProps = {
  items: CartonItem[];
  nextCartonId: string;
  totalWeightKg: string;
  totalLoosePrice: string;
  cartonPrice: string;
  deliveryCost: string;
  selectedConfig: CartonConfig | undefined;
  hasLooseItems: boolean;
  hasPackItems: boolean;
  canSubmit: boolean;
  isPending: boolean;
  overridePrice: boolean;
  overrideDelivery: boolean;
  overrideReason: string;
  showActions?: boolean;
  onCartonPriceChange: (value: string) => void;
  onDeliveryCostChange: (value: string) => void;
  onOverridePriceChange: (value: boolean) => void;
  onOverrideDeliveryChange: (value: boolean) => void;
  onOverrideReasonChange: (value: string) => void;
  onCreate: () => void;
};

export function CartonSummaryPanel({
  items,
  nextCartonId,
  totalWeightKg,
  totalLoosePrice,
  cartonPrice,
  deliveryCost,
  selectedConfig,
  hasLooseItems,
  hasPackItems,
  canSubmit,
  isPending,
  overridePrice,
  overrideDelivery,
  overrideReason,
  showActions = true,
  onCartonPriceChange,
  onDeliveryCostChange,
  onOverridePriceChange,
  onOverrideDeliveryChange,
  onOverrideReasonChange,
  onCreate,
}: CartonSummaryPanelProps) {
  const hasItems = items.length > 0;

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
                {item.isLoose ? `${item.packCount} KG` : `× ${item.packCount}`}
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
              {items
                .filter((i) => !i.isLoose)
                .reduce((s, i) => s + i.packCount, 0)}{" "}
              pcs
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
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label
              htmlFor="carton-price"
              className="text-sm font-medium text-foreground/80"
            >
              Carton price (৳)
            </Label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox
                checked={overridePrice}
                onCheckedChange={(value) =>
                  onOverridePriceChange(value === true)
                }
              />{" "}
              Override
            </label>
          </div>
          <Input
            id="carton-price"
            type="number"
            placeholder={String(selectedConfig?.cartonPrice || "0")}
            value={cartonPrice}
            onChange={(e) => onCartonPriceChange(e.target.value)}
            disabled={!overridePrice}
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground/55">Pack value</p>
          {items.map((item) => (
            <div
              key={item.variantId}
              className="flex justify-between text-sm gap-4"
            >
              <span className="text-foreground/60 truncate">
                {item.productName} × {item.packCount}
              </span>
              <span className="font-medium tabular-nums text-foreground flex-shrink-0">
                ৳{(item.packCount * item.price).toLocaleString()}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm pt-2 border-t font-medium">
            <span className="text-foreground/70">Total pack value</span>
            <span className="tabular-nums text-foreground">
              ৳{Number(totalLoosePrice).toLocaleString()}
            </span>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <Label
              htmlFor="delivery-cost"
              className="text-sm font-medium text-foreground/80"
            >
              Delivery cost (৳)
            </Label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox
                checked={overrideDelivery}
                onCheckedChange={(value) =>
                  onOverrideDeliveryChange(value === true)
                }
              />{" "}
              Override
            </label>
          </div>
          <Input
            id="delivery-cost"
            type="number"
            placeholder={String(selectedConfig?.deliveryCostPerCarton || "0")}
            value={deliveryCost}
            onChange={(e) => onDeliveryCostChange(e.target.value)}
            disabled={!overrideDelivery}
            className="h-10 text-sm"
          />
        </div>

        {(overridePrice || overrideDelivery) && (
          <div>
            <Label
              htmlFor="override-reason"
              className="text-sm font-medium text-foreground/80 mb-2 block"
            >
              Override reason
            </Label>
            <Textarea
              id="override-reason"
              value={overrideReason}
              onChange={(e) => onOverrideReasonChange(e.target.value)}
              placeholder="Explain why this carton differs from the approved configuration"
              className="min-h-20 text-sm"
            />
            {overrideReason.trim().length > 0 &&
              overrideReason.trim().length < 3 && (
                <p className="mt-1.5 text-xs text-red-600">
                  Enter at least 3 characters.
                </p>
              )}
          </div>
        )}
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
