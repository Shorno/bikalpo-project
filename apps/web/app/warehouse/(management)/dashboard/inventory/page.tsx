"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  CircleDollarSign,
  PackagePlus,
  Settings2,
  Tags,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

const WH = "/warehouse/dashboard";

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
  categories: Array<{
    categoryId: number;
    categoryName: string;
    productCount: number;
    brandCount: number;
    sellingStockValue: number;
    unpricedStockVariantCount: number;
    quantityGroups: StockQuantityGroup[];
  }>;
  configurationIssueCount: number;
};

const numberFormatter = new Intl.NumberFormat("en-BD", {
  maximumFractionDigits: 2,
});

const currencyFormatter = new Intl.NumberFormat("en-BD", {
  maximumFractionDigits: 2,
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
  return `৳ ${currencyFormatter.format(value)}`;
}

function formatReferenceUnit(unit: "kg" | "liter") {
  return unit === "kg" ? "KG" : "L";
}

function summarizeGroups(groups: StockQuantityGroup[]) {
  if (groups.length === 0) return "No structured quantity available";
  return groups
    .slice(0, 3)
    .map((group) => {
      const quantity = formatQuantity(group.available, group.inventoryUnit);
      return group.referenceMeasurement
        ? `${quantity} · ${numberFormatter.format(group.referenceMeasurement.available)} ${formatReferenceUnit(group.referenceMeasurement.unit)}`
        : quantity;
    })
    .join(" + ");
}

export default function WarehouseInventoryPage() {
  const { data: session } = authClient.useSession();
  const warehouseName =
    (session?.user as { warehouseName?: string } | undefined)?.warehouseName ??
    "My Warehouse";

  const dashboardQuery = useQuery({
    queryKey: ["stockOverview", "structuredDashboard", "warehouse"],
    queryFn: () =>
      (orpc.stockOverview as any).getStockDashboardKPI.call({
        ownerType: "warehouse",
      }),
    staleTime: 60_000,
  });

  const dashboard = dashboardQuery.data as StructuredStockDashboard | undefined;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
            <Warehouse className="h-3.5 w-3.5 text-blue-700" />
            {warehouseName}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
            Inventory management
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Warehouse inventory organized by Admin-configured variant units and
            live owner balances.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <QuickAction href={`${WH}/catalog`} icon={Tags} label="Catalog" />
          <QuickAction
            href={`${WH}/stock/add`}
            icon={PackagePlus}
            label="Add stock"
          />
          <QuickAction
            href={`${WH}/stock-adjustment/create`}
            icon={ArrowRightLeft}
            label="Adjustment"
          />
        </div>
      </header>

      {dashboardQuery.isLoading ? (
        <InventorySkeleton />
      ) : dashboardQuery.isError || !dashboard ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-700" />
            <div>
              <h2 className="font-semibold text-red-950">
                Inventory overview could not load
              </h2>
              <p className="mt-1 text-sm text-red-800">
                Live inventory was not changed. Retry the structured dashboard
                request.
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
      ) : (
        <>
          <section
            aria-labelledby="inventory-kpi-heading"
            className="space-y-3"
          >
            <div>
              <h2
                className="text-lg font-semibold text-zinc-950"
                id="inventory-kpi-heading"
              >
                Inventory summary
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Selling value includes available and reserved stock with a
                warehouse price.
              </p>
            </div>
            <div className="grid overflow-hidden rounded-lg border border-zinc-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Active products"
                note="Brand products"
                value={numberFormatter.format(dashboard.summary.activeProducts)}
              />
              <Metric
                label="Active variants"
                note="Exact configured variants"
                value={numberFormatter.format(dashboard.summary.activeVariants)}
              />
              <Metric
                label="Low stock"
                note="Configured thresholds only"
                value={numberFormatter.format(dashboard.stockStatus.lowStock)}
              />
              <Metric
                label="Selling stock value"
                note={
                  dashboard.summary.unpricedStockVariantCount > 0
                    ? `${dashboard.summary.unpricedStockVariantCount} stocked variants unpriced`
                    : "Complete warehouse-price coverage"
                }
                value={formatCurrency(dashboard.summary.sellingStockValue)}
                warning={dashboard.summary.unpricedStockVariantCount > 0}
              />
            </div>
          </section>

          <section
            aria-labelledby="inventory-position-heading"
            className="space-y-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  className="text-lg font-semibold text-zinc-950"
                  id="inventory-position-heading"
                >
                  Quantity groups
                </h2>
                <p className="mt-0.5 text-sm text-zinc-500">
                  Unlike units are shown separately rather than added into a
                  mixed total.
                </p>
              </div>
              <Link
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800"
                href={`${WH}/stock`}
              >
                Open stock overview
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {dashboard.quantityGroups.length === 0 ? (
              <EmptyState text="No structured inventory groups yet" />
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                <div className="hidden grid-cols-[1.3fr_repeat(3,1fr)_1.3fr] gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 md:grid">
                  <span>Family and unit</span>
                  <span>Available</span>
                  <span>Reserved</span>
                  <span>On hand</span>
                  <span>Reference</span>
                </div>
                <div className="divide-y divide-zinc-200">
                  {dashboard.quantityGroups.map((group) => (
                    <div
                      className="grid gap-4 px-5 py-4 md:grid-cols-[1.3fr_repeat(3,1fr)_1.3fr] md:items-center"
                      key={`${group.family}:${group.inventoryUnit}:${group.referenceMeasurement?.unit ?? "none"}`}
                    >
                      <div>
                        <p className="font-semibold text-zinc-900">
                          {group.familyLabel}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {group.variantCount} variants · {group.inventoryUnit}
                        </p>
                      </div>
                      <GroupValue
                        label="Available"
                        value={formatQuantity(
                          group.available,
                          group.inventoryUnit,
                        )}
                      />
                      <GroupValue
                        label="Reserved"
                        value={formatQuantity(
                          group.reserved,
                          group.inventoryUnit,
                        )}
                      />
                      <GroupValue
                        label="On hand"
                        value={formatQuantity(
                          group.onHand,
                          group.inventoryUnit,
                        )}
                        strong
                      />
                      <GroupValue
                        label="Reference"
                        value={
                          group.referenceMeasurement
                            ? `${numberFormatter.format(group.referenceMeasurement.onHand)} ${formatReferenceUnit(group.referenceMeasurement.unit)}`
                            : "Not applicable"
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                  text={`${dashboard.summary.unpricedStockVariantCount} stocked variants are excluded from valuation.`}
                  title="Warehouse prices missing"
                />
              )}
              {dashboard.stockStatus.missingThreshold > 0 && (
                <ConfigurationNotice
                  icon={Settings2}
                  text={`${dashboard.stockStatus.missingThreshold} variants are not eligible for low-stock classification.`}
                  title="Reorder thresholds missing"
                />
              )}
              {dashboard.configurationIssueCount > 0 && (
                <ConfigurationNotice
                  href={`${WH}/stock`}
                  icon={AlertCircle}
                  text={`${dashboard.configurationIssueCount} variants need a structured Admin definition.`}
                  title="Admin setup required"
                />
              )}
            </section>
          )}

          <section
            aria-labelledby="category-overview-heading"
            className="space-y-3"
          >
            <div>
              <h2
                className="text-lg font-semibold text-zinc-950"
                id="category-overview-heading"
              >
                Product categories
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                Counts and quantity summaries come from the same structured
                inventory snapshot.
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="hidden grid-cols-[1.2fr_0.55fr_0.55fr_1.8fr_0.85fr_44px] gap-4 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 lg:grid">
                <span>Category</span>
                <span>Products</span>
                <span>Brands</span>
                <span>Available stock</span>
                <span>Stock value</span>
                <span />
              </div>
              {dashboard.categories.length === 0 ? (
                <EmptyState text="No inventory categories yet" />
              ) : (
                <div className="divide-y divide-zinc-200">
                  {dashboard.categories.map((category) => (
                    <Link
                      aria-label={`View ${category.categoryName} category inventory`}
                      className="group grid gap-3 px-4 py-4 transition-colors hover:bg-zinc-50 lg:grid-cols-[1.2fr_0.55fr_0.55fr_1.8fr_0.85fr_44px] lg:items-center lg:gap-4"
                      href={`${WH}/inventory/category/${category.categoryId}`}
                      key={category.categoryId}
                    >
                      <span className="font-semibold text-zinc-900">
                        {category.categoryName}
                      </span>
                      <DataField
                        label="Products"
                        value={numberFormatter.format(category.productCount)}
                      />
                      <DataField
                        label="Brands"
                        value={numberFormatter.format(category.brandCount)}
                      />
                      <span className="text-sm text-zinc-600">
                        {summarizeGroups(category.quantityGroups)}
                      </span>
                      <span>
                        <span className="font-mono text-sm font-semibold tabular-nums text-zinc-900">
                          {formatCurrency(category.sellingStockValue)}
                        </span>
                        {category.unpricedStockVariantCount > 0 && (
                          <span className="mt-0.5 block text-xs text-amber-700">
                            {category.unpricedStockVariantCount} unpriced
                          </span>
                        )}
                      </span>
                      <span className="justify-self-end text-zinc-400 transition-colors group-hover:text-blue-700">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          <nav
            aria-label="Inventory shortcuts"
            className="flex flex-wrap gap-x-5 gap-y-2 border-t border-zinc-200 pt-5 text-sm"
          >
            <QuickLink href={`${WH}/stock`}>Stock overview</QuickLink>
            <QuickLink href={`${WH}/pricing`}>Warehouse pricing</QuickLink>
            <QuickLink href={`${WH}/stock/list`}>Detailed stock list</QuickLink>
            <QuickLink href={`${WH}/catalog`}>Warehouse catalog</QuickLink>
          </nav>
        </>
      )}
    </div>
  );
}

function InventorySkeleton() {
  return (
    <div
      aria-label="Loading inventory overview"
      className="space-y-6"
      role="status"
    >
      <div className="grid overflow-hidden rounded-lg border border-zinc-200 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="space-y-3 border-b border-zinc-200 p-5 sm:border-r xl:border-b-0"
            key={index}
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
      <Skeleton className="h-44 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
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
    <Button asChild size="sm" variant="outline">
      <Link href={href}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

function Metric({
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
    <div className="border-b border-zinc-200 p-5 last:border-b-0 sm:border-r xl:border-b-0 xl:last:border-r-0">
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

function GroupValue({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 md:hidden">{label}</p>
      <p
        className={`font-mono text-sm tabular-nums ${strong ? "font-bold text-zinc-950" : "font-semibold text-zinc-800"}`}
      >
        {value}
      </p>
    </div>
  );
}

function ConfigurationNotice({
  href,
  icon: Icon,
  text,
  title,
}: {
  href?: string;
  icon: React.ElementType;
  text: string;
  title: string;
}) {
  const content = (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div>
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-600">{text}</p>
      </div>
      {href && (
        <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-zinc-400" />
      )}
    </div>
  );
  return href ? (
    <Link
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 transition-colors hover:border-amber-300"
      href={href}
    >
      {content}
    </Link>
  ) : (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      {content}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-10 text-center text-sm text-zinc-500">{text}</div>;
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

function QuickLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      className="inline-flex items-center gap-1 font-semibold text-zinc-600 hover:text-blue-700"
      href={href}
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}
