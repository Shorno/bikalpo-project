"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleOff,
  Edit3,
  PackagePlus,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ElementType, Fragment, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useShopProductDetail,
  useShopProductKPIs,
  useShopProducts,
} from "@/hooks/use-shop-products-api";

type ProductStatus =
  | "in_stock"
  | "attention"
  | "out_of_stock"
  | "setup_required";
type VariantStatus = "in_stock" | "low_stock" | "out_of_stock";
type ProductItem = NonNullable<
  ReturnType<typeof useShopProducts>["data"]
>["items"][number];
type QuantityGroup = ProductItem["quantityGroups"][number];
type ProductDetail = NonNullable<
  ReturnType<typeof useShopProductDetail>["data"]
>;
type ProductVariant = ProductDetail["variants"][number];

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});
const currencyFormatter = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatUnit(unit: string, quantity: number) {
  const label = unit.toLowerCase();
  if (
    quantity === 1 ||
    ["kg", "g", "gram", "l", "ml"].includes(label) ||
    label.endsWith("s")
  ) {
    return label;
  }
  return label.endsWith("x") ? `${label}es` : `${label}s`;
}

function formatQuantity(quantity: number, unit: string) {
  return `${formatNumber(quantity)} ${formatUnit(unit, quantity)}`;
}

function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const content = {
    in_stock: {
      label: "In stock",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    attention: {
      label: "Needs attention",
      icon: AlertTriangle,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    },
    out_of_stock: {
      label: "Out of stock",
      icon: CircleOff,
      className: "border-red-200 bg-red-50 text-red-700",
    },
    setup_required: {
      label: "Setup required",
      icon: Settings2,
      className: "border-slate-300 bg-slate-100 text-slate-700",
    },
  }[status];
  const Icon = content.icon;

  return (
    <Badge variant="outline" className={`gap-1.5 ${content.className}`}>
      <Icon className="size-3" aria-hidden="true" />
      {content.label}
    </Badge>
  );
}

function VariantStatusBadge({ status }: { status: VariantStatus }) {
  const value = {
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
    <Badge variant="outline" className={value.className}>
      {value.label}
    </Badge>
  );
}

function QuantityLines({ groups }: { groups: QuantityGroup[] }) {
  if (groups.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No unit-safe total</span>
    );
  }

  return (
    <div className="space-y-1">
      {groups.map((group) => (
        <div
          key={`${group.productTypeId}:${group.inventoryUnit}:${group.referenceMeasurement?.unit ?? "none"}`}
          className="text-xs"
        >
          <span className="font-mono font-medium tabular-nums text-foreground">
            {formatQuantity(group.available, group.inventoryUnit)}
          </span>
          <span className="text-muted-foreground"> available</span>
          {group.reserved > 0 && (
            <span className="text-muted-foreground">
              {` · ${formatQuantity(group.reserved, group.inventoryUnit)} reserved`}
            </span>
          )}
          {group.referenceMeasurement && (
            <span className="block text-[11px] text-muted-foreground">
              {formatNumber(group.referenceMeasurement.available)}{" "}
              {group.referenceMeasurement.unit}
              {" reference quantity"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: ElementType;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass = {
    default: "text-slate-500",
    warning: "text-amber-700",
    danger: "text-red-700",
  }[tone];

  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3.5 sm:px-5">
      <Icon className={`size-4 shrink-0 ${toneClass}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function ShopProductsPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number>();
  const [brandId, setBrandId] = useState<number>();
  const [stockStatus, setStockStatus] = useState<"all" | ProductStatus>("all");
  const [page, setPage] = useState(1);
  const [expandedProductId, setExpandedProductId] = useState<number | null>(
    null,
  );

  const { data: kpis, isLoading: kpisLoading } = useShopProductKPIs();
  const { data, isLoading, isError, refetch } = useShopProducts({
    search: search || undefined,
    categoryId,
    brandId,
    stockStatus,
    page,
    limit: 20,
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const categories = data?.filterOptions.categories ?? [];
  const brands = data?.filterOptions.brands ?? [];
  const filtersActive = Boolean(
    search || categoryId || brandId || stockStatus !== "all",
  );

  function clearFilters() {
    setSearch("");
    setCategoryId(undefined);
    setBrandId(undefined);
    setStockStatus("all");
    setPage(1);
  }

  function toggleExpanded(productId: number) {
    setExpandedProductId((current) =>
      current === productId ? null : productId,
    );
  }

  return (
    <main className="space-y-5 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Inventory registry
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Products
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Brand products with exact Admin-configured variants and unit-safe
            stock.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/stock/add">
              <PackagePlus className="size-4" aria-hidden="true" />
              Add stock
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/product-catalog">
              <Plus className="size-4" aria-hidden="true" />
              Add product
            </Link>
          </Button>
        </div>
      </header>

      <section
        aria-label="Product inventory summary"
        className="grid overflow-hidden rounded-lg border bg-background sm:grid-cols-2 lg:grid-cols-4 lg:divide-x"
      >
        {kpisLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="space-y-2 border-b p-4 last:border-b-0 sm:p-5 lg:border-b-0"
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))
        ) : (
          <>
            <SummaryMetric
              label="Active products"
              value={kpis?.activeProducts ?? 0}
              icon={Boxes}
            />
            <SummaryMetric
              label="Active variants"
              value={kpis?.activeVariants ?? 0}
              icon={SlidersHorizontal}
            />
            <SummaryMetric
              label="Low-stock variants"
              value={kpis?.lowStockVariants ?? 0}
              icon={AlertTriangle}
              tone="warning"
            />
            <SummaryMetric
              label="Out-of-stock variants"
              value={kpis?.outOfStockVariants ?? 0}
              icon={CircleOff}
              tone="danger"
            />
          </>
        )}
      </section>

      <section aria-label="Product filters" className="space-y-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_190px_190px_auto]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label="Search products"
              placeholder="Search product, brand, variant, or SKU"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={categoryId?.toString() ?? "all"}
            onValueChange={(value) => {
              setCategoryId(value === "all" ? undefined : Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full" aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={brandId?.toString() ?? "all"}
            onValueChange={(value) => {
              setBrandId(value === "all" ? undefined : Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full" aria-label="Filter by brand">
              <SelectValue placeholder="All brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id.toString()}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={stockStatus}
            onValueChange={(value) => {
              setStockStatus(value as "all" | ProductStatus);
              setPage(1);
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
              <SelectItem value="attention">Needs attention</SelectItem>
              <SelectItem value="out_of_stock">Out of stock</SelectItem>
              <SelectItem value="setup_required">Setup required</SelectItem>
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
        {kpis && kpis.configurationIssueCount > 0 && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Settings2 className="size-3.5" aria-hidden="true" />
            {kpis.configurationIssueCount} active variant
            {kpis.configurationIssueCount === 1 ? " needs" : "s need"} Admin
            setup.
          </p>
        )}
      </section>

      {isLoading ? (
        <ProductsSkeleton />
      ) : isError ? (
        <section className="rounded-lg border bg-background px-6 py-14 text-center">
          <CircleOff
            className="mx-auto size-8 text-red-600"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-base font-semibold">
            Products could not be loaded
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Try the request again.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void refetch()}
          >
            Retry
          </Button>
        </section>
      ) : items.length === 0 ? (
        <section className="rounded-lg border bg-background px-6 py-14 text-center">
          <Box
            className="mx-auto size-8 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-base font-semibold">
            {filtersActive
              ? "No products match these filters"
              : "No products configured"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            {filtersActive
              ? "Clear or adjust the filters to see more products."
              : "Choose a product and brand from the catalog to create your first retail product."}
          </p>
          {filtersActive ? (
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : (
            <Button asChild className="mt-4">
              <Link href="/dashboard/product-catalog">
                Open product catalog
              </Link>
            </Button>
          )}
        </section>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border bg-background lg:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-12">
                    <span className="sr-only">Expand</span>
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Classification</TableHead>
                  <TableHead className="w-24 text-center">Variants</TableHead>
                  <TableHead className="min-w-60">Available stock</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead className="w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isExpanded = expandedProductId === item.productId;
                  const panelId = `product-${item.productId}-variants`;
                  return (
                    <Fragment key={item.productId}>
                      <TableRow
                        className={isExpanded ? "bg-blue-50/40" : undefined}
                      >
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.name} variants`}
                            aria-expanded={isExpanded}
                            aria-controls={panelId}
                            onClick={() => toggleExpanded(item.productId)}
                          >
                            {isExpanded ? (
                              <ChevronDown
                                className="size-4"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronRight
                                className="size-4"
                                aria-hidden="true"
                              />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <ProductIdentity item={item} />
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">
                            {item.brand.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.category.name}
                          </p>
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm tabular-nums">
                          {item.variantCount}
                        </TableCell>
                        <TableCell>
                          <QuantityLines groups={item.quantityGroups} />
                        </TableCell>
                        <TableCell>
                          <ProductStatusBadge status={item.aggregateStatus} />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" asChild>
                              <Link
                                href={`/dashboard/products/${item.productId}`}
                                aria-label={`View ${item.name}`}
                              >
                                <ArrowRight
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </Link>
                            </Button>
                            <Button variant="ghost" size="icon-sm" asChild>
                              <Link
                                href={`/dashboard/products/${item.productId}/edit`}
                                aria-label={`Edit ${item.name}`}
                              >
                                <Edit3 className="size-4" aria-hidden="true" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={7} className="bg-slate-50/70 p-0">
                            <ExpandedProductDetail
                              productId={item.productId}
                              panelId={panelId}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 lg:hidden">
            {items.map((item) => {
              const isExpanded = expandedProductId === item.productId;
              const panelId = `mobile-product-${item.productId}-variants`;
              return (
                <article
                  key={item.productId}
                  className="overflow-hidden rounded-lg border bg-background"
                >
                  <div className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <ProductIdentity item={item} />
                      <ProductStatusBadge status={item.aggregateStatus} />
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-4 border-y py-3">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Available
                        </p>
                        <div className="mt-1">
                          <QuantityLines groups={item.quantityGroups} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Variants
                        </p>
                        <p className="mt-1 font-mono text-sm font-medium tabular-nums">
                          {item.variantCount}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        onClick={() => toggleExpanded(item.productId)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                        {isExpanded ? "Hide variants" : "Show variants"}
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/products/${item.productId}`}>
                          View details
                        </Link>
                      </Button>
                    </div>
                  </div>
                  {isExpanded && (
                    <ExpandedProductDetail
                      productId={item.productId}
                      panelId={panelId}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}

      {pagination && pagination.totalPages > 1 && (
        <nav
          aria-label="Product pagination"
          className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-muted-foreground">
            Showing {Math.min((page - 1) * 20 + 1, pagination.totalCount)} to{" "}
            {Math.min(page * 20, pagination.totalCount)} of{" "}
            {pagination.totalCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => value + 1)}
              disabled={page >= pagination.totalPages}
            >
              Next
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </main>
  );
}

function ProductIdentity({ item }: { item: ProductItem }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
        {item.image ? (
          <Image
            src={item.image}
            alt=""
            width={44}
            height={44}
            className="size-full object-cover"
          />
        ) : (
          <Box className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {item.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {item.brand.name} · {item.category.name}
        </p>
        {item.coreProduct?.sku && (
          <p className="mt-0.5 truncate font-mono text-[11px] tabular-nums text-muted-foreground">
            {item.coreProduct.sku}
          </p>
        )}
      </div>
    </div>
  );
}

function ExpandedProductDetail({
  productId,
  panelId,
}: {
  productId: number;
  panelId: string;
}) {
  const { data, isLoading, isError } = useShopProductDetail(productId);

  if (isLoading) {
    return (
      <div id={panelId} className="space-y-2 border-t p-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return (
      <p id={panelId} className="border-t p-4 text-sm text-red-700">
        Variant stock could not be loaded.
      </p>
    );
  }

  return (
    <section
      id={panelId}
      aria-label={`${data.product.name} variants`}
      className="border-t lg:border-t-0"
    >
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Exact variants</h3>
          <p className="text-xs text-muted-foreground">
            Quantities are shown in each variant's operational inventory unit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/stock/add">
              <PackagePlus className="size-3.5" />
              Add stock
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/stock-adjustment/create">
              <SlidersHorizontal className="size-3.5" />
              Adjust stock
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/products/${productId}`}>
              Full details
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Variant / identifiers</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">On hand</TableHead>
              <TableHead className="text-right">Retail price</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.variants.map((variant) => (
              <VariantTableRow key={variant.variantId} variant={variant} />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="divide-y lg:hidden">
        {data.variants.map((variant) => (
          <VariantMobileRow key={variant.variantId} variant={variant} />
        ))}
      </div>
    </section>
  );
}

function VariantTableRow({ variant }: { variant: ProductVariant }) {
  const invalid = variant.configurationState === "needs_admin_variant_setup";
  return (
    <TableRow>
      <TableCell>
        <p className="text-sm font-medium">
          {variant.canonicalLabel ?? "Admin setup required"}
        </p>
        {variant.displayAlias &&
          variant.displayAlias !== variant.canonicalLabel && (
            <p className="text-xs text-muted-foreground">
              Alias: {variant.displayAlias}
            </p>
          )}
        <div className="mt-1 space-y-0.5 font-mono text-[11px] tabular-nums">
          <p className="text-foreground">
            {variant.globalSku ?? "Global SKU pending"}
          </p>
          <p className="text-muted-foreground">
            Local: {variant.localSku ?? variant.sku ?? "Not assigned"}
          </p>
        </div>
      </TableCell>
      {invalid ? (
        <>
          <UnlabelledMetricCell value={variant.available} />
          <UnlabelledMetricCell value={variant.reserved} muted />
          <UnlabelledMetricCell value={variant.onHand} />
          <TableCell className="text-right font-mono text-sm tabular-nums">
            {variant.retailPrice === null
              ? "Not set"
              : currencyFormatter.format(variant.retailPrice)}
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">
            Admin setup required
          </TableCell>
        </>
      ) : (
        <>
          <MetricCell value={variant.available} unit={variant.inventoryUnit} />
          <MetricCell
            value={variant.reserved}
            unit={variant.inventoryUnit}
            muted
          />
          <MetricCell value={variant.onHand} unit={variant.inventoryUnit} />
          <TableCell className="text-right font-mono text-sm tabular-nums">
            {variant.retailPrice === null
              ? "Not set"
              : currencyFormatter.format(variant.retailPrice)}
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">
            {variant.reorderLevel === null
              ? "Not configured"
              : `${formatQuantity(variant.reorderLevel, variant.inventoryUnit ?? "unit")} (${variant.thresholdSource})`}
          </TableCell>
        </>
      )}
      <TableCell className="text-right">
        {invalid ? (
          <ProductStatusBadge status="setup_required" />
        ) : (
          <VariantStatusBadge status={variant.status} />
        )}
      </TableCell>
    </TableRow>
  );
}

function MetricCell({
  value,
  unit,
  muted = false,
}: {
  value: number;
  unit: string | null;
  muted?: boolean;
}) {
  return (
    <TableCell
      className={`text-right font-mono text-sm tabular-nums ${muted ? "text-muted-foreground" : ""}`}
    >
      {formatQuantity(value, unit ?? "unit")}
    </TableCell>
  );
}

function UnlabelledMetricCell({
  value,
  muted = false,
}: {
  value: number;
  muted?: boolean;
}) {
  return (
    <TableCell
      className={`text-right font-mono text-sm tabular-nums ${muted ? "text-muted-foreground" : ""}`}
    >
      {formatNumber(value)} <span className="text-[10px]">unlabelled</span>
    </TableCell>
  );
}

function VariantMobileRow({ variant }: { variant: ProductVariant }) {
  const invalid = variant.configurationState === "needs_admin_variant_setup";
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {variant.canonicalLabel ?? "Admin setup required"}
          </p>
          <div className="mt-1 font-mono text-[11px] tabular-nums">
            <p className="text-foreground">
              {variant.globalSku ?? "Global SKU pending"}
            </p>
            <p className="text-muted-foreground">
              Local: {variant.localSku ?? variant.sku ?? "Not assigned"}
            </p>
          </div>
        </div>
        {invalid ? (
          <ProductStatusBadge status="setup_required" />
        ) : (
          <VariantStatusBadge status={variant.status} />
        )}
      </div>
      {invalid ? (
        <div className="grid grid-cols-3 gap-3 rounded-md bg-background p-3">
          <MobileMetric
            label="Available"
            value={variant.available}
            unit={null}
          />
          <MobileMetric label="Reserved" value={variant.reserved} unit={null} />
          <MobileMetric label="On hand" value={variant.onHand} unit={null} />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 rounded-md bg-background p-3">
          <MobileMetric
            label="Available"
            value={variant.available}
            unit={variant.inventoryUnit}
          />
          <MobileMetric
            label="Reserved"
            value={variant.reserved}
            unit={variant.inventoryUnit}
          />
          <MobileMetric
            label="On hand"
            value={variant.onHand}
            unit={variant.inventoryUnit}
          />
        </div>
      )}
    </div>
  );
}

function MobileMetric({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string | null;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-xs font-medium tabular-nums">
        {unit
          ? formatQuantity(value, unit)
          : `${formatNumber(value)} unlabelled`}
      </p>
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="grid grid-cols-[44px_2fr_1fr_100px_1.3fr_140px_100px] gap-4 border-b bg-muted/40 px-4 py-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-full" />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b p-4 last:border-b-0"
        >
          <Skeleton className="size-9 shrink-0" />
          <Skeleton className="size-11 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  );
}
