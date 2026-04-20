"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Droplets,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Tag,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useState } from "react";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      return items.find((item: any) =>
        isCoreProduct
          ? item.coreProductId === numericId
          : item.productIds.includes(numericId)
      ) ?? null;
    },
  });

  const item = listData;

  // Fetch variant breakdown for each product under this core identity
  const productIds: number[] = item?.productIds ?? [];
  const primaryProductId = productIds[0];

  const { data: breakdownData, isLoading: breakdownLoading } = useQuery({
    queryKey: ["stockOverview", "breakdown", primaryProductId, "warehouse"],
    queryFn: () =>
      orpc.stockOverview.getStockBreakdown.call({
        productId: primaryProductId!,
        ownerType: "warehouse",
      }),
    enabled: !!primaryProductId,
  });

  // Selected pack for the "SELECTED PACK" section
  const [selectedPackIndex, setSelectedPackIndex] = useState<number | null>(null);

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
          <p className="text-sm text-muted-foreground">Loading stock details…</p>
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

  const variantGroups = breakdownData?.variantGroups ?? [];
  const loosePool = breakdownData?.loosePool;
  const totalQty = item.totalQty;
  const breakdownText = item.breakdown
    .map((b: any) => `${Math.round(b.qty).toLocaleString()} ${b.label}`)
    .join(" + ");

  // Pack type groups (non-loose — for SUPPLY LEVEL section)
  const packTypeGroups = variantGroups.filter(
    (g: any) => g.packType !== "loose"
  );

  // Get the selected pack details
  const selectedPack =
    selectedPackIndex !== null ? packTypeGroups[selectedPackIndex] : null;

  // Calculate loose convertible
  const looseTotal = (loosePool?.openStock ?? 0) + (loosePool?.fullDrum ?? 0);

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
              Core Identity Level Stock
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-gray-100">
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
              Total Stock
            </div>
            <div className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">
              {Math.round(totalQty).toLocaleString()}{" "}
              <span className="text-sm font-medium text-gray-500">
                {item.stdUnit}
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
      <div>
        <SectionHeader emoji="📊" title="Variant Stock (Pack Level)" />
        {variantGroups.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400 border border-dashed rounded-lg bg-gray-50/50">
            No variant breakdown available
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {variantGroups.map((group: any, gi: number) => {
              const isLoose = group.packType === "loose";
              return (
                <Fragment key={gi}>
                  {group.items.map((item: any, ii: number) => {
                    // Build label matching doc format: "5KG Pack (ACI)" or "Loose (Sellable)"
                    let label = isLoose
                      ? "Loose (Sellable)"
                      : group.unitLabel || "Pack";
                    if (item.brand?.name) {
                      label += ` (${item.brand.name})`;
                    }
                    if (item.color || item.size) {
                      label = [item.color, item.size].filter(Boolean).join(" - ");
                    }

                    return (
                      <div
                        key={`${gi}-${ii}`}
                        className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors"
                      >
                        <span className="text-sm text-gray-800 font-medium">
                          {label}
                        </span>
                        <div className="flex items-center gap-6">
                          <span className="text-sm font-bold text-gray-900 tabular-nums text-right min-w-[100px]">
                            →{" "}
                            {item.availableQty.toLocaleString()}{" "}
                            <span className="text-xs font-normal text-gray-500">
                              {isLoose ? "KG" : "Pack"}
                            </span>
                          </span>
                          <div className="min-w-[100px]">
                            <StatusIndicator qty={item.availableQty} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📦 PACK TYPE STOCK (SUPPLY LEVEL)
          ══════════════════════════════════════════════════════════════ */}
      {packTypeGroups.length > 0 && (
        <div>
          <SectionHeader emoji="📦" title="Pack Type Stock (Supply Level)" />
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {packTypeGroups.map((group: any, gi: number) => {
              const groupTotal = group.items.reduce(
                (sum: number, i: any) => sum + i.availableQty,
                0
              );
              const weightKg = parseFloat(group.weightKg || "0");
              const totalKg = groupTotal * weightKg;

              return (
                <div
                  key={gi}
                  className={`flex items-center justify-between px-5 py-3 cursor-pointer transition-colors ${
                    selectedPackIndex === gi
                      ? "bg-blue-50 border-l-2 border-l-blue-500"
                      : "hover:bg-gray-50/50"
                  }`}
                  onClick={() =>
                    setSelectedPackIndex(selectedPackIndex === gi ? null : gi)
                  }
                >
                  <span className="text-sm text-gray-800 font-medium">
                    {group.unitLabel}
                  </span>
                  <div className="flex items-center gap-6">
                    <span className="text-sm font-bold text-gray-900 tabular-nums text-right min-w-[100px]">
                      →{" "}
                      {groupTotal.toLocaleString()}{" "}
                      <span className="text-xs font-normal text-gray-500">
                        Carton
                      </span>
                    </span>
                    <div className="min-w-[120px]">
                      {groupTotal > 0 ? (
                        <span className="text-xs text-gray-500">
                          ({Math.round(totalKg).toLocaleString()} KG)
                        </span>
                      ) : (
                        <NotAvailable />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          📦 LOOSE / READY STOCK
          ══════════════════════════════════════════════════════════════ */}
      {loosePool && (loosePool.openStock > 0 || loosePool.fullDrum > 0) && (
        <div>
          <SectionHeader emoji="📦" title="Loose / Ready Stock" />
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {loosePool.openStock > 0 && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-gray-800 font-medium">
                  Unpacked (Reserved)
                </span>
                <div className="flex items-center gap-6">
                  <span className="text-sm font-bold text-gray-900 tabular-nums text-right min-w-[100px]">
                    → {loosePool.openStock.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-gray-500">KG</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 min-w-[120px]">
                    <span className="w-2 h-2 bg-amber-500 rounded-full" />
                    Ready for Packing
                  </span>
                </div>
              </div>
            )}
            {loosePool.fullDrum > 0 && (
              <div className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-gray-800 font-medium">
                  Full Drum / Sealed
                </span>
                <div className="flex items-center gap-6">
                  <span className="text-sm font-bold text-gray-900 tabular-nums text-right min-w-[100px]">
                    → {loosePool.fullDrum.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-gray-500">KG</span>
                  </span>
                  <StatusIndicator qty={loosePool.fullDrum} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          📊 SELECTED PACK (Interactive)
          ══════════════════════════════════════════════════════════════ */}
      {selectedPack && (
        <div>
          <SectionHeader
            emoji="📊"
            title={`Selected Pack: ${selectedPack.unitLabel}`}
          />
          <div className="bg-blue-50/50 rounded-lg border border-blue-200 p-5">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
                Available:
              </div>
              <div className="text-sm text-gray-800">
                →{" "}
                <span className="font-bold tabular-nums">
                  {selectedPack.items
                    .reduce((sum: number, i: any) => sum + i.availableQty, 0)
                    .toLocaleString()}
                </span>{" "}
                Carton
              </div>
              {looseTotal > 0 && (
                <div className="text-sm text-gray-800">
                  →{" "}
                  <span className="font-bold tabular-nums text-blue-700">
                    +{looseTotal.toLocaleString()} KG
                  </span>{" "}
                  <span className="text-gray-500">
                    (Convertible from Loose)
                  </span>
                </div>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-blue-200/50">
              <span className="text-xs text-gray-500">
                MOQ:{" "}
                <span className="font-semibold text-gray-700">1 Carton</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ⚙ ACTION (Placeholders)
          ══════════════════════════════════════════════════════════════ */}
      <div>
        <SectionHeader emoji="⚙" title="Action" />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled className="gap-1.5 text-xs">
            <PackagePlus size={14} />
            📦 Create Pack
          </Button>
          <Button variant="outline" size="sm" disabled className="gap-1.5 text-xs">
            <RefreshCw size={14} />
            🔄 Convert Loose → Pack
          </Button>
          <Button variant="outline" size="sm" disabled className="gap-1.5 text-xs">
            <Plus size={14} />
            ➕ Add Stock
          </Button>
          <Button variant="outline" size="sm" disabled className="gap-1.5 text-xs">
            <Pencil size={14} />
            ✏ Adjust Stock
          </Button>
          <Button variant="outline" size="sm" disabled className="gap-1.5 text-xs">
            <Truck size={14} />
            🚚 Supply / Sell
          </Button>
        </div>
      </div>
    </div>
  );
}
