"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";

// ─── Helpers ───────────────────────────────────────────────────

function StatusIndicator({ qty }: { qty: number }) {
  if (qty <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
        <span className="w-2 h-2 bg-red-500 rounded-full" />
        Out of Stock
      </span>
    );
  }
  if (qty <= 5) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
        <span className="w-2 h-2 bg-amber-500 rounded-full" />
        Low Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
      <span className="w-2 h-2 bg-emerald-500 rounded-full" />
      In Stock
    </span>
  );
}

function NotAvailable() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500">
      <span className="w-2 h-2 bg-red-400 rounded-full" />
      Not Available
    </span>
  );
}

function formatUnitQty(value: number, isLoose: boolean) {
  if (isLoose) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: value % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });
  }
  return Math.round(value).toLocaleString();
}

const WEIGHT_UNITS = new Set(["KG", "KGS", "KILOGRAM", "KILOGRAMS"]);
const PIECE_UNITS = new Set(["PC", "PCS", "PIECE", "PIECES"]);

function normalizeUnit(unit?: string | null) {
  return String(unit || "")
    .trim()
    .toUpperCase();
}

function formatDisplayUnit(unit?: string | null) {
  const normalized = normalizeUnit(unit);
  if (normalized === "PCS" || normalized === "PC" || normalized === "PIECES") {
    return "Pc";
  }
  if (normalized === "PAIR") {
    return "Pair";
  }
  if (normalized === "PACK") {
    return "Pack";
  }
  if (normalized === "CARTON") {
    return "Carton";
  }
  return normalized || "Unit";
}

function formatQtyByUnit(value: number, unit?: string | null) {
  return formatUnitQty(value, normalizeUnit(unit) === "KG");
}

function isFashionType(typeName?: string | null) {
  return (
    String(typeName || "")
      .trim()
      .toLowerCase() === "fashion"
  );
}

function parseUnitLabelMeasure(label?: string | null) {
  const normalizedLabel = String(label || "").trim();
  if (!normalizedLabel) return null;

  const pieceMatch = normalizedLabel.match(
    /(\d+(?:\.\d+)?)\s*(pc|pcs|piece|pieces|pair|unit)\b/i,
  );
  if (pieceMatch) {
    const value = Number(pieceMatch[1]);
    if (value > 0) {
      return {
        quantityPerPack: value,
        quantityUnit: normalizeUnit(pieceMatch[2]) === "PAIR" ? "PAIR" : "PCS",
      };
    }
  }

  const weightMatch = normalizedLabel.match(
    /(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms)\b/i,
  );
  if (weightMatch) {
    const value = Number(weightMatch[1]);
    if (value > 0) {
      return {
        quantityPerPack: value,
        quantityUnit: "KG",
      };
    }
  }

  return null;
}

type VariantDisplayInventory = {
  totalQty: number;
  inCartonQty: number;
  looseQty: number;
  availableForCartonQty: number;
  activeCartonCount: number;
};

type LooseVariantRow = {
  key: string;
  label: string;
  totalQty: number;
  looseQty: number;
  inCartonQty: number;
  activeCartonCount: number;
  quantityUnit: string;
  weightKg: number;
};

type StockVariantBrand = {
  id: number | null;
  name: string;
  logo: string | null;
};

type StockVariantItem = {
  variantId: number;
  brand: StockVariantBrand | null;
  color: string | null;
  size: string | null;
  availableQty: number;
  totalQty: number;
  inCartonQty: number;
  availableForCartonQty: number;
  reservedQty: number;
  retailPrice: string | null;
  sku: string | null;
};

type StockVariantGroup = {
  packType: string;
  unitLabel: string;
  weightKg: string;
  piecesPerUnit?: number | null;
  orderUnit?: string | null;
  innerPackSizeKg: string | null;
  packCountInside: number | null;
  items: StockVariantItem[];
};

type CartonSummary = {
  variantId: number;
  totalPacks: number;
  totalWeightKg: string;
  activeCartonCount: number;
  cartonPrice: string | null;
  deliveryCostPerUnit: string | null;
  latestCartonId: string;
  latestCartonDbId: number;
};

function getGroupMeasure(group?: StockVariantGroup | null) {
  if (!group) {
    return { quantityPerPack: 0, quantityUnit: "PACK" };
  }

  const normalizedUnit = normalizeUnit(group.orderUnit);
  const weightKg = parseFloat(group.weightKg || "0");
  const piecesPerUnit = Number(group.piecesPerUnit || 0);

  if (group.packType === "loose") {
    if (PIECE_UNITS.has(normalizedUnit)) {
      return { quantityPerPack: 1, quantityUnit: "PCS" };
    }
    if (weightKg > 0 || WEIGHT_UNITS.has(normalizedUnit)) {
      return { quantityPerPack: 1, quantityUnit: "KG" };
    }
    const parsedLoose = parseUnitLabelMeasure(group.unitLabel);
    if (parsedLoose && parsedLoose.quantityUnit !== "KG") {
      return { quantityPerPack: 1, quantityUnit: parsedLoose.quantityUnit };
    }
    return { quantityPerPack: 1, quantityUnit: normalizedUnit || "KG" };
  }

  if (WEIGHT_UNITS.has(normalizedUnit) && weightKg > 0) {
    return { quantityPerPack: weightKg, quantityUnit: "KG" };
  }

  if (piecesPerUnit > 0) {
    return {
      quantityPerPack: piecesPerUnit,
      quantityUnit: PIECE_UNITS.has(normalizedUnit)
        ? "PCS"
        : normalizedUnit || "UNIT",
    };
  }

  const parsed = parseUnitLabelMeasure(group.unitLabel);
  if (parsed) {
    return parsed;
  }

  return { quantityPerPack: 1, quantityUnit: "PACK" };
}

// ─── Section Header ────────────────────────────────────────────

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
      {emoji} {title}
    </div>
  );
}

// ─── Main Detail Page ──────────────────────────────────────────

export default function StockDetailPage() {
  const params = useParams();
  const rawId = params.id as string;

  // Parse the ID: "core-123" or "product-456"
  const isCoreProduct = rawId.startsWith("core-");
  const numericId = parseInt(rawId.replace(/^(core-|product-)/, ""), 10);

  // For core product: need to fetch all products under this core identity
  // For single product: just fetch that product's breakdown
  // We'll use getStockList to get the summary, then getStockBreakdown per product

  // Fetch the stock list item (summary data)
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ["stockOverview", "stockList", "warehouse", "detail", rawId],
    queryFn: async () => {
      const result = await (orpc.stockOverview as any).getStockList.call({
        ownerType: "warehouse",
        page: 1,
        pageSize: 100, // max allowed by API
      });
      // Find our item
      const items = result?.items ?? [];
      return (
        items.find((item: any) =>
          isCoreProduct
            ? item.coreProductId === numericId
            : item.productIds.includes(numericId),
        ) ?? null
      );
    },
  });

  const item = listData;

  // Fetch variant breakdown for ALL products under this core identity
  const productIds: number[] = item?.productIds ?? [];

  const { data: allBreakdowns, isLoading: breakdownLoading } = useQuery({
    queryKey: ["stockOverview", "breakdown", productIds, "warehouse"],
    queryFn: async () => {
      const results = await Promise.all(
        productIds.map((pid) =>
          orpc.stockOverview.getStockBreakdown.call({
            productId: pid,
            ownerType: "warehouse",
          }),
        ),
      );
      return results;
    },
    enabled: productIds.length > 0,
  });

  // Merge all breakdowns into a single view
  const breakdownData = useMemo(() => {
    if (!allBreakdowns || allBreakdowns.length === 0) return null;
    const mergedGroups: StockVariantGroup[] = [];
    let mergedLooseOpen = 0;
    let mergedLooseDrum = 0;
    let mergedTotal = 0;

    for (const bd of allBreakdowns) {
      mergedTotal += bd.totalQty;
      mergedLooseOpen += bd.loosePool?.openStock ?? 0;
      mergedLooseDrum += bd.loosePool?.fullDrum ?? 0;
      for (const group of bd.variantGroups) {
        // Keep piece-based variants distinct even when their weightKg is 0.
        const existing = mergedGroups.find(
          (g) =>
            g.packType === group.packType &&
            g.weightKg === group.weightKg &&
            g.unitLabel === group.unitLabel &&
            g.piecesPerUnit === group.piecesPerUnit &&
            g.orderUnit === group.orderUnit,
        );
        if (existing) {
          existing.items.push(...group.items);
        } else {
          mergedGroups.push({ ...group, items: [...group.items] });
        }
      }
    }

    return {
      productId: productIds[0],
      totalQty: mergedTotal,
      variantGroups: mergedGroups,
      loosePool: { openStock: mergedLooseOpen, fullDrum: mergedLooseDrum },
    };
  }, [allBreakdowns, productIds]);

  // Collect all variant IDs from breakdown
  const variantGroups: StockVariantGroup[] = breakdownData?.variantGroups ?? [];
  const allVariantIds = useMemo(() => {
    const ids: number[] = [];
    for (const g of variantGroups) {
      for (const item of g.items) {
        if (!ids.includes(item.variantId)) ids.push(item.variantId);
      }
    }
    return ids;
  }, [variantGroups]);

  const packVariantGroups = useMemo(
    () => variantGroups.filter((group) => group.packType !== "loose"),
    [variantGroups],
  );

  const looseVariantGroups = useMemo(
    () => variantGroups.filter((group) => group.packType === "loose"),
    [variantGroups],
  );

  // Fetch actual carton data for all variants (from the carton table, not deprecated cartonConfig)
  const { data: cartonSummaryData } = useQuery({
    queryKey: ["warehouse", "getCartonSummaryBatch", allVariantIds],
    queryFn: () =>
      (orpc.warehouse as any).getCartonSummaryBatch.call({
        variantIds: allVariantIds,
      }),
    enabled: allVariantIds.length > 0,
  });
  const cartonSummaries: CartonSummary[] = cartonSummaryData?.cartons ?? [];

  // Build carton summary lookup: variantId → summary
  const cartonByVariant = useMemo(() => {
    const map = new Map<number, any>();
    for (const c of cartonSummaries) {
      map.set(c.variantId, c);
    }
    return map;
  }, [cartonSummaries]);

  // Selected pack for the "SELECTED PACK" section
  const [selectedPackIndex, setSelectedPackIndex] = useState<number | null>(
    null,
  );
  const [selectedFashionVariantKey, setSelectedFashionVariantKey] = useState<
    string | null
  >(null);

  const isLoading = listLoading || breakdownLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Link
          href="/warehouse/dashboard/stock/list"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Stock List
        </Link>
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg bg-gray-50/50">
          <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading stock details…
          </p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <Link
          href="/warehouse/dashboard/stock/list"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Stock List
        </Link>
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-gray-50/50">
          <Package className="text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 text-lg font-medium">Stock not found</p>
        </div>
      </div>
    );
  }

  const totalQty = item.totalQty;
  const isFashion = isFashionType(item.typeName);

  // Build breakdown text from item.breakdown (now carton-aware from API)
  const breakdownText = item.breakdown
    .map((b: any) => {
      if (b.packagingType === "loose") {
        return `${Math.round(b.qty).toLocaleString()} ${formatDisplayUnit(
          item.stdUnit,
        )} Loose`;
      }
      if (isFashion && b.packagingType !== "carton") {
        return `${Math.round(b.qty).toLocaleString()} Bundle`;
      }
      if (b.packagingType === "carton") {
        return `${Math.round(b.qty).toLocaleString()} Carton`;
      }
      return `${Math.round(b.qty).toLocaleString()} ${b.label}`;
    })
    .join(" + ");

  // Get the selected pack details
  const selectedPack =
    selectedPackIndex !== null ? packVariantGroups[selectedPackIndex] : null;

  function buildVariantLabel(
    group: StockVariantGroup,
    item: StockVariantItem,
    isLoose: boolean,
  ) {
    const weightKg = parseFloat(group.weightKg || "0");
    let label = isLoose
      ? weightKg > 0
        ? `${weightKg} KG Loose`
        : "Loose"
      : group.unitLabel || "Pack";

    if (item.brand?.name) {
      label += ` (${item.brand.name})`;
    }

    if (item.color || item.size) {
      label = [item.color, item.size].filter(Boolean).join(" - ");
    }

    return label;
  }

  function getVariantDisplayInventory(
    item: StockVariantItem,
    isLoose: boolean,
  ): VariantDisplayInventory {
    const summary = cartonByVariant.get(item.variantId);
    const summaryInCartonQty = summary
      ? parseFloat(
          isLoose
            ? summary.totalWeightKg || "0"
            : String(summary.totalPacks || 0),
        )
      : 0;

    const looseQty = item.availableForCartonQty ?? item.availableQty ?? 0;
    const inCartonQty = summary ? summaryInCartonQty : (item.inCartonQty ?? 0);
    const totalQty = summary
      ? looseQty + summaryInCartonQty
      : (item.totalQty ?? looseQty);

    return {
      totalQty,
      inCartonQty,
      looseQty,
      availableForCartonQty: looseQty,
      activeCartonCount: summary?.activeCartonCount ?? 0,
    };
  }

  // Compute actual carton counts from real carton table data (not deprecated cartonConfig)
  function getCartonInfo(group: any) {
    const measure = getGroupMeasure(group);
    let totalActiveCartons = 0;
    let totalMeasureInCartons = 0;

    for (const it of group.items) {
      const summary = cartonByVariant.get(it.variantId);
      if (summary) {
        totalActiveCartons += summary.activeCartonCount;
        totalMeasureInCartons +=
          measure.quantityUnit === "KG"
            ? parseFloat(summary.totalWeightKg || "0")
            : (summary.totalPacks || 0) * measure.quantityPerPack;
      }
    }

    const totalPacks = group.items.reduce(
      (sum: number, i: any) => sum + i.availableQty,
      0,
    );
    const totalMeasure = totalPacks * measure.quantityPerPack;

    return {
      cartonCount: totalActiveCartons,
      totalMeasure,
      totalMeasureInCartons,
      quantityUnit: measure.quantityUnit,
      hasCartons: totalActiveCartons > 0,
    };
  }

  const looseVariantRows: LooseVariantRow[] = [];

  for (const group of looseVariantGroups) {
    const measure = getGroupMeasure(group);
    for (const item of group.items) {
      const inventory = getVariantDisplayInventory(item, true);
      if (
        inventory.totalQty <= 0 &&
        inventory.looseQty <= 0 &&
        inventory.inCartonQty <= 0
      ) {
        continue;
      }

      looseVariantRows.push({
        key: `${group.weightKg}-${item.variantId}`,
        label: buildVariantLabel(group, item, true),
        totalQty: inventory.totalQty,
        looseQty: inventory.looseQty,
        inCartonQty: inventory.inCartonQty,
        activeCartonCount: inventory.activeCartonCount,
        quantityUnit: measure.quantityUnit,
        weightKg: parseFloat(group.weightKg || "0"),
      });
    }
  }

  looseVariantRows.sort(
    (a, b) => b.looseQty - a.looseQty || b.totalQty - a.totalQty,
  );

  const fashionVariantRows = isFashion
    ? packVariantGroups.flatMap((group) => {
        const measure = getGroupMeasure(group);
        if (normalizeUnit(measure.quantityUnit) === "KG") {
          return [];
        }

        return group.items.map((variantItem) => {
          const inventory = getVariantDisplayInventory(variantItem, false);
          const quantityPerPack = measure.quantityPerPack || 1;
          const label =
            [variantItem.color, variantItem.size].filter(Boolean).join(" - ") ||
            buildVariantLabel(group, variantItem, false);

          return {
            key: `${group.unitLabel}-${variantItem.variantId}`,
            label,
            totalQty: inventory.totalQty * quantityPerPack,
            looseQty: inventory.looseQty * quantityPerPack,
            inCartonQty: inventory.inCartonQty * quantityPerPack,
            quantityUnit: measure.quantityUnit,
            unitLabel: group.unitLabel,
          };
        });
      })
    : [];

  const fashionBundleRows = isFashion
    ? packVariantGroups
        .map((group, index) => {
          const measure = getGroupMeasure(group);
          if (normalizeUnit(measure.quantityUnit) === "KG") {
            return null;
          }

          const totalBundles = group.items.reduce(
            (sum, variantItem) =>
              sum + getVariantDisplayInventory(variantItem, false).totalQty,
            0,
          );

          return {
            key: `${group.unitLabel}-${index}`,
            label: `Bundle (${group.unitLabel || `${measure.quantityPerPack} ${formatDisplayUnit(measure.quantityUnit)}`})`,
            bundleQty: totalBundles,
            totalQty: totalBundles * (measure.quantityPerPack || 1),
            quantityUnit: measure.quantityUnit,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
    : [];

  const fashionLooseRows = isFashion
    ? looseVariantRows.filter((row) => normalizeUnit(row.quantityUnit) !== "KG")
    : [];

  const selectedFashionVariant =
    fashionVariantRows.find((row) => row.key === selectedFashionVariantKey) ??
    fashionVariantRows[0] ??
    null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link */}
      <Link
        href="/warehouse/dashboard/stock/list"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Stock List
      </Link>

      {/* ══════════════════════════════════════════════════════════════
          🧾 CORE IDENTITY SUMMARY
          ══════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="shrink-0 w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
            {item.coreProductImage ? (
              <Image
                src={item.coreProductImage}
                alt={item.coreProductName}
                width={48}
                height={48}
                className="w-12 h-12 object-cover"
                unoptimized={item.coreProductImage?.startsWith("http")}
              />
            ) : (
              <Package size={20} className="text-gray-400" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              🧾 {item.coreProductName}
              {item.coreProductSku && (
                <span className="text-sm font-mono text-gray-400 ml-2">
                  ({item.coreProductSku})
                </span>
              )}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {isFashion
                ? "Fashion core stock view"
                : "Core Identity Level Stock"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-gray-100">
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
              Total Stock
            </div>
            <div className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">
              {formatQtyByUnit(totalQty, item.stdUnit)}{" "}
              <span className="text-sm font-medium text-gray-500">
                {formatDisplayUnit(item.stdUnit)}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
              Stock Breakdown
            </div>
            <div className="text-sm font-semibold text-gray-700 mt-1">
              {breakdownText || "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
              Status
            </div>
            <div className="mt-1">
              <StatusIndicator qty={totalQty} />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📊 VARIANT STOCK (PACK LEVEL)
          ══════════════════════════════════════════════════════════════ */}
      {isFashion && (
        <>
          <div>
            <SectionHeader
              emoji="🎨"
              title="Variant Stock (Color + Size Level)"
            />
            {fashionVariantRows.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400 border border-dashed rounded-lg bg-gray-50/50">
                No color or size level stock available
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {fashionVariantRows.map((row) => (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setSelectedFashionVariantKey(row.key)}
                    className={`w-full flex items-center justify-between px-5 py-3 text-left transition-colors ${
                      selectedFashionVariant?.key === row.key
                        ? "bg-blue-50 border-l-2 border-l-blue-500"
                        : "hover:bg-gray-50/50"
                    }`}
                  >
                    <span className="text-sm text-gray-800 font-medium">
                      {row.label}
                    </span>
                    <div className="flex items-center gap-6">
                      <div className="text-right min-w-[220px]">
                        <div className="text-sm font-bold text-gray-900 tabular-nums">
                          {formatQtyByUnit(row.totalQty, row.quantityUnit)}{" "}
                          <span className="text-xs font-normal text-gray-500">
                            {formatDisplayUnit(row.quantityUnit)}
                          </span>
                        </div>
                        <div className="text-xs text-blue-600 tabular-nums mt-1">
                          {formatQtyByUnit(row.inCartonQty, row.quantityUnit)}{" "}
                          packed in bundles
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                          {formatQtyByUnit(row.looseQty, row.quantityUnit)}{" "}
                          ready outside bundles
                        </div>
                      </div>
                      <div className="min-w-[100px]">
                        <StatusIndicator qty={row.totalQty} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionHeader
              emoji="📦"
              title="Bundle / Pack Stock (Supply Level)"
            />
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {fashionBundleRows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors"
                >
                  <span className="text-sm text-gray-800 font-medium">
                    {row.label}
                  </span>
                  <div className="text-right min-w-[220px]">
                    <div className="text-sm font-bold text-gray-900 tabular-nums">
                      {formatUnitQty(row.bundleQty, false)}{" "}
                      <span className="text-xs font-normal text-gray-500">
                        Bundle
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 tabular-nums mt-1">
                      ({formatQtyByUnit(row.totalQty, row.quantityUnit)}{" "}
                      {formatDisplayUnit(row.quantityUnit)})
                    </div>
                  </div>
                </div>
              ))}
              {fashionLooseRows.length > 0 && (
                <div className="flex items-center justify-between px-5 py-3 bg-emerald-50/40">
                  <span className="text-sm text-gray-800 font-medium">
                    Single (Loose)
                  </span>
                  <div className="text-right min-w-[220px]">
                    <div className="text-sm font-bold text-emerald-700 tabular-nums">
                      {formatQtyByUnit(
                        fashionLooseRows.reduce(
                          (sum, row) => sum + row.looseQty,
                          0,
                        ),
                        fashionLooseRows[0]?.quantityUnit,
                      )}{" "}
                      <span className="text-xs font-normal text-gray-500">
                        {formatDisplayUnit(fashionLooseRows[0]?.quantityUnit)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Ready to sell
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {fashionLooseRows.length > 0 && (
            <div>
              <SectionHeader emoji="📦" title="Ready / Unpacked Stock" />
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {fashionLooseRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors"
                  >
                    <span className="text-sm text-gray-800 font-medium">
                      {row.label}
                    </span>
                    <div className="text-right min-w-[240px]">
                      <div className="text-sm font-bold text-gray-900 tabular-nums">
                        {formatQtyByUnit(row.looseQty, row.quantityUnit)}{" "}
                        <span className="text-xs font-normal text-gray-500">
                          {formatDisplayUnit(row.quantityUnit)}
                        </span>
                      </div>
                      <div className="text-xs text-amber-700 mt-1">
                        Ready for sorting
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedFashionVariant && (
            <div>
              <SectionHeader
                emoji="📊"
                title={`Selected Variant: ${selectedFashionVariant.label}`}
              />
              <div className="bg-blue-50/50 rounded-lg border border-blue-200 p-5 space-y-2">
                <div className="text-sm text-gray-800">
                  →{" "}
                  <span className="font-bold tabular-nums">
                    {formatQtyByUnit(
                      selectedFashionVariant.totalQty,
                      selectedFashionVariant.quantityUnit,
                    )}{" "}
                    {formatDisplayUnit(selectedFashionVariant.quantityUnit)}
                  </span>{" "}
                  available
                </div>
                <div className="text-sm text-gray-800">
                  → Bundle conversion:
                  <span className="ml-1 text-blue-700 font-medium">
                    {selectedFashionVariant.looseQty > 0
                      ? "Can be created from loose stock"
                      : "No loose stock ready"}
                  </span>
                </div>
                <div className="text-sm text-gray-800">
                  → MOQ: 1{" "}
                  {formatDisplayUnit(selectedFashionVariant.quantityUnit)}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!isFashion && (
        <>
          <div>
            <SectionHeader emoji="📊" title="Variant Stock (Pack Level)" />
            {packVariantGroups.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400 border border-dashed rounded-lg bg-gray-50/50">
                No pack variants available
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {packVariantGroups.map(
                  (group: StockVariantGroup, gi: number) => {
                    return (
                      <Fragment key={gi}>
                        {group.items.map(
                          (item: StockVariantItem, ii: number) => {
                            const { totalQty, inCartonQty, looseQty } =
                              getVariantDisplayInventory(item, false);
                            const label = buildVariantLabel(group, item, false);
                            const isLoose = false;
                            const weightKg = parseFloat(group.weightKg || "0");
                            const looseQtyCount = 0;

                            return (
                              <div
                                key={`${gi}-${ii}`}
                                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors"
                              >
                                <span className="text-sm text-gray-800 font-medium">
                                  {label}
                                </span>
                                <div className="flex items-center gap-6">
                                  <div className="text-right min-w-[220px]">
                                    <div className="text-sm font-bold text-gray-900 tabular-nums">
                                      {formatUnitQty(totalQty, false)}{" "}
                                      <span className="text-xs font-normal text-gray-500">
                                        Pack total
                                      </span>
                                      {isLoose &&
                                        weightKg > 0 &&
                                        looseQtyCount > 0 && (
                                          <span className="text-xs font-normal text-gray-400 ml-1">
                                            ({looseQtyCount} × {weightKg} KG)
                                          </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-blue-600 tabular-nums mt-1">
                                      {formatUnitQty(inCartonQty, false)} Pack
                                      inside cartons
                                    </div>
                                    <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                                      {formatUnitQty(looseQty, false)} Pack
                                      outside cartons
                                    </div>
                                  </div>
                                  <div className="min-w-[100px]">
                                    <StatusIndicator qty={totalQty} />
                                  </div>
                                </div>
                              </div>
                            );
                          },
                        )}
                      </Fragment>
                    );
                  },
                )}
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════
          📦 PACK TYPE STOCK (SUPPLY LEVEL)
          ══════════════════════════════════════════════════════════════ */}
          {packVariantGroups.length > 0 && (
            <div>
              <SectionHeader
                emoji="📦"
                title="Pack Type Stock (Supply Level)"
              />
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {packVariantGroups.map(
                  (group: StockVariantGroup, gi: number) => {
                    // Build per-brand carton info for this weight group
                    const brandCartonRows: {
                      brandName: string;
                      cartonCount: number;
                      totalMeasure: number;
                    }[] = [];
                    const measure = getGroupMeasure(group);

                    for (const it of group.items) {
                      const summary = cartonByVariant.get(it.variantId);
                      const brandName = it.brand?.name || "Unbranded";
                      const activeCount = summary?.activeCartonCount ?? 0;
                      const measureInCartons =
                        measure.quantityUnit === "KG"
                          ? parseFloat(summary?.totalWeightKg || "0")
                          : (summary?.totalPacks || 0) *
                            measure.quantityPerPack;
                      brandCartonRows.push({
                        brandName,
                        cartonCount: activeCount,
                        totalMeasure: measureInCartons,
                      });
                    }

                    // Group by brand — sum if same brand has multiple variant items
                    const brandMap = new Map<
                      string,
                      { cartonCount: number; totalMeasure: number }
                    >();
                    for (const row of brandCartonRows) {
                      if (!brandMap.has(row.brandName)) {
                        brandMap.set(row.brandName, {
                          cartonCount: 0,
                          totalMeasure: 0,
                        });
                      }
                      const e = brandMap.get(row.brandName)!;
                      e.cartonCount += row.cartonCount;
                      e.totalMeasure += row.totalMeasure;
                    }
                    const brandEntries = Array.from(brandMap.entries());
                    const totalCartons = brandEntries.reduce(
                      (s, [, v]) => s + v.cartonCount,
                      0,
                    );
                    const totalMeasure = brandEntries.reduce(
                      (s, [, v]) => s + v.totalMeasure,
                      0,
                    );

                    return (
                      <div key={gi}>
                        <div
                          className={`flex items-center justify-between px-5 py-3 cursor-pointer transition-colors ${
                            selectedPackIndex === gi
                              ? "bg-blue-50 border-l-2 border-l-blue-500"
                              : "hover:bg-gray-50/50"
                          }`}
                          onClick={() =>
                            setSelectedPackIndex(
                              selectedPackIndex === gi ? null : gi,
                            )
                          }
                        >
                          <span className="text-sm text-gray-800 font-medium">
                            {group.unitLabel} Carton
                          </span>
                          <div className="flex items-center gap-6">
                            <span className="text-sm font-bold text-gray-900 tabular-nums text-right min-w-[100px]">
                              → {totalCartons.toLocaleString()}{" "}
                              <span className="text-xs font-normal text-gray-500">
                                Carton
                              </span>
                            </span>
                            <div className="min-w-[120px]">
                              {totalCartons > 0 ? (
                                <span className="text-xs text-gray-500">
                                  (
                                  {formatUnitQty(
                                    totalMeasure,
                                    measure.quantityUnit === "KG",
                                  )}{" "}
                                  {formatDisplayUnit(measure.quantityUnit)})
                                </span>
                              ) : (
                                <NotAvailable />
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Per-brand breakdown */}
                        {brandEntries.length > 1 && (
                          <div className="px-8 pb-2 pt-0.5 space-y-1">
                            {brandEntries.map(([brand, info], bi) => (
                              <div
                                key={bi}
                                className="flex items-center justify-between text-xs text-gray-500"
                              >
                                <span className="text-gray-600">{brand}</span>
                                <span className="tabular-nums">
                                  {info.cartonCount > 0
                                    ? `${info.cartonCount} carton (${formatUnitQty(info.totalMeasure, measure.quantityUnit === "KG")} ${formatDisplayUnit(measure.quantityUnit)})`
                                    : "—  no cartons"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          )}

          {looseVariantRows.length > 0 && (
            <div>
              <SectionHeader emoji="💧" title="Loose Variant Availability" />
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                {looseVariantRows.map((row) => {
                  const totalUnitCount =
                    row.weightKg > 0
                      ? Math.round(row.totalQty / row.weightKg)
                      : 0;

                  return (
                    <div
                      key={row.key}
                      className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors"
                    >
                      <span className="text-sm text-gray-800 font-medium">
                        {row.label}
                      </span>
                      <div className="flex items-center gap-6">
                        <div className="text-right min-w-[260px]">
                          <div className="text-sm font-bold text-gray-900 tabular-nums">
                            {formatUnitQty(row.totalQty, true)}{" "}
                            <span className="text-xs font-normal text-gray-500">
                              KG total
                            </span>
                            {row.weightKg > 0 && totalUnitCount > 0 && (
                              <span className="text-xs font-normal text-gray-400 ml-1">
                                ({totalUnitCount} × {row.weightKg} KG)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-blue-600 tabular-nums mt-1">
                            {row.activeCartonCount.toLocaleString()} carton
                            generated
                            {" • "}
                            {formatUnitQty(row.inCartonQty, true)} KG packed
                            into cartons
                          </div>
                          <div className="text-xs text-emerald-700 tabular-nums mt-0.5">
                            {formatUnitQty(row.looseQty, true)} KG available in
                            loose
                          </div>
                        </div>
                        <div className="min-w-[100px]">
                          <StatusIndicator qty={row.looseQty} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
          📊 SELECTED PACK SNAPSHOT
          ══════════════════════════════════════════════════════════════ */}
          {selectedPack &&
            (() => {
              const info = getCartonInfo(selectedPack);
              return (
                <div>
                  <SectionHeader
                    emoji="📊"
                    title={`Selected Pack Snapshot: ${selectedPack.unitLabel} Carton`}
                  />
                  <div className="bg-blue-50/50 rounded-lg border border-blue-200 p-5">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
                        Available:
                      </div>
                      <div className="text-sm text-gray-800">
                        →{" "}
                        <span className="font-bold tabular-nums">
                          {info.cartonCount.toLocaleString()}
                        </span>{" "}
                        Carton
                      </div>
                      <div className="text-sm text-gray-800">
                        →{" "}
                        <span className="font-bold tabular-nums text-blue-700">
                          {formatUnitQty(
                            info.totalMeasureInCartons,
                            info.quantityUnit === "KG",
                          )}{" "}
                          {formatDisplayUnit(info.quantityUnit)}
                        </span>{" "}
                        <span className="text-gray-500">
                          currently packed into cartons
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* ══════════════════════════════════════════════════════════════
          ⚙ ACTION
          ══════════════════════════════════════════════════════════════ */}
        </>
      )}

      <div>
        <SectionHeader emoji="⚙" title="Action" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled
            className="gap-1.5 text-xs"
          >
            <PackagePlus size={14} />
            {isFashion ? "📦 Create Bundle" : "📦 Create Pack"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            className="gap-1.5 text-xs"
          >
            <RefreshCw size={14} />
            {isFashion ? "🔄 Sort Loose → Variant" : "🔄 Convert Loose → Pack"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            className="gap-1.5 text-xs"
          >
            <Plus size={14} />➕ Add Stock
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            className="gap-1.5 text-xs"
          >
            <Pencil size={14} />✏ Adjust Stock
          </Button>
        </div>
      </div>
    </div>
  );
}
