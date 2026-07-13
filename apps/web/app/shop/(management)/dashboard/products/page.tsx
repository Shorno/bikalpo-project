"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Box,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit,
  Package,
  PackageOpen,
  PackagePlus,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useFilterOptions } from "@/hooks/use-catalog-api";
import {
  useShopProductDetail,
  useShopProductKPIs,
  useShopProducts,
} from "@/hooks/use-shop-products-api";

// ────────────────────────────────────────────────────────────────
// KPI Card
// ────────────────────────────────────────────────────────────────

function KPICard({
  title,
  count,
  icon: Icon,
  color,
  isActive,
  onClick,
}: {
  title: string;
  count: number;
  icon: React.ElementType;
  color: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isActive ? `ring-2 ring-offset-1 ${color.replace("bg-", "ring-")}` : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{count}</p>
          </div>
          <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
            <Icon className={`h-5 w-5 ${color.replace("bg-", "text-")}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────
// Stock Status Badge
// ────────────────────────────────────────────────────────────────

function StockBadge({ status }: { status: string }) {
  switch (status) {
    case "in_stock":
      return (
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200"
        >
          <CheckCircle2 className="w-3 h-3 mr-1" />
          In Stock
        </Badge>
      );
    case "low":
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200"
        >
          <AlertTriangle className="w-3 h-3 mr-1" />
          Low Stock
        </Badge>
      );
    case "out_of_stock":
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200"
        >
          <XCircle className="w-3 h-3 mr-1" />
          Out of Stock
        </Badge>
      );
    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────────────────

export default function ShopProductsPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [brandId, setBrandId] = useState<number | undefined>();
  const [stockStatus, setStockStatus] = useState<
    "all" | "in_stock" | "low" | "out_of_stock"
  >("all");
  const [page, setPage] = useState(1);
  const [expandedProductId, setExpandedProductId] = useState<number | null>(
    null,
  );

  const { data: kpis, isLoading: kpisLoading } = useShopProductKPIs();
  const { data, isLoading, isError } = useShopProducts({
    search: search || undefined,
    categoryId,
    brandId,
    stockStatus,
    page,
    limit: 20,
  });
  const { data: filterData } = useFilterOptions();

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const categories = filterData?.categories ?? [];
  const brands = filterData?.brands ?? [];

  // Clicking a KPI card sets the stock filter
  const handleKPIClick = (
    status: "all" | "in_stock" | "low" | "out_of_stock",
  ) => {
    setStockStatus(status === stockStatus ? "all" : status);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" />
            Inventory / Products
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Retail Control Panel — Manage your product inventory, stock levels,
            and pricing
          </p>
        </div>
        <Link href="/dashboard/product-catalog">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </Link>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpisLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <KPICard
              title="Total Products"
              count={kpis?.totalProducts ?? 0}
              icon={Package}
              color="bg-blue-500"
              isActive={stockStatus === "all"}
              onClick={() => handleKPIClick("all")}
            />
            <KPICard
              title="In Stock"
              count={kpis?.inStock ?? 0}
              icon={CheckCircle2}
              color="bg-emerald-500"
              isActive={stockStatus === "in_stock"}
              onClick={() => handleKPIClick("in_stock")}
            />
            <KPICard
              title="Low Stock"
              count={kpis?.lowStock ?? 0}
              icon={AlertTriangle}
              color="bg-amber-500"
              isActive={stockStatus === "low"}
              onClick={() => handleKPIClick("low")}
            />
            <KPICard
              title="Out of Stock"
              count={kpis?.outOfStock ?? 0}
              icon={XCircle}
              color="bg-red-500"
              isActive={stockStatus === "out_of_stock"}
              onClick={() => handleKPIClick("out_of_stock")}
            />
          </>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by product name or SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={categoryId?.toString() ?? "all"}
          onValueChange={(v) => {
            setCategoryId(v === "all" ? undefined : Number(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={stockStatus}
          onValueChange={(v) => {
            setStockStatus(v as typeof stockStatus);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Stock Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={brandId?.toString() ?? "all"}
          onValueChange={(v) => {
            setBrandId(v === "all" ? undefined : Number(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {brands.map((b: any) => (
              <SelectItem key={b.id} value={b.id.toString()}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product Table */}
      {isLoading ? (
        <ProductsTableSkeleton />
      ) : isError ? (
        <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
          <XCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Failed to load products</p>
          <p className="text-sm text-gray-400 mt-1">
            Please try refreshing the page.
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
          <PackageOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium text-lg">No products found</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            {search || categoryId || stockStatus !== "all"
              ? "Try adjusting your filters"
              : "Add your first product to get started"}
          </p>
          {!search && !categoryId && stockStatus === "all" && (
            <Link href="/dashboard/product-catalog">
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add First Product
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Variants</TableHead>
                  <TableHead className="text-right">Stock Level</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => {
                  const isExpanded = expandedProductId === item.productId;
                  return (
                    <>
                      <TableRow
                        key={item.productId}
                        className={`cursor-pointer hover:bg-gray-50/80 transition-colors ${isExpanded ? "bg-blue-50/30" : ""}`}
                        onClick={() =>
                          setExpandedProductId(
                            isExpanded ? null : item.productId,
                          )
                        }
                      >
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {(page - 1) * 20 + idx + 1}
                        </TableCell>
                        <TableCell>
                          {item.image ? (
                            <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 border">
                              <Image
                                src={item.image}
                                alt={item.name}
                                width={40}
                                height={40}
                                className="object-cover w-full h-full"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-gray-100 border flex items-center justify-center">
                              <Box className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            )}
                            <div>
                              <span className="font-medium text-gray-900">
                                {item.name}
                              </span>
                              {item.coreProduct && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Core: {item.coreProduct.name}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {item.category?.name ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                            <Package className="w-3.5 h-3.5" />
                            {item.variantCount}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {item.totalStock.toFixed(0)} {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          <StockBadge status={item.stockStatus} />
                        </TableCell>
                      </TableRow>
                      {/* Expandable Product Detail */}
                      {isExpanded && (
                        <TableRow key={`${item.productId}-detail`}>
                          <TableCell colSpan={7} className="p-0 bg-gray-50/60">
                            <ExpandedProductDetail
                              productId={item.productId}
                              productName={item.name}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1}–
                {Math.min(page * 20, pagination.totalCount)} of{" "}
                {pagination.totalCount} products
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= (pagination.totalPages || 1)}
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Alert Panel */}
          {kpis && (kpis.lowStock > 0 || kpis.outOfStock > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Stock Alerts
              </h3>
              <div className="space-y-1 text-sm text-amber-700">
                {kpis.lowStock > 0 && (
                  <p>⚠ {kpis.lowStock} product(s) are running low on stock</p>
                )}
                {kpis.outOfStock > 0 && (
                  <p>❌ {kpis.outOfStock} product(s) are out of stock</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Skeleton
// ────────────────────────────────────────────────────────────────

function ProductsTableSkeleton() {
  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">#</TableHead>
            <TableHead className="w-[60px]">Image</TableHead>
            <TableHead>Product Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-center">Variants</TableHead>
            <TableHead className="text-right">Stock Level</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-5" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-10 w-10 rounded-md" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-full" />
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="h-4 w-6 mx-auto" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-4 w-16 ml-auto" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-5 w-20 ml-auto rounded-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Expanded Product Detail (Variant Stock Breakdown)
// ────────────────────────────────────────────────────────────────

function VariantStockBadge({ status }: { status: string }) {
  switch (status) {
    case "in_stock":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> OK
        </span>
      );
    case "low":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          <AlertTriangle className="w-3 h-3" /> Low
        </span>
      );
    case "out_of_stock":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
          <XCircle className="w-3 h-3" /> Out
        </span>
      );
    default:
      return null;
  }
}

function ExpandedProductDetail({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const { data, isLoading } = useShopProductDetail(productId);

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Could not load product details.
      </div>
    );
  }

  const { product, variants, totalStock } = data;

  return (
    <div className="border-t border-gray-200">
      {/* Product Overview Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              📦 Product Overview
            </p>
            <p className="text-sm text-gray-700 mt-0.5">
              Category:{" "}
              <span className="font-medium">
                {product.category?.name ?? "—"}
              </span>
              {" · "}Total Variants:{" "}
              <span className="font-medium">{variants.length}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Total Stock</p>
            <p className="text-lg font-bold text-gray-900">{totalStock}</p>
          </div>
        </div>
      </div>

      {/* Variant Stock List */}
      <div className="px-5 py-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          📊 Variant Stock
        </p>
        <div className="space-y-1">
          {variants.map((v) => (
            <div
              key={v.variantId}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-gray-800">
                  {v.brandName ? `${v.brandName}` : "—"}
                  {v.unitLabel ? ` + ${v.unitLabel}` : ""}
                </span>
                {v.sku && (
                  <code className="text-[10px] text-gray-400 font-mono hidden sm:inline">
                    {v.sku}
                  </code>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-mono text-gray-700">
                  {v.availableQty}{" "}
                  {v.weightKg && v.weightKg !== "0" ? "pcs" : "units"}
                </span>
                <VariantStockBadge status={v.stockStatus} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stock Summary */}
      <div className="px-5 py-2 border-t border-gray-100">
        <div className="flex items-center justify-between py-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            📦 Stock Summary
          </span>
          <span className="text-sm font-bold text-gray-900">
            Total Stock → {totalStock} units
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2">
        <Link href={`/dashboard/stock/add`}>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
            <PackagePlus className="h-3.5 w-3.5" />
            Add Stock
          </Button>
        </Link>
        {data.product.isRetailerOwned && (
          <Link href={`/dashboard/products/${productId}/edit`}>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <Edit className="h-3.5 w-3.5" />
              Edit Product
            </Button>
          </Link>
        )}
        <Link href={`/dashboard/products/${productId}`}>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
            <BarChart3 className="h-3.5 w-3.5" />
            View Stock Details
          </Button>
        </Link>
      </div>
    </div>
  );
}
