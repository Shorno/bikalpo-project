"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Box,
  CheckCircle2,
  Package,
  PackageOpen,
  Plus,
  Search,
  ShoppingBag,
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
import { useShopProducts, useShopProductKPIs } from "@/hooks/use-shop-products-api";
import { useFilterOptions } from "@/hooks/use-catalog-api";

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
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          In Stock
        </Badge>
      );
    case "low":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Low Stock
        </Badge>
      );
    case "out_of_stock":
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
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
  const [stockStatus, setStockStatus] = useState<"all" | "in_stock" | "low" | "out_of_stock">("all");
  const [page, setPage] = useState(1);

  const { data: kpis, isLoading: kpisLoading } = useShopProductKPIs();
  const { data, isLoading, isError } = useShopProducts({
    search: search || undefined,
    categoryId,
    stockStatus,
    page,
    limit: 20,
  });
  const { data: filterData } = useFilterOptions();

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const categories = filterData?.categories ?? [];

  // Clicking a KPI card sets the stock filter
  const handleKPIClick = (status: "all" | "in_stock" | "low" | "out_of_stock") => {
    setStockStatus(status === stockStatus ? "all" : status);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-primary" />
            Products
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your retail product inventory and pricing
          </p>
        </div>
        <Link href="/dashboard/products/create">
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
      </div>

      {/* Product Table */}
      {isLoading ? (
        <ProductsTableSkeleton />
      ) : isError ? (
        <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
          <XCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Failed to load products</p>
          <p className="text-sm text-gray-400 mt-1">Please try refreshing the page.</p>
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
            <Link href="/dashboard/products/create">
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
                {items.map((item, idx) => (
                  <TableRow
                    key={item.productId}
                    className="cursor-pointer hover:bg-gray-50/80 transition-colors"
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
                      <Link
                        href={`/dashboard/products/${item.productId}`}
                        className="font-medium text-gray-900 hover:text-primary hover:underline"
                      >
                        {item.name}
                      </Link>
                      {item.coreProduct && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Core: {item.coreProduct.name}
                        </p>
                      )}
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
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, pagination.totalCount)} of{" "}
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
