"use client";

import { useQuery } from "@tanstack/react-query";
import {
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
import { orpc } from "@/utils/orpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Types ─────────────────────────────────────────────────────

type VariantRow = {
  variantId: number;
  sku: string | null;
  unitLabel: string;
  packType: string | null;
  weightKg: number;
  stock: number;
  reserved: number;
  available: number;
  stockKg: number;
};

type ProductGroup = {
  productId: number;
  coreProductId: number | null;
  coreProductName: string;
  productImage: string | null;
  totalStock: number;
  variants: VariantRow[];
};

// ─── Helpers ───────────────────────────────────────────────────

function StockStatus({ qty }: { qty: number }) {
  if (qty <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
        <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
        Out
      </span>
    );
  }
  if (qty <= 10) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
        <span className="w-2 h-2 bg-amber-500 rounded-full shrink-0" />
        Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
      <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
      OK
    </span>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function BrandStockDetailPage() {
  const params = useParams();
  const brandId = parseInt(params.brandId as string, 10);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    new Set()
  );

  const { data, isLoading } = useQuery({
    queryKey: ["stockOverview", "brandStockDetail", "warehouse", brandId],
    queryFn: () =>
      (orpc.stockOverview as any).getBrandStockDetail.call({
        ownerType: "warehouse",
        brandId,
      }),
    enabled: !isNaN(brandId),
  });

  const brandInfo = data?.brand;
  const products: ProductGroup[] = data?.products ?? [];
  const summary = data?.summary ?? {
    totalSku: 0,
    totalStock: 0,
    lowStockCount: 0,
  };

  const toggleProduct = (key: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Link
          href="/warehouse/dashboard/stock/brands"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Brands
        </Link>
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg bg-gray-50/50">
          <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading brand details…
          </p>
        </div>
      </div>
    );
  }

  if (!brandInfo) {
    return (
      <div className="space-y-4">
        <Link
          href="/warehouse/dashboard/stock/brands"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Brands
        </Link>
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-gray-50/50">
          <Tag className="text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 text-lg font-medium">Brand not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back link */}
      <Link
        href="/warehouse/dashboard/stock/brands"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Brands
      </Link>

      {/* ══════════════════════════════════════════════════════════════
          🏷️ BRAND HEADER
          ══════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="shrink-0 w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
            {brandInfo.logo ? (
              <Image
                src={brandInfo.logo}
                alt={brandInfo.name}
                width={56}
                height={56}
                className="w-14 h-14 object-cover"
                unoptimized={brandInfo.logo.startsWith("http")}
              />
            ) : (
              <Tag size={24} className="text-gray-400" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              🏷️ Brand: {brandInfo.name}
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-gray-100">
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
              Total SKU
            </div>
            <div className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">
              {summary.totalSku}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
              Total Stock
            </div>
            <div className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">
              {summary.totalStock.toLocaleString()}{" "}
              <span className="text-sm font-medium text-gray-500">KG</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">
              Low Stock
            </div>
            <div className="text-xl font-bold tabular-nums mt-0.5">
              <span
                className={
                  summary.lowStockCount > 0
                    ? "text-amber-600"
                    : "text-gray-900"
                }
              >
                {summary.lowStockCount}
              </span>{" "}
              <span className="text-sm font-medium text-gray-500">SKU</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          📋 PRODUCT LIST (UNDER BRAND) — One row per core product
          ══════════════════════════════════════════════════════════════ */}
      <div>
        <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
          📋 Product List (Under Brand)
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-lg bg-gray-50/50">
            <Package className="text-gray-300 mb-3" size={48} />
            <p className="text-gray-500 text-lg font-medium">
              No products found for this brand
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 border-b border-gray-200">
                  <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto w-[30px]" />
                  <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto">
                    Product (Core)
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto text-right">
                    Variants
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto text-right">
                    Total Stock
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto text-center">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const groupKey = product.coreProductId
                    ? `core_${product.coreProductId}`
                    : `product_${product.productId}`;
                  const isExpanded = expandedProducts.has(groupKey);

                  return (
                    <Fragment key={groupKey}>
                      {/* Collapsed row — one per core product */}
                      <TableRow
                        key={groupKey}
                        className={`transition-colors cursor-pointer ${
                          isExpanded
                            ? "bg-blue-50/50 border-l-2 border-l-blue-500"
                            : "hover:bg-gray-50/50"
                        }`}
                        onClick={() => toggleProduct(groupKey)}
                      >
                        <TableCell className="py-3 w-[30px]">
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
                            <div className="shrink-0 w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden">
                              {product.productImage ? (
                                <Image
                                  src={product.productImage}
                                  alt={product.coreProductName}
                                  width={32}
                                  height={32}
                                  className="w-8 h-8 object-cover"
                                  unoptimized={product.productImage.startsWith(
                                    "http"
                                  )}
                                />
                              ) : (
                                <Package
                                  size={14}
                                  className="text-gray-400"
                                />
                              )}
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {product.coreProductName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <span className="text-sm text-gray-600 tabular-nums">
                            {product.variants.length}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <span className="text-sm font-bold text-gray-900 tabular-nums">
                            {product.totalStock.toLocaleString()} KG
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <StockStatus qty={product.totalStock} />
                        </TableCell>
                      </TableRow>

                      {/* ══════════════════════════════════════
                          📦 VARIANT BREAKDOWN (EXPANDED)
                          ══════════════════════════════════════ */}
                      {isExpanded && (
                        <TableRow key={`${groupKey}-detail`}>
                          <TableCell
                            colSpan={5}
                            className="bg-slate-50/80 p-0"
                          >
                            <div className="px-8 py-4">
                              <div className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
                                📦 {product.coreProductName} (
                                {brandInfo.name})
                              </div>
                              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-gray-50/80">
                                      <TableHead className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider py-2 h-auto">
                                        Variant
                                      </TableHead>
                                      <TableHead className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider py-2 h-auto text-right">
                                        Stock
                                      </TableHead>
                                      <TableHead className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider py-2 h-auto text-right">
                                        Reserved
                                      </TableHead>
                                      <TableHead className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider py-2 h-auto text-right">
                                        Available
                                      </TableHead>
                                      <TableHead className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider py-2 h-auto text-right">
                                        In KG
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {product.variants.map((v) => {
                                      const unit = v.packType === "loose" ? "KG" : "Pack";
                                      return (
                                        <TableRow
                                          key={v.variantId}
                                          className="hover:bg-gray-50/50"
                                        >
                                          <TableCell className="py-2 text-sm text-gray-800 font-medium">
                                            {brandInfo.name} + {v.unitLabel}
                                          </TableCell>
                                          <TableCell className="py-2 text-sm font-bold text-gray-900 tabular-nums text-right">
                                            {v.stock.toLocaleString()}{" "}
                                            <span className="text-xs font-normal text-gray-400">{unit}</span>
                                          </TableCell>
                                          <TableCell className="py-2 text-sm tabular-nums text-right">
                                            <span
                                              className={
                                                v.reserved > 0
                                                  ? "text-amber-600 font-semibold"
                                                  : "text-gray-400"
                                              }
                                            >
                                              {v.reserved.toLocaleString()}
                                            </span>
                                          </TableCell>
                                          <TableCell className="py-2 text-sm font-bold tabular-nums text-right">
                                            <span
                                              className={
                                                v.available <= 0
                                                  ? "text-red-600"
                                                  : "text-emerald-700"
                                              }
                                            >
                                              {v.available.toLocaleString()}{" "}
                                              <span className="text-xs font-normal text-gray-400">{unit}</span>
                                            </span>
                                          </TableCell>
                                          <TableCell className="py-2 text-sm tabular-nums text-right text-gray-500">
                                            {v.stockKg.toLocaleString()} KG
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
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
