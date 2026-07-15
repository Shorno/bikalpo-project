"use client";

import type { ProductTypeFamily } from "@bikalpo-project/db/fulfillment";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  PackagePlus,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Tags,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
type ConfigurationFilter = "all" | "needs_admin_variant_setup";

type StockQuantityGroup = {
  family: ProductTypeFamily;
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
  family: ProductTypeFamily | null;
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
  thresholdSource: "variant" | "product" | null;
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
  const normalized = unit.toLowerCase();
  if (
    quantity === 1 ||
    ["kg", "g", "gram", "l", "ml"].includes(normalized) ||
    normalized.endsWith("s")
  ) {
    return normalized;
  }
  return normalized.endsWith("x") ? `${normalized}es` : `${normalized}s`;
}

function formatQuantity(quantity: number, unit: string | null) {
  const value = quantityFormatter.format(quantity);
  return unit
    ? `${value} ${pluralizeUnit(unit, quantity)}`
    : `${value} unlabelled`;
}

function formatReferenceUnit(unit: "kg" | "liter") {
  return unit === "kg" ? "KG" : "L";
}

function formatCurrency(value: number) {
  return `৳ ${currencyFormatter.format(value)}`;
}

function StatusBadge({ status }: { status: StockStatus }) {
  const values = {
    in_stock: {
      label: "In stock",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    low_stock: {
      label: "Low stock",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    },
    out_of_stock: {
      label: "Out of stock",
      className: "border-red-200 bg-red-50 text-red-700",
    },
  }[status];

  return (
    <Badge variant="outline" className={values.className}>
      {values.label}
    </Badge>
  );
}

export default function RetailerStockPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState<ProductTypeFamily | "all">("all");
  const [status, setStatus] = useState<StockStatus | "all">("all");
  const [configurationState, setConfigurationState] =
    useState<ConfigurationFilter>("all");
  const deferredSearch = useDeferredValue(search.trim());

  const dashboardQuery = useQuery(
    orpc.stockOverview.getStockDashboardKPI.queryOptions({
      input: { ownerType: "shop" },
    }),
  );
  const variantQuery = useQuery({
    ...orpc.stockOverview.getStockDashboardVariants.queryOptions({
      input: {
        ownerType: "shop",
        page,
        pageSize: 25,
        search: deferredSearch || undefined,
        family: family === "all" ? undefined : family,
        status: status === "all" ? undefined : status,
        configurationState:
          configurationState === "all" ? undefined : configurationState,
      },
    }),
    placeholderData: keepPreviousData,
  });

  if (dashboardQuery.isLoading) return <OverviewSkeleton />;

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <main className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 size-5 text-red-700"
            aria-hidden="true"
          />
          <div>
            <h1 className="font-semibold text-red-950">
              Stock overview could not load
            </h1>
            <p className="mt-1 text-sm text-red-800">
              Your balances were not changed. Retry the structured stock
              request.
            </p>
            <Button
              className="mt-4"
              onClick={() => void dashboardQuery.refetch()}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        </div>
      </main>
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
  const filtersActive =
    search.length > 0 ||
    family !== "all" ||
    status !== "all" ||
    configurationState !== "all";

  function resetPage() {
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setFamily("all");
    setStatus("all");
    setConfigurationState("all");
    setPage(1);
  }

  return (
    <main className="space-y-7 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <BarChart3 className="size-3.5" aria-hidden="true" />
            Retail inventory
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Stock overview
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Live balances using the units and measurements defined in Admin
            Variant Setup.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/stock-adjustment/create">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Adjust stock
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/stock/add">
              <PackagePlus className="size-4" aria-hidden="true" />
              Add stock
            </Link>
          </Button>
        </div>
      </header>

      <section
        aria-label="Inventory summary"
        className="grid overflow-hidden rounded-lg border bg-background sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryMetric
          label="Active products"
          note="Brand products held by this retailer"
          value={quantityFormatter.format(dashboard.summary.activeProducts)}
        />
        <SummaryMetric
          label="Active variants"
          note="Exact Admin-configured variants"
          value={quantityFormatter.format(dashboard.summary.activeVariants)}
        />
        <SummaryMetric
          label="Retail stock value"
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
              actionHref="/dashboard/products"
              actionLabel="Review products"
              description={`${dashboard.summary.unpricedStockVariantCount} stocked variants are excluded from retail stock value until a price is set.`}
              icon={CircleDollarSign}
              title="Valuation is incomplete"
              tone="warning"
            />
          )}
          {dashboard.stockStatus.missingThreshold > 0 && (
            <Notice
              description={`${dashboard.stockStatus.missingThreshold} variants have no variant or product reorder threshold, so they are not classified as low stock.`}
              icon={Settings2}
              title="Thresholds need configuration"
              tone="neutral"
            />
          )}
          {dashboard.configurationIssueCount > 0 && (
            <Notice
              actionLabel="Show affected variants"
              description={`${dashboard.configurationIssueCount} active variants could not be resolved from Admin Variant Setup. Legacy labels were not used as a fallback.`}
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
        <div>
          <h2 id="stock-position-heading" className="text-lg font-semibold">
            Stock position
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Quantities remain separated by product family and operational
            inventory unit.
          </p>
        </div>
        {dashboard.quantityGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed px-6 py-10 text-center">
            <Tags
              className="mx-auto size-6 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium">No resolved stock groups</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Receive or add an Admin-configured variant to create a stock
              group.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="hidden grid-cols-[1.4fr_repeat(3,1fr)_1.35fr] gap-4 border-b bg-muted/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <span>Family and unit</span>
              <span>Available</span>
              <span>Reserved</span>
              <span>On hand</span>
              <span>Reference content</span>
            </div>
            <div className="divide-y">
              {dashboard.quantityGroups.map((group) => (
                <div
                  className="grid gap-4 px-4 py-4 sm:px-5 md:grid-cols-[1.4fr_repeat(3,1fr)_1.35fr] md:items-center"
                  key={`${group.family}:${group.inventoryUnit}:${group.referenceMeasurement?.unit ?? "none"}`}
                >
                  <div>
                    <p className="text-sm font-semibold">{group.familyLabel}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {group.variantCount} variants across {group.productCount}{" "}
                      products · {group.inventoryUnit.toLowerCase()}
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
                    <p className="text-xs font-medium text-muted-foreground md:hidden">
                      Reference content
                    </p>
                    {group.referenceMeasurement ? (
                      <>
                        <p className="font-mono text-sm font-semibold tabular-nums">
                          {quantityFormatter.format(
                            group.referenceMeasurement.onHand,
                          )}{" "}
                          {formatReferenceUnit(group.referenceMeasurement.unit)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Capacity reference, not inventory quantity
                        </p>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">
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
          <h2 id="stock-health-heading" className="text-lg font-semibold">
            Stock health
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Status uses available quantity and configured reorder thresholds.
          </p>
        </div>
        <div className="grid overflow-hidden rounded-lg border bg-background sm:grid-cols-2 xl:grid-cols-4">
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
            label="Reserved variants"
            tone="info"
            value={dashboard.stockStatus.reserved}
          />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="variant-stock-heading">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 id="variant-stock-heading" className="text-lg font-semibold">
              Variant stock
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              One row per brand and canonical Admin variant.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(250px,1fr)_170px_170px_auto]">
            <div className="relative sm:col-span-2 xl:col-span-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Search stock variants"
                className="pl-9"
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Search product, brand, SKU"
                type="search"
                value={search}
              />
            </div>
            <Select
              value={family}
              onValueChange={(value) => {
                setFamily(value as ProductTypeFamily | "all");
                resetPage();
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Filter by product family"
              >
                <SelectValue placeholder="All families" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All families</SelectItem>
                {familyOptions.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value as StockStatus | "all");
                resetPage();
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-label="Filter by stock status"
              >
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="in_stock">In stock</SelectItem>
                <SelectItem value="low_stock">Low stock</SelectItem>
                <SelectItem value="out_of_stock">Out of stock</SelectItem>
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="justify-start xl:justify-center"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {configurationState !== "all" && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <span>Showing variants that need Admin Variant Setup.</span>
            <button
              className="font-semibold underline underline-offset-2"
              onClick={() => {
                setConfigurationState("all");
                resetPage();
              }}
              type="button"
            >
              Clear filter
            </button>
          </div>
        )}

        <div className="hidden overflow-hidden rounded-lg border bg-background md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Admin variant</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3 text-right">Reserved</th>
                  <th className="px-4 py-3 text-right">On hand</th>
                  <th className="px-4 py-3 text-right">Retail price</th>
                  <th className="px-4 py-3 text-right">Stock value</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {variantQuery.isLoading && !variantPage
                  ? Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index}>
                        {Array.from({ length: 9 }).map((__, cellIndex) => (
                          <td className="px-4 py-4" key={cellIndex}>
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : variantPage?.items.map((variant) => (
                      <VariantTableRow
                        key={variant.variantId}
                        variant={variant}
                      />
                    ))}
              </tbody>
            </table>
          </div>
          <VariantQueryState
            query={variantQuery}
            variantPage={variantPage}
            clearFilters={clearFilters}
          />
        </div>

        <div className="space-y-3 md:hidden">
          {variantQuery.isLoading && !variantPage
            ? Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-56 w-full rounded-lg" />
              ))
            : variantPage?.items.map((variant) => (
                <VariantMobileCard key={variant.variantId} variant={variant} />
              ))}
          <VariantQueryState
            query={variantQuery}
            variantPage={variantPage}
            clearFilters={clearFilters}
            mobile
          />
        </div>

        {variantPage && variantPage.total > 0 && (
          <nav
            aria-label="Variant stock pagination"
            className="flex flex-col gap-3 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-muted-foreground">
              Showing {(variantPage.page - 1) * variantPage.pageSize + 1} to{" "}
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
                <ArrowLeft className="size-4" aria-hidden="true" />
                Previous
              </Button>
              <span className="min-w-20 text-center font-mono text-xs tabular-nums text-muted-foreground">
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
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </nav>
        )}
      </section>
    </main>
  );
}

function VariantTableRow({ variant }: { variant: StructuredStockVariant }) {
  const valid = variant.configurationState === "valid";
  return (
    <tr className="align-top hover:bg-muted/30">
      <td className="px-4 py-4">
        <p className="font-semibold">{variant.productName}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {variant.brandName ?? "Brand not assigned"}
        </p>
        <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
          {variant.sku ?? "No SKU"}
        </p>
      </td>
      <td className="px-4 py-4">
        {valid ? (
          <>
            <p className="font-medium">{variant.canonicalLabel}</p>
            {variant.displayAlias &&
              variant.displayAlias !== variant.canonicalLabel && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Alias: {variant.displayAlias}
                </p>
              )}
            <p className="mt-1 text-xs text-muted-foreground">
              Inventory unit: {variant.inventoryUnit}
            </p>
          </>
        ) : (
          <div className="max-w-xs">
            <Badge
              variant="outline"
              className="border-slate-300 bg-slate-100 text-slate-700"
            >
              Admin setup required
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">
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
        <p className="font-mono font-semibold tabular-nums">
          {formatQuantity(variant.onHand, variant.inventoryUnit)}
        </p>
        {variant.referenceMeasurement && (
          <p className="mt-1 text-xs text-muted-foreground">
            {quantityFormatter.format(variant.referenceMeasurement.onHand)}{" "}
            {formatReferenceUnit(variant.referenceMeasurement.unit)} reference
          </p>
        )}
      </td>
      <td className="px-4 py-4 text-right">
        {variant.warehouseSellingPrice !== null ? (
          <>
            <p className="font-mono font-medium tabular-nums">
              {formatCurrency(variant.warehouseSellingPrice)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              per {variant.inventoryUnit ?? "unlabelled unit"}
            </p>
          </>
        ) : (
          <span className="text-xs font-medium text-amber-700">Not priced</span>
        )}
      </td>
      <td className="px-4 py-4 text-right font-mono font-semibold tabular-nums">
        {variant.sellingStockValue !== null
          ? formatCurrency(variant.sellingStockValue)
          : "Not available"}
      </td>
      <td className="px-4 py-4">
        {valid ? (
          <StatusBadge status={variant.status} />
        ) : (
          <Badge
            variant="outline"
            className="border-slate-300 bg-slate-100 text-slate-700"
          >
            Setup required
          </Badge>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">
          {variant.thresholdConfigured
            ? `${variant.thresholdSource ?? "Configured"} threshold: ${formatQuantity(variant.reorderLevel ?? 0, variant.inventoryUnit)}`
            : "Threshold not set"}
        </p>
      </td>
      <td className="px-4 py-4 text-right">
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={`/dashboard/products/${variant.productId}`}
            aria-label={`View ${variant.productName}`}
          >
            View
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </td>
    </tr>
  );
}

function VariantMobileCard({ variant }: { variant: StructuredStockVariant }) {
  const valid = variant.configurationState === "valid";
  return (
    <article className="overflow-hidden rounded-lg border bg-background">
      <div className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">
            {variant.productName}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {variant.brandName ?? "Brand not assigned"}
          </p>
          <p className="mt-1 truncate font-mono text-[11px] tabular-nums text-muted-foreground">
            {variant.sku ?? "No SKU"}
          </p>
        </div>
        {valid ? (
          <StatusBadge status={variant.status} />
        ) : (
          <Badge
            variant="outline"
            className="border-slate-300 bg-slate-100 text-slate-700"
          >
            Setup required
          </Badge>
        )}
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Admin variant
          </p>
          <p className="mt-1 text-sm font-medium">
            {valid ? variant.canonicalLabel : "Admin setup required"}
          </p>
          {valid && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Inventory unit: {variant.inventoryUnit}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-3 rounded-md bg-muted/30 p-3">
          <MobileMetric
            label="Available"
            value={formatQuantity(variant.available, variant.inventoryUnit)}
          />
          <MobileMetric
            label="Reserved"
            value={formatQuantity(variant.reserved, variant.inventoryUnit)}
          />
          <MobileMetric
            label="On hand"
            value={formatQuantity(variant.onHand, variant.inventoryUnit)}
          />
        </dl>
        <div className="grid grid-cols-2 gap-3">
          <MobileMetric
            label="Retail price"
            value={
              variant.warehouseSellingPrice === null
                ? "Not priced"
                : formatCurrency(variant.warehouseSellingPrice)
            }
          />
          <MobileMetric
            label="Reorder level"
            value={
              variant.reorderLevel === null
                ? "Not configured"
                : formatQuantity(variant.reorderLevel, variant.inventoryUnit)
            }
          />
        </div>
        <Button variant="outline" size="sm" asChild className="w-full">
          <Link href={`/dashboard/products/${variant.productId}`}>
            View product details
          </Link>
        </Button>
      </div>
    </article>
  );
}

function VariantQueryState({
  clearFilters,
  mobile = false,
  query,
  variantPage,
}: {
  clearFilters: () => void;
  mobile?: boolean;
  query: { isError: boolean; refetch: () => unknown };
  variantPage: VariantPage | undefined;
}) {
  if (query.isError) {
    return (
      <div
        className={`${mobile ? "rounded-lg border" : "border-t"} px-5 py-8 text-center`}
      >
        <p className="text-sm font-medium">Variant rows could not load</p>
        <Button
          className="mt-3"
          onClick={() => void query.refetch()}
          size="sm"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }
  if (variantPage && variantPage.items.length === 0) {
    return (
      <div
        className={`${mobile ? "rounded-lg border" : "border-t"} px-5 py-10 text-center`}
      >
        <Search
          className="mx-auto size-6 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-medium">
          No variants match these filters
        </p>
        <Button variant="link" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      </div>
    );
  }
  return null;
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
    <div className="border-b p-4 last:border-b-0 sm:border-r sm:p-5 sm:nth-[2]:border-r-0 xl:border-b-0 xl:nth-[2]:border-r xl:last:border-r-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums">{value}</p>
      <p
        className={`mt-1 text-xs ${warning ? "font-medium text-amber-700" : "text-muted-foreground"}`}
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
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
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
      <p className="text-xs font-medium text-muted-foreground md:hidden">
        {label}
      </p>
      <p
        className={`font-mono text-sm tabular-nums ${strong ? "font-bold" : "font-semibold"}`}
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
    <div className="flex items-center gap-3 border-b p-4 last:border-b-0 sm:border-r sm:nth-[2]:border-r-0 xl:border-b-0 xl:nth-[2]:border-r xl:last:border-r-0">
      <Icon className={`size-5 ${tones[tone]}`} aria-hidden="true" />
      <div>
        <p className="font-mono text-xl font-bold tabular-nums">
          {quantityFormatter.format(value)}
        </p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
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
    <td className="px-4 py-4 text-right font-mono font-medium tabular-nums">
      {formatQuantity(quantity, unit)}
    </td>
  );
}

function MobileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xs font-medium tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <main
      aria-label="Loading stock overview"
      className="space-y-6"
      role="status"
    >
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid overflow-hidden rounded-lg border sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="space-y-3 border-b p-5 last:border-b-0 sm:border-r xl:border-b-0"
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
    </main>
  );
}
