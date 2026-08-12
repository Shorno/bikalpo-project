"use client";

import {
  FULFILLMENT_UNIT_CODES,
  type FulfillmentUnitCode,
  INVENTORY_BEHAVIOUR_LABELS,
} from "@bikalpo-project/db/fulfillment";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

type TrackingType = "none" | "batch" | "serial";

type RuleSettings = {
  productTypeId: number;
  trackingTypes: TrackingType[];
  trackingAvailable: boolean;
  defaultTrackingType: TrackingType;
  returnPolicyAvailable: boolean;
  returnPolicyDefault: boolean;
  expiryAvailable: boolean;
  expiryDefault: boolean;
  damageAvailable: boolean;
  damageDefault: boolean;
  stockTrackingAvailable: boolean;
  stockTrackingDefault: boolean;
  minimumOrderAvailable: boolean;
  minimumOrderDefault: boolean;
  minimumOrderQtyDefault: string;
  conversionAvailable: boolean;
  conversionDefault: boolean;
  inventoryLooseUnitAvailable: boolean;
  inventoryLooseUnitDefault: boolean;
  inventoryLooseUnitOptions: FulfillmentUnitCode[];
  defaultInventoryLooseUnit: FulfillmentUnitCode;
  returnablePackAvailable: boolean;
  returnablePackDefault: boolean;
  defaultPackDepositAmount: string;
};

type ProductTypeRow = {
  id: number;
  name: string;
  slug: string;
  inventoryBehaviour: keyof typeof INVENTORY_BEHAVIOUR_LABELS;
  ruleSettings?: RuleSettings | null;
};

type VisibilityKey =
  | "trackingAvailable"
  | "returnPolicyAvailable"
  | "expiryAvailable"
  | "damageAvailable"
  | "stockTrackingAvailable"
  | "minimumOrderAvailable"
  | "conversionAvailable"
  | "inventoryLooseUnitAvailable"
  | "returnablePackAvailable";

const VISIBILITY_RULES: Array<{
  key: VisibilityKey;
  label: string;
}> = [
  { key: "trackingAvailable", label: "Tracking" },
  { key: "returnPolicyAvailable", label: "Return" },
  { key: "expiryAvailable", label: "Expiry" },
  { key: "damageAvailable", label: "Damage" },
  { key: "stockTrackingAvailable", label: "Stock" },
  { key: "minimumOrderAvailable", label: "Minimum Order" },
  { key: "conversionAvailable", label: "Conversion" },
  { key: "inventoryLooseUnitAvailable", label: "Loose Unit" },
  { key: "returnablePackAvailable", label: "Pack Return" },
];

function moneyValue(value: unknown, fallback = "0") {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function fallbackSettingsForType(type: ProductTypeRow): RuleSettings {
  const isAutoBreak = type.inventoryBehaviour === "auto_break";
  const isLooseConvert = type.inventoryBehaviour === "loose_convert";

  return {
    productTypeId: type.id,
    trackingTypes: ["none", "batch"],
    trackingAvailable: true,
    defaultTrackingType: isLooseConvert ? "batch" : "none",
    returnPolicyAvailable: true,
    returnPolicyDefault: true,
    expiryAvailable: true,
    expiryDefault: isLooseConvert,
    damageAvailable: true,
    damageDefault: true,
    stockTrackingAvailable: true,
    stockTrackingDefault: true,
    minimumOrderAvailable: true,
    minimumOrderDefault: true,
    minimumOrderQtyDefault: "1",
    conversionAvailable: true,
    conversionDefault: isAutoBreak || isLooseConvert,
    inventoryLooseUnitAvailable: isLooseConvert,
    inventoryLooseUnitDefault: isLooseConvert,
    inventoryLooseUnitOptions: [...FULFILLMENT_UNIT_CODES],
    defaultInventoryLooseUnit: "kg",
    returnablePackAvailable: true,
    returnablePackDefault: false,
    defaultPackDepositAmount: "0",
  };
}

function normalizeSettings(type: ProductTypeRow): RuleSettings {
  const settings = type.ruleSettings ?? fallbackSettingsForType(type);
  const trackingTypes = settings.trackingTypes?.length
    ? settings.trackingTypes
    : (["none"] as TrackingType[]);
  const inventoryLooseUnitOptions = settings.inventoryLooseUnitOptions?.length
    ? settings.inventoryLooseUnitOptions
    : (["kg"] as FulfillmentUnitCode[]);

  return {
    ...settings,
    productTypeId: type.id,
    trackingTypes,
    trackingAvailable: settings.trackingAvailable ?? true,
    defaultTrackingType: trackingTypes.includes(settings.defaultTrackingType)
      ? settings.defaultTrackingType
      : trackingTypes[0]!,
    inventoryLooseUnitOptions,
    defaultInventoryLooseUnit: inventoryLooseUnitOptions.includes(
      settings.defaultInventoryLooseUnit,
    )
      ? settings.defaultInventoryLooseUnit
      : inventoryLooseUnitOptions[0]!,
    minimumOrderQtyDefault: moneyValue(settings.minimumOrderQtyDefault, "1"),
    defaultPackDepositAmount: moneyValue(
      settings.defaultPackDepositAmount,
      "0",
    ),
  };
}

export default function ProductRuleSettingsPage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, RuleSettings>>({});

  const typesQuery = useQuery(
    orpc.adminProductType.getAll.queryOptions({ input: {} }),
  );

  const productTypes = useMemo(
    () => (typesQuery.data?.types ?? []) as ProductTypeRow[],
    [typesQuery.data],
  );

  useEffect(() => {
    const next: Record<number, RuleSettings> = {};
    for (const type of productTypes) {
      next[type.id] = normalizeSettings(type);
    }
    setDrafts(next);
  }, [productTypes]);

  const saveMutation = useMutation({
    mutationFn: (settings: RuleSettings) =>
      orpc.adminProductType.updateRuleSettings.call(settings),
    onSuccess: (result) => {
      const settings = result.ruleSettings as RuleSettings;
      setDrafts((current) => ({
        ...current,
        [settings.productTypeId]: settings,
      }));
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["adminProductType"] });
    },
    onError: (error) => {
      toast.error(error.message || "Rule settings could not be saved.");
    },
  });

  const setVisibility = (
    productTypeId: number,
    key: VisibilityKey,
    checked: boolean,
  ) => {
    setDrafts((current) => {
      const draft = current[productTypeId];
      if (!draft) return current;
      return {
        ...current,
        [productTypeId]: { ...draft, [key]: checked },
      };
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
            Rule Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which Inventory &amp; Product Rules appear in product
            add/edit. Product values stay on the product itself.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {productTypes.length} types
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Type Visibility Matrix</CardTitle>
          <CardDescription>
            Saved product values are not rewritten when these switches change.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {typesQuery.isLoading ? (
            <RuleSettingsSkeleton />
          ) : typesQuery.isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Rule settings could not be loaded.
            </div>
          ) : productTypes.length === 0 ? (
            <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
              No product types found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[260px]">Type</TableHead>
                    <TableHead>Visible Rules</TableHead>
                    <TableHead className="w-[120px] text-right">Save</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productTypes.map((type) => {
                    const draft = drafts[type.id];
                    if (!draft) return null;
                    const visibleCount = VISIBILITY_RULES.filter(
                      (rule) => draft[rule.key],
                    ).length;
                    const isSaving =
                      saveMutation.isPending &&
                      saveMutation.variables?.productTypeId === type.id;

                    return (
                      <TableRow key={type.id} className="align-top">
                        <TableCell>
                          <div className="space-y-1.5">
                            <div className="font-medium">{type.name}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {type.slug}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="text-xs">
                                {
                                  INVENTORY_BEHAVIOUR_LABELS[
                                    type.inventoryBehaviour
                                  ]
                                }
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {visibleCount}/{VISIBILITY_RULES.length} shown
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                            {VISIBILITY_RULES.map((rule) => (
                              <VisibilitySwitch
                                checked={draft[rule.key]}
                                key={rule.key}
                                label={rule.label}
                                onCheckedChange={(checked) =>
                                  setVisibility(type.id, rule.key, checked)
                                }
                              />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => saveMutation.mutate(draft)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            <span className="sr-only">Save {type.name}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VisibilitySwitch({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
      <span className="font-medium">{label}</span>
      <Switch
        aria-label={`${label} visibility`}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </label>
  );
}

function RuleSettingsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton className="h-20 w-full" key={index} />
      ))}
    </div>
  );
}
