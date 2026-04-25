"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Package,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Layers3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CatalogFilterBar } from "@/components/catalog/catalog-filter-bar";
import { RequestProductModal } from "@/components/catalog/request-product-modal";
import { useCatalogHierarchy, useFilterOptions } from "@/hooks/use-catalog-api";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback((v: T) => {
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => setDebounced(v), delay);
    setTimer(t);
  }, [timer, delay]);

  if (value !== debounced && !timer) {
    update(value);
  }

  return debounced;
}

export default function ProductCatalogPage() {
  // Filter state
  const [typeId, setTypeId] = useState<number | undefined>();
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [subCategoryId, setSubCategoryId] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 300);

  // Queries
  const { data: filterData, isLoading: filtersLoading } = useFilterOptions();
  const { data, isLoading, isError } = useCatalogHierarchy({
    typeId,
    categoryId,
    subCategoryId,
    search: debouncedSearch || undefined,
    page,
    limit: 50,
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const types = filterData?.types ?? [];
  const categories = filterData?.categories ?? [];
  const subCategories = filterData?.subCategories ?? [];

  // Group items by type for visual separation
  const groupedByType = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const typeName = item.type?.name ?? "Uncategorized";
      if (!map.has(typeName)) map.set(typeName, []);
      map.get(typeName)!.push(item);
    }
    return map;
  }, [items]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-emerald-600" />
            Product Catalog
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Browse the complete product catalog. Type → Category → Sub Category → Core Identity
          </p>
        </div>
        <RequestProductModal />
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <CatalogFilterBar
          types={types}
          categories={categories}
          subCategories={subCategories}
          selectedTypeId={typeId}
          selectedCategoryId={categoryId}
          selectedSubCategoryId={subCategoryId}
          search={search}
          onTypeChange={(v) => { setTypeId(v); setPage(1); }}
          onCategoryChange={(v) => { setCategoryId(v); setPage(1); }}
          onSubCategoryChange={(v) => { setSubCategoryId(v); setPage(1); }}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          totalCount={pagination?.totalCount ?? 0}
        />
      </div>

      {/* Product Table */}
      {isLoading || filtersLoading ? (
        <CatalogTableSkeleton />
      ) : isError ? (
        <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Failed to load catalog</p>
          <p className="text-sm text-gray-400 mt-1">Please try refreshing the page.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border shadow-sm p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No products found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search
              ? `No results for "${search}". Try different keywords.`
              : "No products match your current filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Grouped Tables */}
          {Array.from(groupedByType.entries()).map(([typeName, typeItems]) => (
            <div key={typeName} className="bg-white rounded-lg border shadow-sm overflow-hidden">
              {/* Type Header */}
              <div className="bg-gradient-to-r from-gray-50 to-white px-4 py-2.5 border-b flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-sm text-gray-700">{typeName}</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {typeItems.length}
                </Badge>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="w-[40px] text-center">#</TableHead>
                    <TableHead className="w-[50px]">Image</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Sub Category</TableHead>
                    <TableHead>Core Identity</TableHead>
                    <TableHead className="w-[100px]">SKU</TableHead>
                    <TableHead className="w-[80px] text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeItems.map((item, idx) => (
                    <TableRow key={item.id} className="group hover:bg-emerald-50/30 transition-colors">
                      <TableCell className="text-center text-xs text-gray-400 font-mono">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={36}
                            height={36}
                            className="rounded object-cover border"
                          />
                        ) : (
                          <div className="w-9 h-9 bg-gray-100 rounded flex items-center justify-center border">
                            <Package className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {item.category?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {item.subCategory?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-sm text-gray-900">
                          {item.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          {item.sku}
                        </code>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={`/dashboard/product-catalog/${item.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
                {" · "}
                {pagination.totalCount} total products
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, pagination.totalPages - 4));
                  const p = start + i;
                  if (p > pagination.totalPages) return null;
                  return (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(p)}
                      className="h-8 w-8 p-0"
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Request CTA */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-800">Can&apos;t find your product?</h3>
          <p className="text-sm text-gray-600 mt-0.5">
            Request a new product identity and it will be added to the catalog after admin review.
          </p>
        </div>
        <RequestProductModal />
      </div>
    </div>
  );
}

function CatalogTableSkeleton() {
  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 border-b">
        <Skeleton className="h-4 w-32" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">#</TableHead>
            <TableHead className="w-[50px]">Image</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Sub Category</TableHead>
            <TableHead>Core Identity</TableHead>
            <TableHead className="w-[100px]">SKU</TableHead>
            <TableHead className="w-[80px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-6" /></TableCell>
              <TableCell><Skeleton className="h-9 w-9 rounded" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-6 w-14 mx-auto" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
