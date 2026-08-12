"use client";

import {
  FULFILLMENT_UNITS,
  PRODUCT_TYPE_FAMILY_LABELS,
  type ProductTypeFulfillmentProfile,
  VARIANT_DIMENSION_LABELS,
} from "@bikalpo-project/db/fulfillment";
import { Badge } from "@/components/ui/badge";

type FulfillmentProfilePreviewProps = {
  profile: ProductTypeFulfillmentProfile;
  compact?: boolean;
};

export default function FulfillmentProfilePreview({
  profile,
  compact = false,
}: FulfillmentProfilePreviewProps) {
  if (compact) {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <div className="font-medium">
          Family: {PRODUCT_TYPE_FAMILY_LABELS[profile.family]}
        </div>
        <div className="text-muted-foreground">
          Modes: {profile.supportedModes.join(", ")}
        </div>
        <div className="text-muted-foreground">
          Flow: {profile.orderUnit} order {"->"} {profile.conversionUnit}{" "}
          conversion
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Family</div>
          <div className="mt-1 font-semibold">
            {PRODUCT_TYPE_FAMILY_LABELS[profile.family]}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Default Mode</div>
          <div className="mt-1 font-semibold capitalize">
            {profile.defaultMode}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Mode Switching</div>
          <div className="mt-1 font-semibold">
            {profile.supportsModeSwitching ? "Supported" : "Fixed"}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Tracking</div>
          <div className="mt-1 font-semibold">
            {profile.supportsTrackedAssets ? "Tracked" : "Standard"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">Unit Model</div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div>Order: {FULFILLMENT_UNITS[profile.orderUnit].label}</div>
            <div>Stock: {FULFILLMENT_UNITS[profile.stockUnit].label}</div>
            <div>
              Conversion: {FULFILLMENT_UNITS[profile.conversionUnit].label}
            </div>
            <div>Display: {FULFILLMENT_UNITS[profile.displayUnit].label}</div>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">Dimensions & Capabilities</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.variantDimensions.map((dimension) => (
              <Badge key={dimension} variant="outline">
                {VARIANT_DIMENSION_LABELS[dimension]}
              </Badge>
            ))}
            {profile.supportsTrackedAssets && (
              <Badge variant="outline">Tracked Assets</Badge>
            )}
            {profile.supportsEmptyReturn && (
              <Badge variant="outline">Empty Return</Badge>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.supportedModes.map((mode) => (
              <Badge key={mode} variant="secondary" className="capitalize">
                {mode}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        {profile.notes}
      </div>
    </div>
  );
}
