"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Layers3,
  Package,
  PackagePlus,
  Search,
  Settings2,
  ShoppingBasket,
  Tags,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

const WH = "/warehouse/dashboard";

type StockQuantityGroup = {
  productTypeId: number;
  productTypeName: string;
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

type InventoryCategory = {
  categoryId: number;
  categoryName: string;
  productCount: number;
  brandCount: number;
  sellingStockValue: number;
  unpricedStockVariantCount: number;
  quantityGroups: StockQuantityGroup[];
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
  categories: InventoryCategory[];
  configurationIssueCount: number;
};

type StockListItem = {
  groupKey: string;
  coreProductId: number | null;
  coreProductName: string;
  coreProductSku: string | null;
  productIds: number[];
  totalQty: number;
  stdUnit: string;
  variantCount: number;
  breakdown: Array<{
    packagingType: string;
    label: string;
    qty: number;
    unit: string;
  }>;
  status: "in_stock" | "out_of_stock";
};

type StockListResponse = {
  items: StockListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type CartonTrackingResponse = {
  kpi: {
    totalProducts: number;
    totalCartons: number;
    totalUnits: number;
    activeLocations: number;
  };
};

type ExpiryResponse = {
  stats: {
    totalExpiredBatches: number;
    totalNearExpiryBatches: number;
    totalExpiredQty: number;
    totalNearExpiryQty: number;
    totalLossValue: number;
  };
};

const numberFormatter = new Intl.NumberFormat("en-BD", {
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-BD", {
  maximumFractionDigits: 2,
  notation: "compact",
});

function pluralizeUnit(unit: string, quantity: number) {
  if (quantity === 1) return unit;
  if (["kg", "g", "l", "ml"].includes(unit.toLowerCase())) return unit;
  if (unit.endsWith("s")) return unit;
  if (unit.endsWith("x")) return `${unit}es`;
  return `${unit}s`;
}

function formatQuantity(quantity: number, unit: string) {
  return `${numberFormatter.format(quantity)} ${pluralizeUnit(unit, quantity)}`;
}

function formatCurrency(value: number) {
  return `৳ ${compactCurrencyFormatter.format(value)}`;
}

function formatReferenceUnit(unit: "kg" | "liter") {
  return unit === "kg" ? "KG" : "L";
}

function summarizeGroups(groups: StockQuantityGroup[], limit = 3) {
  if (groups.length === 0) return "No structured stock";
  const summary = groups.slice(0, limit).map((group) => {
    const reference = group.referenceMeasurement;
    return reference
      ? `${numberFormatter.format(reference.available)} ${formatReferenceUnit(reference.unit)}`
      : formatQuantity(group.available, group.inventoryUnit);
  });
  if (groups.length > limit) summary.push(`+${groups.length - limit} more`);
  return summary.join(" + ");
}

function summarizeLooseUnits(groups: StockQuantityGroup[]) {
  const units = new Set<string>();
  for (const group of groups) {
    if (group.referenceMeasurement) {
      units.add(formatReferenceUnit(group.referenceMeasurement.unit));
      continue;
    }
    const unit = group.inventoryUnit.toLowerCase();
    if (unit === "kg") units.add("KG");
    if (unit === "liter" || unit === "litre" || unit === "l") units.add("L");
  }

  if (units.size === 0) return "No loose stock";
  const label = Array.from(units).join(" / ");
  return units.size > 1 ? `Mixed (${label})` : label;
}

function getProductStock(item: StockListItem) {
  if (item.breakdown.length === 0) {
    return formatQuantity(item.totalQty, item.stdUnit);
  }

  return item.breakdown
    .slice(0, 3)
    .map((part) =>
      formatQuantity(
        part.qty,
        part.packagingType === "loose" ? item.stdUnit : part.unit || part.label,
      ),
    )
    .join(" + ");
}

function getStockDetailHref(item: StockListItem) {
  if (item.coreProductId) return `${WH}/stock/core-${item.coreProductId}`;
  return item.productIds[0]
    ? `${WH}/stock/product-${item.productIds[0]}`
    : `${WH}/stock/list`;
}

export default function WarehouseInventoryPage() {
  const { data: session } = authClient.useSession();
  const warehouseName =
    (session?.user as { warehouseName?: string } | undefined)?.warehouseName ??
    "My Warehouse";
  const [search, setSearch] = useState("");
  const [expandedCategoryId, setExpandedCategoryId] = useState<number | null>(
    null,
  );
  const deferredSearch = useDeferredValue(search.trim());

  const dashboardQuery = useQuery({
    queryKey: ["stockOverview", "structuredDashboard", "warehouse"],
    queryFn: () =>
      (orpc.stockOverview as any).getStockDashboardKPI.call({
        ownerType: "warehouse",
      }),
    staleTime: 60_000,
  });

  const cartonQuery = useQuery({
    queryKey: ["warehouse", "getCartonTrackingProducts", "inventoryKPI"],
    queryFn: () =>
      (orpc.warehouse as any).getCartonTrackingProducts.call({
        page: 1,
        pageSize: 1,
      }),
    staleTime: 60_000,
  });

  const expiryQuery = useQuery({
    queryKey: ["warehouse", "getExpiredProducts", "inventoryKPI"],
    queryFn: () =>
      (orpc.warehouse as any).getExpiredProducts.call({ status: "all" }),
    staleTime: 60_000,
  });

  const searchQuery = useQuery({
    queryKey: [
      "stockOverview",
      "stockList",
      "warehouse",
      "inventorySearch",
      deferredSearch,
    ],
    queryFn: () =>
      (orpc.stockOverview as any).getStockList.call({
        ownerType: "warehouse",
        search: deferredSearch,
        page: 1,
        pageSize: 8,
      }),
    enabled: deferredSearch.length > 0,
    staleTime: 30_000,
  });

  const categoryProductsQuery = useQuery({
    queryKey: [
      "stockOverview",
      "stockList",
      "warehouse",
      "inventoryCategoryPreview",
      expandedCategoryId,
    ],
    queryFn: () =>
      (orpc.stockOverview as any).getStockList.call({
        ownerType: "warehouse",
        categoryId: expandedCategoryId,
        status: "in_stock",
        page: 1,
        pageSize: 6,
      }),
    enabled: expandedCategoryId !== null,
    staleTime: 30_000,
  });

  const dashboard = dashboardQuery.data as StructuredStockDashboard | undefined;
  const cartonData = cartonQuery.data as CartonTrackingResponse | undefined;
  const expiryData = expiryQuery.data as ExpiryResponse | undefined;
  const searchData = searchQuery.data as StockListResponse | undefined;
  const categoryProducts = categoryProductsQuery.data as
    | StockListResponse
    | undefined;

  const retryAll = () => {
    void dashboardQuery.refetch();
    void cartonQuery.refetch();
    void expiryQuery.refetch();
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <header className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 bg-[linear-gradient(115deg,#f8fafc_0%,#ffffff_55%,#eff6ff_100%)] p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-600">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-blue-800">
                <Warehouse className="h-3.5 w-3.5" />
                {warehouseName}
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1">
                Today overview
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950 md:text-3xl">
              Inventory Management
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Your warehouse control center for products, stock health, and
              category-level movement.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <QuickAction
              href={`${WH}/catalog/requests`}
              icon={PackagePlus}
              label="Create product"
              primary
            />
            <QuickAction
              href={`${WH}/stock/add`}
              icon={Boxes}
              label="Add stock"
            />
            <QuickAction
              href={`${WH}/stock-adjustment/create`}
              icon={Settings2}
              label="Stock adjustment"
            />
            <QuickAction
              href={`${WH}/carton-tracking`}
              icon={ArrowRightLeft}
              label="Transfer"
            />
          </div>
        </div>
        <div className="border-t border-zinc-200 p-4 lg:px-6">
          <div className="relative max-w-3xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              aria-label="Search warehouse inventory"
              className="h-11 bg-zinc-50 pl-10 pr-24"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product / SKU / carton barcode"
              value={search}
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-zinc-500 hover:text-zinc-900"
                onClick={() => setSearch("")}
                type="button"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {dashboardQuery.isLoading ? (
        <InventorySkeleton />
      ) : dashboardQuery.isError || !dashboard ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-700" />
            <div>
              <h2 className="font-semibold text-red-950">
                Inventory overview could not load
              </h2>
              <p className="mt-1 text-sm text-red-800">
                Your inventory was not changed. Retry to load the latest
                warehouse snapshot.
              </p>
              <Button
                className="mt-4"
                onClick={retryAll}
                size="sm"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      ) : deferredSearch ? (
        <SearchResults
          data={searchData}
          isLoading={searchQuery.isLoading}
          search={deferredSearch}
        />
      ) : (
        <>
          <section
            aria-labelledby="inventory-kpi-heading"
            className="space-y-3"
          >
            <SectionHeading
              eyebrow="Smart summary"
              id="inventory-kpi-heading"
              title="KPI overview"
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                icon={Tags}
                label="Total SKU"
                note="Active configured variants"
                value={numberFormatter.format(dashboard.summary.activeVariants)}
              />
              <Metric
                icon={Package}
                label="Active products"
                note="Brand products in inventory"
                value={numberFormatter.format(dashboard.summary.activeProducts)}
              />
              <Metric
                href={`${WH}/stock`}
                icon={AlertCircle}
                label="Low stock"
                note="Configured thresholds only"
                tone="warning"
                value={numberFormatter.format(dashboard.stockStatus.lowStock)}
              />
              <Metric
                href={`${WH}/stock/expired`}
                icon={Clock3}
                label="Expired batches"
                loading={expiryQuery.isLoading}
                note="Requires expiry tracking"
                tone="danger"
                value={numberFormatter.format(
                  expiryData?.stats.totalExpiredBatches ?? 0,
                )}
              />
              <Metric
                href={`${WH}/carton-tracking`}
                icon={Boxes}
                label="Total cartons"
                loading={cartonQuery.isLoading}
                note="Active tracked cartons"
                value={numberFormatter.format(
                  cartonData?.kpi.totalCartons ?? 0,
                )}
              />
              <Metric
                icon={Layers3}
                label="Loose inventory"
                note="Mixed units kept separate"
                value={summarizeLooseUnits(dashboard.quantityGroups)}
              />
              <Metric
                icon={CircleDollarSign}
                label="Inventory value"
                note={
                  dashboard.summary.unpricedStockVariantCount > 0
                    ? `${dashboard.summary.unpricedStockVariantCount} stocked variants excluded`
                    : "Complete price coverage"
                }
                span
                tone={
                  dashboard.summary.unpricedStockVariantCount > 0
                    ? "warning"
                    : "default"
                }
                value={formatCurrency(dashboard.summary.sellingStockValue)}
              />
            </div>
          </section>

          {(dashboard.summary.unpricedStockVariantCount > 0 ||
            dashboard.stockStatus.missingThreshold > 0 ||
            dashboard.configurationIssueCount > 0) && (
            <section
              aria-label="Inventory configuration notices"
              className="grid gap-3 md:grid-cols-3"
            >
              {dashboard.summary.unpricedStockVariantCount > 0 && (
                <ConfigurationNotice
                  href={`${WH}/pricing`}
                  icon={CircleDollarSign}
                  text={`${dashboard.summary.unpricedStockVariantCount} stocked variants are excluded from inventory valuation.`}
                  title="Warehouse prices missing"
                />
              )}
              {dashboard.stockStatus.missingThreshold > 0 && (
                <ConfigurationNotice
                  href={`${WH}/stock`}
                  icon={Settings2}
                  text={`${dashboard.stockStatus.missingThreshold} variants cannot be classified as low stock yet.`}
                  title="Reorder thresholds missing"
                />
              )}
              {dashboard.configurationIssueCount > 0 && (
                <ConfigurationNotice
                  href={`${WH}/stock`}
                  icon={AlertCircle}
                  text={`${dashboard.configurationIssueCount} variants need an Admin-structured definition.`}
                  title="Admin setup required"
                />
              )}
            </section>
          )}

          <section
            aria-labelledby="category-overview-heading"
            className="space-y-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading
                eyebrow="Dealer-ready view"
                id="category-overview-heading"
                title="Product category overview"
              />
              <p className="text-xs text-zinc-500">
                Expand a category to preview its stock. Open the full list for
                pagination.
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="hidden grid-cols-[1.1fr_0.45fr_0.45fr_1.9fr_42px] gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:grid">
                <span>Category</span>
                <span>Core</span>
                <span>Brands</span>
                <span>Stock summary</span>
                <span />
              </div>
              {dashboard.categories.length === 0 ? (
                <EmptyState text="No inventory categories yet" />
              ) : (
                <div className="divide-y divide-zinc-200">
                  {dashboard.categories.map((category) => {
                    const isExpanded =
                      expandedCategoryId === category.categoryId;
                    return (
                      <div key={category.categoryId}>
                        <button
                          aria-expanded={isExpanded}
                          className="group grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-zinc-50 lg:grid-cols-[1.1fr_0.45fr_0.45fr_1.9fr_42px] lg:items-center lg:gap-4"
                          onClick={() =>
                            setExpandedCategoryId(
                              isExpanded ? null : category.categoryId,
                            )
                          }
                          type="button"
                        >
                          <span>
                            <span className="block font-semibold text-zinc-900">
                              {category.categoryName}
                            </span>
                            {category.unpricedStockVariantCount > 0 && (
                              <span className="mt-0.5 block text-xs text-amber-700">
                                {category.unpricedStockVariantCount} unpriced
                              </span>
                            )}
                          </span>
                          <DataField
                            label="Core"
                            value={numberFormatter.format(
                              category.productCount,
                            )}
                          />
                          <DataField
                            label="Brands"
                            value={numberFormatter.format(category.brandCount)}
                          />
                          <span className="text-sm text-zinc-600">
                            {summarizeGroups(category.quantityGroups)}
                          </span>
                          <span className="justify-self-end rounded-md border border-zinc-200 bg-white p-1.5 text-zinc-500 transition-colors group-hover:border-blue-200 group-hover:text-blue-700">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </span>
                        </button>
                        {isExpanded && (
                          <CategoryPreview
                            category={category}
                            data={categoryProducts}
                            isLoading={categoryProductsQuery.isLoading}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <QuickNavigation />
        </>
      )}
    </div>
  );
}

function SearchResults({
  data,
  isLoading,
  search,
}: {
  data?: StockListResponse;
  isLoading: boolean;
  search: string;
}) {
  return (
    <section aria-live="polite" className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Quick access"
          title={`Results for “${search}”`}
        />
        {!isLoading && (
          <p className="text-sm text-zinc-500">
            {numberFormatter.format(data?.totalCount ?? 0)} matching products
          </p>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data?.items.length ? (
        <EmptyState text="No product or SKU matched your search" />
      ) : (
        <ProductTable items={data.items} />
      )}
    </section>
  );
}

function CategoryPreview({
  category,
  data,
  isLoading,
}: {
  category: InventoryCategory;
  data?: StockListResponse;
  isLoading: boolean;
}) {
  return (
    <div className="border-t border-blue-100 bg-blue-50/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Expanded category
          </p>
          <h3 className="mt-0.5 font-semibold text-zinc-950">
            {category.categoryName} stock preview
          </h3>
          <p className="mt-0.5 text-sm text-zinc-600">
            {summarizeGroups(category.quantityGroups, 6)}
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`${WH}/inventory/category/${category.categoryId}`}>
            View all products <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : !data?.items.length ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          No in-stock products to preview
        </div>
      ) : (
        <ProductTable items={data.items} compact />
      )}
    </div>
  );
}

function ProductTable({
  compact = false,
  items,
}: {
  compact?: boolean;
  items: StockListItem[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="hidden grid-cols-[1.45fr_1fr_0.45fr_40px] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:grid">
        <span>Product name</span>
        <span>Stock</span>
        <span>Status</span>
        <span />
      </div>
      <div className="divide-y divide-zinc-200">
        {items.map((item) => (
          <Link
            className={`group grid gap-3 px-4 transition-colors hover:bg-zinc-50 sm:grid-cols-[1.45fr_1fr_0.45fr_40px] sm:items-center ${compact ? "py-3" : "py-4"}`}
            href={getStockDetailHref(item)}
            key={item.groupKey}
          >
            <span>
              <span className="block font-semibold text-zinc-900">
                {item.coreProductName}
              </span>
              <span className="mt-0.5 block font-mono text-xs text-zinc-500">
                {item.coreProductSku ?? `${item.variantCount} variants`}
              </span>
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-zinc-800">
              {getProductStock(item)}
            </span>
            <StatusDot active={item.status === "in_stock"} />
            <ArrowRight className="hidden h-4 w-4 justify-self-end text-zinc-400 transition-colors group-hover:text-blue-700 sm:block" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function QuickNavigation() {
  const links = [
    {
      href: `${WH}/catalog`,
      icon: ShoppingBasket,
      label: "View product catalog",
      note: "Browse Admin-aligned products",
    },
    {
      href: `${WH}/stock`,
      icon: Package,
      label: "View stock",
      note: "Real-time variant balances",
    },
    {
      href: `${WH}/stock`,
      icon: AlertCircle,
      label: "Check low stock",
      note: "Review configured thresholds",
    },
    {
      href: `${WH}/stock/expired`,
      icon: Clock3,
      label: "Manage expired products",
      note: "Inspect tracked batches",
    },
    {
      href: `${WH}/carton-tracking`,
      icon: Boxes,
      label: "Track carton / drum",
      note: "Locations and transfers",
    },
  ];

  return (
    <nav aria-label="Inventory quick navigation" className="space-y-3">
      <SectionHeading
        eyebrow="Operational shortcuts"
        title="Quick navigation"
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {links.map((item) => (
          <Link
            className="group flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            href={item.href}
            key={item.label}
          >
            <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
              <item.icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-zinc-900 group-hover:text-blue-800">
                {item.label}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-zinc-500">
                {item.note}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function InventorySkeleton() {
  return (
    <div
      aria-label="Loading inventory overview"
      className="space-y-6"
      role="status"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton className="h-32 rounded-xl" key={index} />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  primary = false,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  primary?: boolean;
}) {
  return (
    <Button asChild size="sm" variant={primary ? "default" : "outline"}>
      <Link href={href}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

function Metric({
  href,
  icon: Icon,
  label,
  loading = false,
  note,
  span = false,
  tone = "default",
  value,
}: {
  href?: string;
  icon: React.ElementType;
  label: string;
  loading?: boolean;
  note: string;
  span?: boolean;
  tone?: "default" | "warning" | "danger";
  value: string;
}) {
  const palette = {
    default: "bg-blue-50 text-blue-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  }[tone];

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-24" />
          ) : (
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-950">
              {value}
            </p>
          )}
        </div>
        <span className={`rounded-lg p-2 ${palette}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p
        className={`mt-3 text-xs ${tone === "default" ? "text-zinc-500" : tone === "warning" ? "text-amber-700" : "text-red-700"}`}
      >
        {note}
      </p>
    </>
  );
  const className = `rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all ${span ? "xl:col-span-2" : ""} ${href ? "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md" : ""}`;

  return href ? (
    <Link className={className} href={href}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function SectionHeading({
  eyebrow,
  id,
  title,
}: {
  eyebrow: string;
  id?: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
        {eyebrow}
      </p>
      <h2 className="mt-0.5 text-lg font-bold text-zinc-950" id={id}>
        {title}
      </h2>
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-red-500"}`}
      />
      {active ? "Active" : "Out"}
    </span>
  );
}

function ConfigurationNotice({
  href,
  icon: Icon,
  text,
  title,
}: {
  href: string;
  icon: React.ElementType;
  text: string;
  title: string;
}) {
  return (
    <Link
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:border-amber-300"
      href={href}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <span>
        <span className="block text-sm font-semibold text-zinc-900">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-zinc-600">
          {text}
        </span>
      </span>
      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-zinc-400" />
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="mr-2 text-xs text-zinc-500 lg:hidden">{label}</span>
      <span className="font-mono text-sm font-medium tabular-nums text-zinc-800">
        {value}
      </span>
    </span>
  );
}
