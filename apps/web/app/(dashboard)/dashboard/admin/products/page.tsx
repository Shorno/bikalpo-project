"use client";

import { useQuery } from "@tanstack/react-query";
import { Eye, Layers3, Loader2, PackagePlus, Search, X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
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
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

const ALL = "all";
const PAGE_SIZE = 10;

type CatalogProduct = {
  id: number;
  name: string;
  sku?: string | null;
  categoryId: number;
  subCategoryId?: number | null;
  category?: {
    id: number;
    name: string;
    typeId?: number | null;
    type?: {
      id: number;
      name: string;
    } | null;
  } | null;
  subCategory?: {
    id: number;
    name: string;
  } | null;
};

type FilterOption = {
  id: number;
  name: string;
};

function uniqueOptions(items: Array<FilterOption | null | undefined>) {
  const options = new Map<number, string>();
  for (const item of items) {
    if (item) options.set(item.id, item.name);
  }

  return Array.from(options, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function productIdLabel(product: CatalogProduct) {
  return product.sku?.trim() || `#${product.id}`;
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [subCategoryFilter, setSubCategoryFilter] = useState(ALL);
  const [productFilter, setProductFilter] = useState(ALL);
  const [page, setPage] = useState(1);

  const productsQuery = useQuery(
    orpc.product.getAdminWebViewProducts.queryOptions({ input: {} }),
  );
  const products = (productsQuery.data?.products ?? []) as CatalogProduct[];

  const typeOptions = useMemo(
    () => uniqueOptions(products.map((product) => product.category?.type)),
    [products],
  );

  const categoryOptions = useMemo(
    () =>
      uniqueOptions(
        products
          .filter(
            (product) =>
              typeFilter === ALL ||
              String(product.category?.type?.id ?? "") === typeFilter,
          )
          .map((product) => product.category),
      ),
    [products, typeFilter],
  );

  const subCategoryOptions = useMemo(
    () =>
      uniqueOptions(
        products
          .filter(
            (product) =>
              (typeFilter === ALL ||
                String(product.category?.type?.id ?? "") === typeFilter) &&
              (categoryFilter === ALL ||
                String(product.categoryId) === categoryFilter),
          )
          .map((product) => product.subCategory),
      ),
    [categoryFilter, products, typeFilter],
  );

  const productOptions = useMemo(
    () =>
      uniqueOptions(
        products
          .filter(
            (product) =>
              (typeFilter === ALL ||
                String(product.category?.type?.id ?? "") === typeFilter) &&
              (categoryFilter === ALL ||
                String(product.categoryId) === categoryFilter) &&
              (subCategoryFilter === ALL ||
                String(product.subCategoryId ?? "") === subCategoryFilter),
          )
          .map((product) => ({ id: product.id, name: product.name })),
      ),
    [categoryFilter, products, subCategoryFilter, typeFilter],
  );

  const filteredProducts = useMemo(() => {
    const searchText = normalize(deferredSearch);

    return products.filter((product) => {
      const matchesFilters =
        (typeFilter === ALL ||
          String(product.category?.type?.id ?? "") === typeFilter) &&
        (categoryFilter === ALL ||
          String(product.categoryId) === categoryFilter) &&
        (subCategoryFilter === ALL ||
          String(product.subCategoryId ?? "") === subCategoryFilter) &&
        (productFilter === ALL || String(product.id) === productFilter);

      if (!matchesFilters) return false;
      if (!searchText) return true;

      return [
        productIdLabel(product),
        product.name,
        product.category?.type?.name,
        product.category?.name,
        product.subCategory?.name,
      ]
        .map((value) => normalize(value))
        .join(" ")
        .includes(searchText);
    });
  }, [
    categoryFilter,
    deferredSearch,
    productFilter,
    products,
    subCategoryFilter,
    typeFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const visibleProducts = filteredProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const hasFilters =
    search.trim() ||
    typeFilter !== ALL ||
    categoryFilter !== ALL ||
    subCategoryFilter !== ALL ||
    productFilter !== ALL;

  const clearFilters = () => {
    setSearch("");
    setTypeFilter(ALL);
    setCategoryFilter(ALL);
    setSubCategoryFilter(ALL);
    setProductFilter(ALL);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <Layers3 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Product Catalog
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Browse configured products by type, category, and sub category.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={`${ADMIN_BASE}/products/new`}>
              <PackagePlus className="h-4 w-4" />
              Create Product
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-3 divide-x border-t bg-muted/30">
          <CatalogStat label="Products" value={products.length} />
          <CatalogStat label="Types" value={typeOptions.length} />
          <CatalogStat label="Categories" value={categoryOptions.length} />
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
            <div className="space-y-1.5">
              <Label
                htmlFor="product-catalog-search"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="product-catalog-search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Product name or ID…"
                  className="pl-9"
                />
              </div>
            </div>
            <FilterSelect
              label="Type"
              value={typeFilter}
              options={typeOptions}
              onValueChange={(value) => {
                setTypeFilter(value);
                setCategoryFilter(ALL);
                setSubCategoryFilter(ALL);
                setProductFilter(ALL);
                setPage(1);
              }}
            />
            <FilterSelect
              label="Category"
              value={categoryFilter}
              options={categoryOptions}
              onValueChange={(value) => {
                setCategoryFilter(value);
                setSubCategoryFilter(ALL);
                setProductFilter(ALL);
                setPage(1);
              }}
            />
            <FilterSelect
              label="Sub Category"
              value={subCategoryFilter}
              options={subCategoryOptions}
              onValueChange={(value) => {
                setSubCategoryFilter(value);
                setProductFilter(ALL);
                setPage(1);
              }}
            />
            <FilterSelect
              label="Product Name"
              value={productFilter}
              options={productOptions}
              onValueChange={(value) => {
                setProductFilter(value);
                setPage(1);
              }}
            />
          </div>
          {hasFilters ? (
            <div className="mt-3 flex justify-end border-t pt-3">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-36">ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sub Category</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-36 text-center">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading catalog…
                    </span>
                  </TableCell>
                </TableRow>
              ) : productsQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-36 text-center">
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium">Could not load products</p>
                        <p className="text-sm text-muted-foreground">
                          Please retry the catalog request.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => productsQuery.refetch()}
                      >
                        Try again
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-52 text-center">
                    <div className="flex flex-col items-center">
                      <PackagePlus className="h-8 w-8 text-muted-foreground" />
                      <p className="mt-3 font-medium">No products yet</p>
                      <p className="mt-1 max-w-md text-sm text-muted-foreground">
                        Create a product with its brand and variant
                        configuration to add it to the catalog.
                      </p>
                      <Button asChild size="sm" className="mt-4">
                        <Link href={`${ADMIN_BASE}/products/new`}>
                          <PackagePlus className="h-4 w-4" />
                          Create Product
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : visibleProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-36 text-center">
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium">No products found</p>
                        <p className="text-sm text-muted-foreground">
                          Try a different search or filter.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                visibleProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-sm font-medium tabular-nums">
                      {productIdLabel(product)}
                    </TableCell>
                    <TableCell>
                      {product.category?.type?.name || "Unassigned"}
                    </TableCell>
                    <TableCell>
                      {product.category?.name || "Uncategorized"}
                    </TableCell>
                    <TableCell>
                      {product.subCategory?.name || (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" asChild>
                          <Link
                            href={`${ADMIN_BASE}/products/${product.id}/edit`}
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!productsQuery.isLoading &&
        !productsQuery.isError &&
        products.length > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t p-4 text-sm sm:flex-row">
            <span className="text-muted-foreground">
              {filteredProducts.length} of {products.length} products
            </span>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`All ${label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={String(option.id)}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
