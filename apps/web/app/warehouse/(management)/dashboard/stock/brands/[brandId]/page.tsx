"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Package,
  Tag,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

type StockStatus = "in_stock" | "low_stock" | "out_of_stock";
type AggregateStockStatus = "in_stock" | "attention" | "out_of_stock";

type QuantityGroup = {
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

type StockStatusSummary = {
  inStock: number;
  lowStock: number;
  outOfStock: number;
  reserved: number;
  missingThreshold: number;
};

type StructuredVariant = {
  productId: number;
  variantId: number;
  productName: string;
  brandName: string | null;
  sku: string | null;
  canonicalLabel: string | null;
  displayAlias: string | null;
  family: string | null;
  movementKind: "direct" | "loose" | "container" | null;
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
  status: StockStatus;
  configurationState: "valid" | "needs_admin_variant_setup";
};

type ProductGroup = {
  key: string;
  productId: number;
  coreProductId: number | null;
  name: string;
  image: string | null;
  productCount: number;
  variantCount: number;
  quantityGroups: QuantityGroup[];
  stockStatus: StockStatusSummary;
  aggregateStatus: AggregateStockStatus;
  configurationIssueCount: number;
  variants: StructuredVariant[];
};

type BrandStockDetail = {
  brand: {
    id: number;
    name: string;
    logo: string | null;
    slug: string;
  };
  summary: {
    productCount: number;
    variantCount: number;
    quantityGroups: QuantityGroup[];
    stockStatus: StockStatusSummary;
    configurationIssueCount: number;
  };
  products: ProductGroup[];
};

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatUnit(unit: string, quantity: number) {
  const normalized = unit.trim();
  const lower = normalized.toLowerCase();
  if (["kg", "g", "ml", "l", "liter", "litre"].includes(lower)) {
    return normalized;
  }
  if (quantity === 1 || normalized.endsWith("s")) return normalized;
  if (normalized.endsWith("x")) return `${normalized}es`;
  return `${normalized}s`;
}

function formatQuantity(value: number, unit: string) {
  return `${formatNumber(value)} ${formatUnit(unit, value)}`;
}

function QuantityGroups({
  groups,
  compact = false,
}: {
  groups: QuantityGroup[];
  compact?: boolean;
}) {
  if (groups.length === 0) {
    return (
      <span className="text-xs font-medium text-amber-700">
        Admin variant setup required
      </span>
    );
  }

  return (
    <div className={compact ? "space-y-0.5" : "space-y-1"}>
      {groups.map((group) => {
        const key = `${group.productTypeId}:${group.inventoryUnit}:${group.referenceMeasurement?.unit ?? "none"}`;
        return (
          <div key={key}>
            <div
              className={`${compact ? "text-sm" : "text-xl"} font-bold tabular-nums text-gray-900`}
            >
              {groups.length > 1 && (
                <span className="mr-1 font-medium text-gray-500">
                  {group.productTypeName}:
                </span>
              )}
              {formatQuantity(group.onHand, group.inventoryUnit)}
            </div>
            {group.referenceMeasurement && (
              <div className="text-[11px] font-normal text-gray-400 tabular-nums">
                {formatNumber(group.referenceMeasurement.onHand)}{" "}
                {group.referenceMeasurement.unit.toUpperCase()} reference
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VariantStatusBadge({ status }: { status: StockStatus }) {
  const styles = {
    in_stock: {
      label: "In stock",
      className: "text-emerald-700",
      dot: "bg-emerald-500",
    },
    low_stock: {
      label: "Low stock",
      className: "text-amber-700",
      dot: "bg-amber-500",
    },
    out_of_stock: {
      label: "Out of stock",
      className: "text-red-600",
      dot: "bg-red-500",
    },
  } as const;
  const style = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${style.className}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

function AggregateStatusBadge({ status }: { status: AggregateStockStatus }) {
  const styles = {
    in_stock: {
      label: "OK",
      className: "text-emerald-700",
      dot: "bg-emerald-500",
    },
    attention: {
      label: "Attention",
      className: "text-amber-700",
      dot: "bg-amber-500",
    },
    out_of_stock: {
      label: "Out",
      className: "text-red-600",
      dot: "bg-red-500",
    },
  } as const;
  const style = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${style.className}`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

function BrandDetailSkeleton() {
  return (
    <div className="max-w-5xl space-y-4" aria-busy="true">
      <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex gap-4">
          <div className="h-14 w-14 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-12 animate-pulse rounded bg-slate-100"
            />
          ))}
        </div>
      </div>
      <div className="h-56 animate-pulse rounded-lg border bg-slate-50" />
    </div>
  );
}

export default function BrandStockDetailPage() {
  const params = useParams();
  const brandId = Number.parseInt(params.brandId as string, 10);
  const invalidBrandId = !Number.isInteger(brandId) || brandId <= 0;
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    new Set(),
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stockOverview", "brandStockDetail", "warehouse", brandId],
    queryFn: () =>
      orpc.stockOverview.getBrandStockDetail.call({
        ownerType: "warehouse",
        brandId,
      }),
    enabled: !invalidBrandId,
  });

  const detail = data as BrandStockDetail | undefined;

  const toggleProduct = (key: string) => {
    setExpandedProducts((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (isLoading) return <BrandDetailSkeleton />;

  if (invalidBrandId || isError || !detail) {
    return (
      <div className="max-w-5xl space-y-4">
        <Link
          href="/warehouse/dashboard/stock/brands"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft size={14} />
          Back to Brands
        </Link>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-gray-50/50 py-16">
          <Tag className="mb-3 text-gray-300" size={48} />
          <p className="text-lg font-medium text-gray-500">
            {invalidBrandId ? "Brand not found" : "Brand stock unavailable"}
          </p>
          {!invalidBrandId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refetch()}
            >
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  const { brand, products, summary } = detail;

  return (
    <div className="max-w-5xl space-y-6">
      <Link
        href="/warehouse/dashboard/stock/brands"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        <ArrowLeft size={14} />
        Back to Brands
      </Link>

      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5">
        <div className="mb-4 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
            {brand.logo ? (
              <Image
                src={brand.logo}
                alt={brand.name}
                width={56}
                height={56}
                className="h-14 w-14 object-cover"
                unoptimized={brand.logo.startsWith("http")}
              />
            ) : (
              <Tag size={24} className="text-gray-400" />
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            🏷️ Brand: {brand.name}
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-3 sm:grid-cols-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Total SKU
            </div>
            <div className="mt-0.5 text-xl font-bold text-gray-900 tabular-nums">
              {summary.variantCount}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Total Stock
            </div>
            <div className="mt-0.5">
              <QuantityGroups groups={summary.quantityGroups} />
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Low Stock
            </div>
            <div className="mt-0.5 text-xl font-bold tabular-nums">
              <span
                className={
                  summary.stockStatus.lowStock > 0
                    ? "text-amber-600"
                    : "text-gray-900"
                }
              >
                {summary.stockStatus.lowStock}
              </span>{" "}
              <span className="text-sm font-medium text-gray-500">SKU</span>
            </div>
          </div>
        </div>

        {summary.configurationIssueCount > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            <AlertTriangle className="mt-0.5 shrink-0" size={14} />
            {summary.configurationIssueCount} variant
            {summary.configurationIssueCount === 1 ? " needs" : "s need"} Admin
            Variant Setup before its unit can be included in stock totals.
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-600">
          📋 Product List (Under Brand)
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-gray-50/50 py-16">
            <Package className="mb-3 text-gray-300" size={48} />
            <p className="text-lg font-medium text-gray-500">
              No products found for this brand
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200 bg-gray-50">
                  <TableHead className="h-auto w-[30px] py-2.5" />
                  <TableHead className="h-auto py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Product (Core)
                  </TableHead>
                  <TableHead className="h-auto py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Variants
                  </TableHead>
                  <TableHead className="h-auto py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Total Stock
                  </TableHead>
                  <TableHead className="h-auto py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const isExpanded = expandedProducts.has(product.key);
                  return (
                    <Fragment key={product.key}>
                      <TableRow
                        className={`cursor-pointer transition-colors ${isExpanded ? "bg-blue-50/50" : "hover:bg-gray-50/50"}`}
                        onClick={() => toggleProduct(product.key)}
                      >
                        <TableCell className="w-[30px] py-3">
                          <span className="text-gray-400">
                            {isExpanded ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100">
                              {product.image ? (
                                <Image
                                  src={product.image}
                                  alt={product.name}
                                  width={32}
                                  height={32}
                                  className="h-8 w-8 object-cover"
                                  unoptimized={product.image.startsWith("http")}
                                />
                              ) : (
                                <Package size={14} className="text-gray-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900">
                                {product.name}
                              </div>
                              {product.configurationIssueCount > 0 && (
                                <div className="text-[11px] font-medium text-amber-700">
                                  {product.configurationIssueCount}{" "}
                                  configuration issue
                                  {product.configurationIssueCount === 1
                                    ? ""
                                    : "s"}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right text-sm text-gray-600 tabular-nums">
                          {product.variantCount}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <QuantityGroups
                            groups={product.quantityGroups}
                            compact
                          />
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <AggregateStatusBadge
                            status={product.aggregateStatus}
                          />
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-slate-50/80 p-0">
                            <div className="px-8 py-4">
                              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-600">
                                📦 {product.name} ({brand.name})
                              </div>
                              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-gray-50/80">
                                      <TableHead className="h-auto py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                        Variant
                                      </TableHead>
                                      <TableHead className="h-auto py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                        Stock
                                      </TableHead>
                                      <TableHead className="h-auto py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                        Reserved
                                      </TableHead>
                                      <TableHead className="h-auto py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                        Available
                                      </TableHead>
                                      <TableHead className="h-auto py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                        Reference
                                      </TableHead>
                                      <TableHead className="h-auto py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                        Status
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {product.variants.map((variant) => (
                                      <TableRow
                                        key={variant.variantId}
                                        className="hover:bg-gray-50/50"
                                      >
                                        <TableCell className="py-2">
                                          {variant.configurationState ===
                                            "valid" &&
                                          variant.canonicalLabel ? (
                                            <div className="text-sm font-medium text-gray-800">
                                              {variant.canonicalLabel}
                                            </div>
                                          ) : (
                                            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                                              <AlertTriangle size={14} />
                                              Admin variant setup required
                                            </div>
                                          )}
                                          {variant.displayAlias &&
                                            variant.displayAlias !==
                                              variant.canonicalLabel && (
                                              <div className="mt-0.5 text-xs text-gray-400">
                                                {variant.displayAlias}
                                              </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-2 text-right text-sm font-bold text-gray-900 tabular-nums">
                                          {variant.inventoryUnit
                                            ? formatQuantity(
                                                variant.onHand,
                                                variant.inventoryUnit,
                                              )
                                            : formatNumber(variant.onHand)}
                                        </TableCell>
                                        <TableCell className="py-2 text-right text-sm tabular-nums">
                                          <span
                                            className={
                                              variant.reserved > 0
                                                ? "font-semibold text-amber-600"
                                                : "text-gray-400"
                                            }
                                          >
                                            {variant.inventoryUnit
                                              ? formatQuantity(
                                                  variant.reserved,
                                                  variant.inventoryUnit,
                                                )
                                              : formatNumber(variant.reserved)}
                                          </span>
                                        </TableCell>
                                        <TableCell className="py-2 text-right text-sm font-bold tabular-nums">
                                          <span
                                            className={
                                              variant.available <= 0
                                                ? "text-red-600"
                                                : "text-emerald-700"
                                            }
                                          >
                                            {variant.inventoryUnit
                                              ? formatQuantity(
                                                  variant.available,
                                                  variant.inventoryUnit,
                                                )
                                              : formatNumber(variant.available)}
                                          </span>
                                        </TableCell>
                                        <TableCell className="py-2 text-right text-sm text-gray-500 tabular-nums">
                                          {variant.referenceMeasurement
                                            ? `${formatNumber(variant.referenceMeasurement.onHand)} ${variant.referenceMeasurement.unit.toUpperCase()}`
                                            : "—"}
                                        </TableCell>
                                        <TableCell className="py-2 text-center">
                                          <VariantStatusBadge
                                            status={variant.status}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
