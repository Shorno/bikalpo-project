"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Boxes,
  CalendarClock,
  ClipboardList,
  Layers3,
  Package,
  PackagePlus,
  PackageSearch,
  Plus,
  Tag,
  Wallet,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

const WH = "/warehouse/dashboard";

type KPIData = {
  mainKPI: {
    totalProducts: number;
    totalSKU: number;
    totalUnits: number;
    totalStockValue: number;
  };
  stockStatus: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
    expired: number;
  };
  inventoryType: {
    looseStock: number;
    packStock: number;
    cartonStock: number;
    emptyPack: number;
  };
};

type StockCategory = {
  id: number;
  name: string;
  productCount: number;
};

type BreakdownItem = {
  packagingType: string;
  label: string;
  qty: number;
  unit: string;
};

type StockListItem = {
  groupKey: string;
  coreProductId: number | null;
  coreProductName: string;
  coreProductSku: string | null;
  categoryName: string | null;
  totalQty: number;
  stdUnit: string;
  variantCount: number;
  productIds: number[];
  breakdown: BreakdownItem[];
  status: "in_stock" | "out_of_stock";
};

function formatNumber(value: number | string | null | undefined) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num.toLocaleString("en-BD") : "0";
}

function formatCurrency(value: number | string | null | undefined) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "Tk 0";
  if (num >= 10000000) {
    return `Tk ${(num / 10000000).toFixed(1)} Cr`;
  }
  return `Tk ${num.toLocaleString("en-BD")}`;
}

function summarizeCategoryStock(
  items: StockListItem[] | undefined,
  totalCount: number,
) {
  if (!items?.length) {
    return totalCount > 0
      ? `${formatNumber(totalCount)} core products`
      : "No stock yet";
  }

  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.breakdown.length === 0) {
      totals.set(item.stdUnit, (totals.get(item.stdUnit) ?? 0) + item.totalQty);
      continue;
    }

    for (const part of item.breakdown) {
      const unit =
        part.packagingType === "loose" ? item.stdUnit : part.unit || part.label;
      totals.set(unit, (totals.get(unit) ?? 0) + part.qty);
    }
  }

  const summary = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([unit, qty]) => `${formatNumber(Math.round(qty))} ${unit}`)
    .join(" + ");

  return summary || `${formatNumber(totalCount)} core products`;
}

export default function WarehouseInventoryPage() {
  const { data: session } = authClient.useSession();

  const warehouseName = (session?.user as any)?.warehouseName || "My Warehouse";

  const { data: kpi, isLoading: isLoadingKpi } = useQuery({
    queryKey: ["stockOverview", "dashboardKPI", "warehouse", "inventoryCenter"],
    queryFn: () =>
      (orpc.stockOverview as any).getStockDashboardKPI.call({
        ownerType: "warehouse",
      }),
    staleTime: 1000 * 60,
  });

  const { data: categoryData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["stockOverview", "categories", "warehouse", "inventoryCenter"],
    queryFn: () =>
      (orpc.stockOverview as any).getStockCategories.call({
        ownerType: "warehouse",
      }),
    staleTime: 1000 * 60,
  });

  const categories = (categoryData?.categories ?? []) as StockCategory[];

  const categoryStockQueries = useQueries({
    queries: categories.map((category) => ({
      queryKey: [
        "stockOverview",
        "stockList",
        "warehouse",
        "inventoryCenterCategory",
        category.id,
      ],
      queryFn: () =>
        (orpc.stockOverview as any).getStockList.call({
          ownerType: "warehouse",
          categoryId: category.id,
          page: 1,
          pageSize: 100,
        }),
      staleTime: 1000 * 60,
    })),
  });

  const categoryBrandQueries = useQueries({
    queries: categories.map((category) => ({
      queryKey: [
        "stockOverview",
        "brandStockOverview",
        "warehouse",
        "inventoryCenterCategory",
        category.id,
      ],
      queryFn: () =>
        (orpc.stockOverview as any).getBrandStockOverview.call({
          ownerType: "warehouse",
          categoryId: category.id,
        }),
      staleTime: 1000 * 60,
    })),
  });

  const categoryRows = useMemo(
    () =>
      categories.map((category, index) => {
        const stockData = categoryStockQueries[index]?.data as
          | { items?: StockListItem[]; totalCount?: number }
          | undefined;
        const brandData = categoryBrandQueries[index]?.data as
          | { brands?: unknown[] }
          | undefined;
        const totalCount = stockData?.totalCount ?? category.productCount;

        return {
          ...category,
          coreCount: totalCount,
          brandCount: brandData?.brands?.length ?? 0,
          stockSummary: summarizeCategoryStock(stockData?.items, totalCount),
          loading:
            categoryStockQueries[index]?.isLoading ||
            categoryBrandQueries[index]?.isLoading,
        };
      }),
    [categories, categoryBrandQueries, categoryStockQueries],
  );

  const kpiData = kpi as KPIData | undefined;

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <Warehouse className="h-3.5 w-3.5" />
              Warehouse: {warehouseName}
            </div>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950">
              Inventory Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Showing: Today Overview
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
            <QuickAction
              href={`${WH}/catalog`}
              icon={Plus}
              label="Create Product"
            />
            <QuickAction
              href={`${WH}/stock/add`}
              icon={PackagePlus}
              label="Add Stock"
            />
            <QuickAction
              href={`${WH}/stock-adjustment/create`}
              icon={ArrowRightLeft}
              label="Stock Adjustment"
            />
            <QuickAction
              href={`${WH}/carton-tracking`}
              icon={Boxes}
              label="Transfer"
            />
          </div>
        </div>
      </header>

      <section>
        <SectionTitle icon={PackageSearch} title="KPI Overview" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            color="sky"
            icon={Tag}
            label="Total SKU"
            loading={isLoadingKpi}
            value={kpiData?.mainKPI.totalSKU}
          />
          <KpiCard
            color="emerald"
            icon={Package}
            label="Active Products"
            loading={isLoadingKpi}
            value={kpiData?.mainKPI.totalProducts}
          />
          <KpiCard
            color="amber"
            icon={AlertTriangle}
            label="Low Stock"
            loading={isLoadingKpi}
            value={kpiData?.stockStatus.lowStock}
          />
          <KpiCard
            color="rose"
            icon={CalendarClock}
            label="Expired"
            loading={isLoadingKpi}
            value={kpiData?.stockStatus.expired}
          />
          <KpiCard
            color="indigo"
            icon={Boxes}
            label="Total Carton"
            loading={isLoadingKpi}
            value={kpiData?.inventoryType.cartonStock}
          />
          <KpiCard
            color="slate"
            icon={Layers3}
            label="Loose Inventory"
            loading={isLoadingKpi}
            value={
              kpiData
                ? `${formatNumber(kpiData.inventoryType.looseStock)} mixed units`
                : undefined
            }
          />
          <KpiCard
            color="emerald"
            icon={Wallet}
            label="Inventory Value"
            loading={isLoadingKpi}
            value={
              kpiData
                ? formatCurrency(kpiData.mainKPI.totalStockValue)
                : undefined
            }
          />
          <KpiCard
            color="slate"
            icon={ClipboardList}
            label="Pack Stock"
            loading={isLoadingKpi}
            value={kpiData?.inventoryType.packStock}
          />
        </div>
      </section>

      <section>
        <SectionTitle icon={Boxes} title="Product Category Overview" />
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.4fr_0.6fr_0.6fr_1.6fr_0.5fr] border-b bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-normal text-slate-500">
            <span>Category</span>
            <span>Core</span>
            <span>Brands</span>
            <span>Stock Summary</span>
            <span className="text-right">View</span>
          </div>
          {isLoadingCategories ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-10 w-full" />
              ))}
            </div>
          ) : categoryRows.length === 0 ? (
            <EmptyState text="No inventory categories yet" />
          ) : (
            <div className="divide-y divide-slate-100">
              {categoryRows.map((category) => (
                <Link
                  key={category.id}
                  href={`${WH}/inventory/category/${category.id}`}
                  className="group grid grid-cols-[1.4fr_0.6fr_0.6fr_1.6fr_0.5fr] items-center px-4 py-3 text-sm transition-colors hover:bg-slate-50"
                  aria-label={`View ${category.name} category inventory`}
                >
                  <span className="font-semibold text-slate-900">
                    {category.name}
                  </span>
                  <span className="tabular-nums text-slate-700">
                    {category.loading
                      ? "..."
                      : formatNumber(category.coreCount)}
                  </span>
                  <span className="tabular-nums text-slate-700">
                    {category.loading
                      ? "..."
                      : formatNumber(category.brandCount)}
                  </span>
                  <span className="truncate text-slate-600">
                    {category.stockSummary}
                  </span>
                  <span className="justify-self-end rounded-md p-1.5 text-slate-500 transition-colors group-hover:text-slate-950">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <SectionTitle icon={PackageSearch} title="Quick Navigation" />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <QuickNav href={`${WH}/catalog`} label="View Product Catalog" />
          <QuickNav href={`${WH}/stock/list`} label="View Stock Real-time" />
          <QuickNav href={`${WH}/stock`} label="Check Low Stock" />
          <QuickNav
            href={`${WH}/stock/expired`}
            label="Manage Expired Products"
          />
          <QuickNav
            href={`${WH}/carton-tracking`}
            label="Track Carton / Drum"
          />
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <Button asChild variant="outline" size="sm" className="justify-start">
      <Link href={href}>
        <Icon className="mr-2 h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="rounded-md bg-slate-100 p-1.5 text-slate-600">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-sm font-bold uppercase tracking-normal text-slate-900">
        {title}
      </h2>
    </div>
  );
}

function KpiCard({
  color,
  icon: Icon,
  label,
  loading,
  value,
}: {
  color: "amber" | "emerald" | "indigo" | "rose" | "sky" | "slate";
  icon: React.ElementType;
  label: string;
  loading: boolean;
  value: number | string | undefined;
}) {
  const colorClasses = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">
          {label}
        </p>
        <span className={`rounded-md border p-1.5 ${colorClasses[color]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <p className="text-2xl font-bold tabular-nums text-slate-950">
          {typeof value === "number" ? formatNumber(value) : value || "0"}
        </p>
      )}
    </div>
  );
}

function QuickNav({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
    >
      <span>{label}</span>
      <ArrowRight className="h-4 w-4 text-slate-400" />
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-slate-500">{text}</div>;
}
