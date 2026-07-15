"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  PackagePlus,
  Search,
  Settings2,
  Tags,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

const WAREHOUSE_DASHBOARD = "/warehouse/dashboard";

type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

type StockQuantityGroup = {
  family: string;
  familyLabel: string;
  inventoryUnit: string;
  productCount: number;
  variantCount: number;
  available: number;
  reserved: number;
  onHand: number;
  referenceMeasurement?: {
    unit: "kg" | "liter";
    available: number;
    reserved: number;
    onHand: number;
  };
};

type StructuredStockDashboard = {
  summary: {
    activeProducts: number;
    activeVariants: number;
    sellingStockValue: number;
    pricedStockVariantCount: number;
    unpricedStockVariantCount: number;
  };
  stockStatus: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
    reserved: number;
    missingThreshold: number;
  };
  quantityGroups: StockQuantityGroup[];
  configurationIssueCount: number;
};

type StructuredStockVariant = {
  productId: number;
  variantId: number;
  productName: string;
  brandName: string | null;
  sku: string | null;
  canonicalLabel: string | null;
  displayAlias: string | null;
  family: string | null;
  inventoryUnit: string | null;
  available: number;
  reserved: number;
  onHand: number;
  referenceMeasurement?: {
    unit: "kg" | "liter";
    perInventoryUnit: number;
    available: number;
    reserved: number;
    onHand: number;
  };
  warehouseSellingPrice: number | null;
  sellingStockValue: number | null;
  reorderLevel: number | null;
  thresholdConfigured: boolean;
  status: StockStatus;
  configurationState: "valid" | "needs_admin_variant_setup";
};

type VariantPage = {
  items: StructuredStockVariant[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const quantityFormatter = new Intl.NumberFormat("en-BD", {
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("en-BD", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function pluralizeUnit(unit: string, quantity: number) {
  if (quantity === 1) return unit;
  if (["kg", "g", "l", "ml"].includes(unit.toLowerCase())) return unit;
  if (unit.endsWith("s")) return unit;
  if (unit.endsWith("x")) return `${unit}es`;
  return `${unit}s`;
}

function formatQuantity(quantity: number, unit: string | null) {
  const value = quantityFormatter.format(quantity);
  return unit ? `${value} ${pluralizeUnit(unit, quantity)}` : value;
}

function formatReferenceUnit(unit: "kg" | "liter") {
  return unit === "kg" ? "KG" : "L";
}

function formatCurrency(value: number) {
  return `৳ ${currencyFormatter.format(value)}`;
}

function OverviewSkeleton() {
  return (
    <div
      aria-label="Loading stock overview"
      className="space-y-6"
      role="status"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid overflow-hidden rounded-lg border border-zinc-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="space-y-3 border-b border-zinc-200 p-5 last:border-b-0 sm:nth-[2]:border-r-0 sm:border-r xl:border-b-0"
            key={index}
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
      <Skeleton className="h-44 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

function StatusBadge({ status }: { status: StockStatus }) {
  const styles = {
    in_stock: "border-emerald-200 bg-emerald-50 text-emerald-700",
    low_stock: "border-amber-200 bg-amber-50 text-amber-800",
    out_of_stock: "border-red-200 bg-red-50 text-red-700",
  };
  const labels = {
    in_stock: "In stock",
    low_stock: "Low stock",
    out_of_stock: "Out of stock",
  };
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default function StockOverviewDashboard() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("");
  const [status, setStatus] = useState<StockStatus | "">("");
  const [configurationState, setConfigurationState] = useState<
    "needs_admin_variant_setup" | ""
  >("");
  const deferredSearch = useDeferredValue(search.trim());

  const dashboardQuery = useQuery({
    queryKey: ["stockOverview", "structuredDashboard", "warehouse"],
    queryFn: () =>
      (orpc.stockOverview as any).getStockDashboardKPI.call({
        ownerType: "warehouse",
      }),
  });

  const variantQuery = useQuery({
    queryKey: [
      "stockOverview",
      "structuredVariants",
      "warehouse",
      page,
      deferredSearch,
      family,
      status,
      configurationState,
    ],
    queryFn: () =>
      (orpc.stockOverview as any).getStockDashboardVariants.call({
        ownerType: "warehouse",
        page,
        pageSize: 25,
        search: deferredSearch || undefined,
        family: family || undefined,
        status: status || undefined,
        configurationState: configurationState || undefined,
      }),
    placeholderData: (previousData: unknown) => previousData,
  });

  if (dashboardQuery.isLoading) return <OverviewSkeleton />;

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-red-700" />
          <div>
            <h1 className="font-semibold text-red-950">
              Stock overview could not load
            </h1>
            <p className="mt-1 text-sm text-red-800">
              The warehouse balances were not changed. Retry the structured
              overview request.
            </p>
            <Button
              className="mt-4"
              onClick={() => dashboardQuery.refetch()}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const dashboard = dashboardQuery.data as StructuredStockDashboard;
  const variantPage = variantQuery.data as VariantPage | undefined;
  const stockedVariantCount =
    dashboard.summary.pricedStockVariantCount +
    dashboard.summary.unpricedStockVariantCount;
  const priceCoverage =
    stockedVariantCount > 0
      ? Math.round(
          (dashboard.summary.pricedStockVariantCount / stockedVariantCount) *
            100,
        )
      : 100;
  const familyOptions = Array.from(
    new Map(
      dashboard.quantityGroups.map((group) => [
        group.family,
        group.familyLabel,
      ]),
    ),
  );

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
            <BarChart3 className="h-4 w-4" />
            Warehouse inventory
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            Stock overview
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Live balances grouped by the units and measurements defined in Admin
            Variant Setup.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`${WAREHOUSE_DASHBOARD}/pricing`}>
              <CircleDollarSign className="h-4 w-4" />
              Pricing
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`${WAREHOUSE_DASHBOARD}/stock/add`}>
              <PackagePlus className="h-4 w-4" />
              Add stock
            </Link>
          </Button>
        </div>
      </header>

      <section aria-label="Inventory summary">
        <div className="grid overflow-hidden rounded-lg border border-zinc-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric
            label="Active products"
            note="Brand products in warehouse inventory"
            value={quantityFormatter.format(dashboard.summary.activeProducts)}
          />
          <SummaryMetric
            label="Active variants"
            note="Exact Admin-configured variants"
            value={quantityFormatter.format(dashboard.summary.activeVariants)}
          />
          <SummaryMetric
            label="Selling stock value"
            note={
              dashboard.summary.unpricedStockVariantCount > 0
                ? `Incomplete, ${dashboard.summary.unpricedStockVariantCount} stocked variants unpriced`
                : "Available and reserved stock"
            }
            value={formatCurrency(dashboard.summary.sellingStockValue)}
            warning={dashboard.summary.unpricedStockVariantCount > 0}
          />
          <SummaryMetric
            label="Price coverage"
            note={`${dashboard.summary.pricedStockVariantCount} of ${stockedVariantCount} stocked variants priced`}
            value={`${priceCoverage}%`}
          />
        </div>
      </section>

      {(dashboard.summary.unpricedStockVariantCount > 0 ||
        dashboard.stockStatus.missingThreshold > 0 ||
        dashboard.configurationIssueCount > 0) && (
        <section
          className="grid gap-3 lg:grid-cols-3"
          aria-label="Configuration notices"
        >
          {dashboard.summary.unpricedStockVariantCount > 0 && (
            <Notice
              actionHref={`${WAREHOUSE_DASHBOARD}/pricing`}
              actionLabel="Open pricing"
              description={`${dashboard.summary.unpricedStockVariantCount} stocked variants are excluded from selling value until a warehouse price is set.`}
              icon={CircleDollarSign}
              title="Valuation is incomplete"
              tone="warning"
            />
          )}
          {dashboard.stockStatus.missingThreshold > 0 && (
            <Notice
              description={`${dashboard.stockStatus.missingThreshold} variants have no variant or product reorder threshold. They are not classified as low stock.`}
              icon={Settings2}
              title="Thresholds need configuration"
              tone="neutral"
            />
          )}
          {dashboard.configurationIssueCount > 0 && (
            <Notice
              actionLabel="Show affected variants"
              description={`${dashboard.configurationIssueCount} variants could not be resolved from Admin Variant Setup. Legacy labels were not used as a fallback.`}
              icon={TriangleAlert}
              onAction={() => {
                setConfigurationState("needs_admin_variant_setup");
                resetPage();
              }}
              title="Admin setup required"
              tone="danger"
            />
          )}
        </section>
      )}

      <section className="space-y-3" aria-labelledby="stock-position-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2
              className="text-lg font-semibold text-zinc-950"
              id="stock-position-heading"
            >
              Stock position
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Quantities remain separated by family and inventory unit.
            </p>
          </div>
        </div>
        {dashboard.quantityGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-10 text-center">
            <Tags className="mx-auto h-6 w-6 text-zinc-400" />
            <p className="mt-3 text-sm font-medium text-zinc-800">
              No resolved stock groups
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Add an Admin-configured variant to warehouse inventory to create a
              stock group.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="hidden grid-cols-[1.4fr_repeat(3,1fr)_1.35fr] gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:grid">
              <span>Family and unit</span>
              <span>Available</span>
              <span>Reserved</span>
              <span>On hand</span>
              <span>Reference content</span>
            </div>
            <div className="divide-y divide-zinc-200">
              {dashboard.quantityGroups.map((group) => (
                <div
                  className="grid gap-4 px-5 py-4 md:grid-cols-[1.4fr_repeat(3,1fr)_1.35fr] md:items-center"
                  key={`${group.family}:${group.inventoryUnit}:${group.referenceMeasurement?.unit ?? "none"}`}
                >
                  <div>
                    <p className="font-semibold text-zinc-900">
                      {group.familyLabel}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {group.variantCount} variants across {group.productCount}{" "}
                      products · {group.inventoryUnit}
                    </p>
                  </div>
                  <QuantityCell
                    label="Available"
                    quantity={group.available}
                    unit={group.inventoryUnit}
                  />
                  <QuantityCell
                    label="Reserved"
                    quantity={group.reserved}
                    unit={group.inventoryUnit}
                  />
                  <QuantityCell
                    label="On hand"
                    quantity={group.onHand}
                    unit={group.inventoryUnit}
                    strong
                  />
                  <div>
                    <p className="text-xs font-medium text-zinc-500 md:hidden">
                      Reference content
                    </p>
                    {group.referenceMeasurement ? (
                      <>
                        <p className="font-mono text-sm font-semibold tabular-nums text-zinc-900">
                          {quantityFormatter.format(
                            group.referenceMeasurement.onHand,
                          )}{" "}
                          {formatReferenceUnit(group.referenceMeasurement.unit)}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Capacity reference, not inventory quantity
                        </p>
                      </>
                    ) : (
                      <span className="text-sm text-zinc-400">
                        Not applicable
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="stock-health-heading">
        <div>
          <h2
            className="text-lg font-semibold text-zinc-950"
            id="stock-health-heading"
          >
            Stock health
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Status uses available quantity and configured reorder thresholds.
          </p>
        </div>
        <div className="grid overflow-hidden rounded-lg border border-zinc-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
          <StatusMetric
            icon={CheckCircle2}
            label="In stock"
            tone="success"
            value={dashboard.stockStatus.inStock}
          />
          <StatusMetric
            icon={TriangleAlert}
            label="Low stock"
            tone="warning"
            value={dashboard.stockStatus.lowStock}
          />
          <StatusMetric
            icon={AlertCircle}
            label="Out of stock"
            tone="danger"
            value={dashboard.stockStatus.outOfStock}
          />
          <StatusMetric
            icon={Tags}
            label="Reserved SKUs"
            tone="info"
            value={dashboard.stockStatus.reserved}
          />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="variant-stock-heading">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2
              className="text-lg font-semibold text-zinc-950"
              id="variant-stock-heading"
            >
              Variant stock
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Exact balances by brand and canonical Admin variant.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_160px]">
            <label className="relative block">
              <span className="sr-only">Search variants</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Search product, brand, SKU"
                type="search"
                value={search}
              />
            </label>
            <label>
              <span className="sr-only">Filter by family</span>
              <select
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => {
                  setFamily(event.target.value);
                  resetPage();
                }}
                value={family}
              >
                <option value="">All families</option>
                {familyOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by stock status</span>
              <select
                className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => {
                  setStatus(event.target.value as StockStatus | "");
                  resetPage();
                }}
                value={status}
              >
                <option value="">All statuses</option>
                <option value="in_stock">In stock</option>
                <option value="low_stock">Low stock</option>
                <option value="out_of_stock">Out of stock</option>
              </select>
            </label>
          </div>
        </div>

        {configurationState && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <span>Showing variants that need Admin Variant Setup.</span>
            <button
              className="font-semibold underline underline-offset-2"
              onClick={() => {
                setConfigurationState("");
                resetPage();
              }}
              type="button"
            >
              Clear filter
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Admin variant</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3 text-right">Reserved</th>
                  <th className="px-4 py-3 text-right">On hand</th>
                  <th className="px-4 py-3 text-right">Selling price</th>
                  <th className="px-4 py-3 text-right">Stock value</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {variantQuery.isLoading && !variantPage
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index}>
                        {Array.from({ length: 8 }).map((__, cellIndex) => (
                          <td className="px-4 py-4" key={cellIndex}>
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : variantPage?.items.map((variant) => (
                      <tr
                        className="align-top hover:bg-zinc-50/70"
                        key={variant.variantId}
                      >
                        <td className="px-4 py-4">
                          <p className="font-semibold text-zinc-900">
                            {variant.productName}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {variant.brandName ?? "Brand not assigned"}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-zinc-400">
                            {variant.sku ?? "No SKU"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {variant.configurationState === "valid" ? (
                            <>
                              <p className="font-medium text-zinc-900">
                                {variant.canonicalLabel}
                              </p>
                              {variant.displayAlias && (
                                <p className="mt-0.5 text-xs text-zinc-500">
                                  Alias: {variant.displayAlias}
                                </p>
                              )}
                              <p className="mt-1 text-xs text-zinc-400">
                                Inventory unit: {variant.inventoryUnit}
                              </p>
                            </>
                          ) : (
                            <div className="max-w-xs">
                              <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                                Admin setup required
                              </span>
                              <p className="mt-1 text-xs text-zinc-500">
                                No legacy label or unit was inferred.
                              </p>
                            </div>
                          )}
                        </td>
                        <NumericStockCell
                          quantity={variant.available}
                          unit={variant.inventoryUnit}
                        />
                        <NumericStockCell
                          quantity={variant.reserved}
                          unit={variant.inventoryUnit}
                        />
                        <td className="px-4 py-4 text-right">
                          <p className="font-mono font-semibold tabular-nums text-zinc-950">
                            {formatQuantity(
                              variant.onHand,
                              variant.inventoryUnit,
                            )}
                          </p>
                          {variant.referenceMeasurement && (
                            <p className="mt-1 text-xs text-zinc-500">
                              {quantityFormatter.format(
                                variant.referenceMeasurement.onHand,
                              )}{" "}
                              {formatReferenceUnit(
                                variant.referenceMeasurement.unit,
                              )}{" "}
                              reference
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {variant.warehouseSellingPrice !== null ? (
                            <>
                              <p className="font-mono font-medium tabular-nums text-zinc-900">
                                {formatCurrency(variant.warehouseSellingPrice)}
                              </p>
                              <p className="mt-1 text-xs text-zinc-400">
                                per {variant.inventoryUnit}
                              </p>
                            </>
                          ) : (
                            <span className="text-xs font-medium text-amber-700">
                              Not priced
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-semibold tabular-nums text-zinc-900">
                          {variant.sellingStockValue !== null
                            ? formatCurrency(variant.sellingStockValue)
                            : "—"}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={variant.status} />
                          <p className="mt-1.5 text-xs text-zinc-500">
                            {variant.thresholdConfigured
                              ? `Threshold ${quantityFormatter.format(variant.reorderLevel ?? 0)}`
                              : "Threshold not set"}
                          </p>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {variantQuery.isError ? (
            <div className="border-t border-zinc-200 px-5 py-8 text-center">
              <p className="text-sm font-medium text-zinc-800">
                Variant rows could not load
              </p>
              <Button
                className="mt-3"
                onClick={() => variantQuery.refetch()}
                size="sm"
                variant="outline"
              >
                Retry table
              </Button>
            </div>
          ) : variantPage && variantPage.items.length === 0 ? (
            <div className="border-t border-zinc-200 px-5 py-10 text-center">
              <Search className="mx-auto h-6 w-6 text-zinc-400" />
              <p className="mt-3 text-sm font-medium text-zinc-800">
                No variants match these filters
              </p>
              <button
                className="mt-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
                onClick={() => {
                  setSearch("");
                  setFamily("");
                  setStatus("");
                  setConfigurationState("");
                  resetPage();
                }}
                type="button"
              >
                Clear filters
              </button>
            </div>
          ) : null}

          {variantPage && variantPage.total > 0 && (
            <div className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-zinc-500">
                Showing {(variantPage.page - 1) * variantPage.pageSize + 1}–
                {Math.min(
                  variantPage.page * variantPage.pageSize,
                  variantPage.total,
                )}{" "}
                of {variantPage.total} variants
              </p>
              <div className="flex items-center gap-2">
                <Button
                  disabled={variantPage.page <= 1 || variantQuery.isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  size="sm"
                  variant="outline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="min-w-20 text-center font-mono text-xs tabular-nums text-zinc-600">
                  {variantPage.page} / {variantPage.totalPages}
                </span>
                <Button
                  disabled={
                    variantPage.page >= variantPage.totalPages ||
                    variantQuery.isFetching
                  }
                  onClick={() => setPage((current) => current + 1)}
                  size="sm"
                  variant="outline"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryMetric({
  label,
  note,
  value,
  warning = false,
}: {
  label: string;
  note: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="border-b border-zinc-200 p-5 last:border-b-0 sm:border-r sm:nth-[2]:border-r-0 xl:border-b-0 xl:nth-[2]:border-r xl:last:border-r-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-950">
        {value}
      </p>
      <p
        className={`mt-1 text-xs ${warning ? "font-medium text-amber-700" : "text-zinc-500"}`}
      >
        {note}
      </p>
    </div>
  );
}

function Notice({
  actionHref,
  actionLabel,
  description,
  icon: Icon,
  onAction,
  title,
  tone,
}: {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  icon: React.ElementType;
  onAction?: () => void;
  title: string;
  tone: "neutral" | "warning" | "danger";
}) {
  const tones = {
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs leading-5 opacity-85">{description}</p>
          {actionLabel && actionHref && (
            <Link
              className="mt-2 inline-flex text-xs font-semibold underline underline-offset-2"
              href={actionHref}
            >
              {actionLabel}
            </Link>
          )}
          {actionLabel && onAction && (
            <button
              className="mt-2 block text-xs font-semibold underline underline-offset-2"
              onClick={onAction}
              type="button"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuantityCell({
  label,
  quantity,
  strong = false,
  unit,
}: {
  label: string;
  quantity: number;
  strong?: boolean;
  unit: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 md:hidden">{label}</p>
      <p
        className={`font-mono text-sm tabular-nums ${strong ? "font-bold text-zinc-950" : "font-semibold text-zinc-800"}`}
      >
        {formatQuantity(quantity, unit)}
      </p>
    </div>
  );
}

function StatusMetric({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: React.ElementType;
  label: string;
  tone: "success" | "warning" | "danger" | "info";
  value: number;
}) {
  const tones = {
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-red-700",
    info: "text-blue-700",
  };
  return (
    <div className="flex items-center gap-3 border-b border-zinc-200 p-4 last:border-b-0 sm:border-r sm:nth-[2]:border-r-0 xl:border-b-0 xl:nth-[2]:border-r xl:last:border-r-0">
      <Icon className={`h-5 w-5 ${tones[tone]}`} />
      <div>
        <p className="font-mono text-xl font-bold tabular-nums text-zinc-950">
          {quantityFormatter.format(value)}
        </p>
        <p className="text-xs font-medium text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

function NumericStockCell({
  quantity,
  unit,
}: {
  quantity: number;
  unit: string | null;
}) {
  return (
    <td className="px-4 py-4 text-right font-mono font-medium tabular-nums text-zinc-800">
      {formatQuantity(quantity, unit)}
      {!unit && (
        <p className="mt-1 font-sans text-[11px] text-red-600">
          Unit unresolved
        </p>
      )}
    </td>
  );
}
