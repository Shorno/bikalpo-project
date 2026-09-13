"use client";

import { resolveBrandCreationAction } from "@bikalpo-project/db/brand-creation";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Eye,
  Filter,
  Layers,
  PackageSearch,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RequestProductModal } from "@/components/catalog/request-product-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCatalogHierarchy, useFilterOptions } from "@/hooks/use-catalog-api";

const typeVariantMap: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Grocery: "default",
  Electronics: "secondary",
  LPG: "outline",
  Fashion: "secondary",
  Footwear: "outline",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

export default function ProductCatalogPage() {
  const router = useRouter();
  const [selectedTypeId, setSelectedTypeId] = useState<number | undefined>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    number | undefined
  >();
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<
    number | undefined
  >();
  const [selectedCoreProductId, setSelectedCoreProductId] = useState<
    number | undefined
  >();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 400);

  const { data: filterData, isLoading: filtersLoading } = useFilterOptions();
  const {
    data,
    isLoading: loadingCatalog,
    isError: catalogError,
    error: catalogErrorMsg,
    refetch,
  } = useCatalogHierarchy({
    typeId: selectedTypeId,
    categoryId: selectedCategoryId,
    subCategoryId: selectedSubCategoryId,
    coreProductId: selectedCoreProductId,
    search: debouncedSearch || undefined,
    page,
    limit: 20,
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const types = filterData?.types ?? [];
  const allCategories = filterData?.categories ?? [];
  const allSubCategories = filterData?.subCategories ?? [];
  const allCoreProducts = filterData?.coreProducts ?? [];

  const categories = selectedTypeId
    ? allCategories.filter((category) => category.typeId === selectedTypeId)
    : allCategories;

  const subCategories = selectedCategoryId
    ? allSubCategories.filter(
        (subCategory) => subCategory.categoryId === selectedCategoryId,
      )
    : [];

  const coreIdentityOptions = useMemo(() => {
    const categoryIds = new Set(categories.map((category) => category.id));

    return allCoreProducts.filter((coreProduct) => {
      if (selectedSubCategoryId) {
        return coreProduct.subCategoryId === selectedSubCategoryId;
      }
      if (selectedCategoryId) {
        return coreProduct.categoryId === selectedCategoryId;
      }
      if (selectedTypeId) {
        return categoryIds.has(coreProduct.categoryId);
      }
      return true;
    });
  }, [
    allCoreProducts,
    categories,
    selectedCategoryId,
    selectedSubCategoryId,
    selectedTypeId,
  ]);

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground">
            <div className="rounded-xl bg-emerald-100 p-2">
              <Layers className="text-emerald-600" size={22} />
            </div>
            Product Catalog
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              className="w-64 pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/product-catalog/requests")}
            className="gap-1.5"
          >
            <Clock size={14} />
            <span className="hidden md:inline">Requests</span>
          </Button>
          <RequestProductModal
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus size={14} />
                <span className="hidden md:inline">Request Product</span>
              </Button>
            }
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Filter By
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Type
            </Label>
            <Select
              value={selectedTypeId?.toString() ?? "all"}
              onValueChange={(value) => {
                setSelectedTypeId(value === "all" ? undefined : Number(value));
                setSelectedCategoryId(undefined);
                setSelectedSubCategoryId(undefined);
                setSelectedCoreProductId(undefined);
                resetPage();
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {types.map((type) => (
                  <SelectItem key={type.id} value={type.id.toString()}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Category
            </Label>
            <Select
              value={selectedCategoryId?.toString() ?? "all"}
              onValueChange={(value) => {
                setSelectedCategoryId(
                  value === "all" ? undefined : Number(value),
                );
                setSelectedSubCategoryId(undefined);
                setSelectedCoreProductId(undefined);
                resetPage();
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Sub Category
            </Label>
            <Select
              value={selectedSubCategoryId?.toString() ?? "all"}
              onValueChange={(value) => {
                setSelectedSubCategoryId(
                  value === "all" ? undefined : Number(value),
                );
                setSelectedCoreProductId(undefined);
                resetPage();
              }}
              disabled={!selectedCategoryId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Sub Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sub Categories</SelectItem>
                {subCategories.map((subCategory) => (
                  <SelectItem
                    key={subCategory.id}
                    value={subCategory.id.toString()}
                  >
                    {subCategory.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Core Identity
            </Label>
            <Select
              value={selectedCoreProductId?.toString() ?? "all"}
              onValueChange={(value) => {
                setSelectedCoreProductId(
                  value === "all" ? undefined : Number(value),
                );
                resetPage();
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Core Identities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Core Identities</SelectItem>
                {coreIdentityOptions.map((coreProduct) => (
                  <SelectItem
                    key={coreProduct.id}
                    value={coreProduct.id.toString()}
                  >
                    {coreProduct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loadingCatalog || filtersLoading ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-20">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-3 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm text-muted-foreground">Loading catalog...</p>
        </div>
      ) : catalogError ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-red-200 bg-red-50/50 py-20">
          <AlertCircle className="mb-4 text-red-400" size={40} />
          <p className="font-semibold text-red-600">Failed to load catalog</p>
          <p className="mt-1 text-sm text-red-400">
            {catalogErrorMsg?.message || "Could not connect to the server."}
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="mt-4"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20">
          <PackageSearch className="mb-4 text-muted-foreground/30" size={48} />
          <p className="font-semibold text-muted-foreground">
            No products found
          </p>
          <p className="mt-1 text-sm text-muted-foreground/60">
            {search
              ? "No products match your search. Try different keywords."
              : "No products in the catalog yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {pagination?.totalCount ?? items.length}
              </span>{" "}
              products
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Sub Category</TableHead>
                  <TableHead>Core Identity</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const action = resolveBrandCreationAction({
                    mode: item.brandCreationMode,
                    configuredBrandCount: item.shopBrandCount,
                    addableBrandCount: item.shopAddableBrandCount,
                  });
                  const rowNumber =
                    ((pagination?.page ?? page) - 1) *
                      (pagination?.limit ?? 20) +
                    index +
                    1;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="text-sm font-medium text-muted-foreground">
                          {rowNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            typeVariantMap[item.type?.name ?? ""] || "outline"
                          }
                          className="text-xs"
                        >
                          {item.type?.name ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground">
                          {item.category?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {item.subCategory?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold text-foreground">
                          {item.name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() =>
                              router.push(
                                `/dashboard/product-catalog/${item.id}`,
                              )
                            }
                          >
                            <Eye size={12} />
                            View
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            disabled={action.disabled}
                            onClick={() =>
                              router.push(
                                `/dashboard/product-catalog/add/${item.id}`,
                              )
                            }
                          >
                            {action.kind === "edit_configuration" ? (
                              <Settings size={12} />
                            ) : (
                              <Plus size={12} />
                            )}
                            {action.kind === "add_brands"
                              ? "Add"
                              : action.label}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {pagination?.page ?? page} of {pagination?.totalPages ?? 1}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(1)}
                disabled={page <= 1}
              >
                <ChevronsLeft size={14} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={14} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((current) => current + 1)}
                disabled={page >= (pagination?.totalPages ?? 1)}
              >
                <ChevronRight size={14} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(pagination?.totalPages ?? 1)}
                disabled={page >= (pagination?.totalPages ?? 1)}
              >
                <ChevronsRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div className="shrink-0 rounded-xl bg-amber-100 p-2.5">
          <AlertCircle className="text-amber-600" size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            Can&apos;t find your product?
          </p>
          <p className="mt-0.5 text-xs text-amber-700">
            If your product is not listed, request a new product identity.
          </p>
        </div>
        <RequestProductModal
          trigger={
            <Button
              size="sm"
              className="shrink-0 bg-amber-500 text-white hover:bg-amber-600"
            >
              + Request
            </Button>
          }
        />
      </div>

      <div className="rounded-lg border bg-muted/50 p-5">
        <h3 className="mb-3 text-xs font-bold tracking-wider text-muted-foreground uppercase">
          About This Catalog
        </h3>
        <div className="grid grid-cols-1 gap-4 text-xs text-muted-foreground md:grid-cols-3">
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">📌 Important</p>
            <ul className="list-inside list-disc space-y-1 text-[11px]">
              <li>Core Identity is system-controlled</li>
              <li>New products must be requested</li>
              <li>Duplicate identity not allowed</li>
              <li>SKU is auto-generated &amp; immutable</li>
            </ul>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">✔ What you can do</p>
            <ul className="list-inside list-disc space-y-1 text-[11px]">
              <li>Browse all available products</li>
              <li>Add products to your shop catalog</li>
              <li>Request new product identities</li>
              <li>Track your requests</li>
            </ul>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">
              📚 Product Structure
            </p>
            <p className="text-[11px] leading-relaxed">
              All products follow the hierarchy:
              <br />
              <span className="font-medium text-foreground">
                Type → Category → SubCategory → Core Identity → Variant
              </span>
              <br />
              Each retailer can browse the full catalog and add variants to
              their shop catalog.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
