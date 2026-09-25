"use client";

import { resolveBrandCreationAction } from "@bikalpo-project/db/brand-creation";
import {
  AlertCircle,
  Clock,
  Eye,
  Layers3,
  PackageSearch,
  Plus,
  Search,
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
  const [rowsPerPage, setRowsPerPage] = useState(10);
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
    limit: rowsPerPage,
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const types = filterData?.types ?? [];
  const allCategories = filterData?.categories ?? [];
  const allSubCategories = filterData?.subCategories ?? [];
  const allCoreProducts = filterData?.coreProducts ?? [];
  const totalCount = pagination?.totalCount ?? 0;
  const currentPage = pagination?.page ?? page;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const firstRow = totalCount === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const lastRow = Math.min(currentPage * rowsPerPage, totalCount);

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
    <div className="space-y-5">
      <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3.5 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Layers3 aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Product Catalog
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Browse available products and add them to your shop.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x border-t bg-muted/30">
          <CatalogStat label="Products" value={totalCount} />
          <CatalogStat label="Types" value={types.length} />
          <CatalogStat label="Categories" value={allCategories.length} />
        </div>
      </header>

      <section
        aria-label="Product filters"
        className="rounded-xl border bg-card p-4 shadow-sm"
      >
        <div className="relative mb-4 w-full sm:w-2/3">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search products"
            className="h-11 pl-10"
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
            placeholder="Search products..."
            value={search}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
      </section>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          className="gap-1.5"
          onClick={() => router.push("/dashboard/product-catalog/requests")}
          size="sm"
          variant="outline"
        >
          <Clock aria-hidden="true" className="size-4" />
          Requests
        </Button>
        <RequestProductModal
          trigger={
            <Button className="gap-1.5" size="sm">
              <Plus aria-hidden="true" className="size-4" />
              Request Product
            </Button>
          }
        />
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
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table className="min-w-[760px]">
              <TableHeader>
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
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell className="h-52 text-center" colSpan={6}>
                      <div className="flex flex-col items-center">
                        <PackageSearch
                          aria-hidden="true"
                          className="size-8 text-muted-foreground"
                        />
                        <p className="mt-3 font-medium">No products found</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {search
                            ? "No products match your search. Try different keywords."
                            : "No products in the catalog yet."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, index) => {
                    const action = resolveBrandCreationAction({
                      mode: "single",
                      configuredBrandCount: item.shopBrandCount,
                      addableBrandCount: item.shopAddableBrandCount,
                    });
                    const rowNumber =
                      (currentPage - 1) * rowsPerPage + index + 1;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <span className="font-mono text-sm font-medium tabular-nums text-muted-foreground">
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
                              className="gap-1.5"
                              onClick={() =>
                                router.push(
                                  `/dashboard/product-catalog/${item.id}`,
                                )
                              }
                            >
                              <Eye aria-hidden="true" className="size-4" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1.5"
                              disabled={action.disabled}
                              onClick={() =>
                                router.push(
                                  `/dashboard/product-catalog/add/${item.id}`,
                                )
                              }
                            >
                              <Plus aria-hidden="true" className="size-4" />
                              {action.disabled ? action.label : "Add"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <nav
            aria-label="Catalog pagination"
            className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {firstRow}–{lastRow} of {totalCount}
            </p>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Select
                onValueChange={(value) => {
                  setRowsPerPage(Number(value));
                  setPage(1);
                }}
                value={String(rowsPerPage)}
              >
                <SelectTrigger
                  aria-label="Rows per page"
                  className="h-11 w-28 shadow-none sm:h-9"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {[10, 20, 50].map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} rows
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="h-11 sm:h-9"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                variant="outline"
              >
                Previous
              </Button>
              <span className="min-w-16 text-center font-mono text-xs tabular-nums text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                className="h-11 sm:h-9"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                variant="outline"
              >
                Next
              </Button>
            </div>
          </nav>
        </div>
      )}

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

function CatalogStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-3.5 text-center">
      <p className="text-lg font-semibold leading-none tabular-nums">
        {value.toLocaleString("en-BD")}
      </p>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
