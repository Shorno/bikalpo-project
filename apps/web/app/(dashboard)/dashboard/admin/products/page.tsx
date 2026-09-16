"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  ImageIcon,
  Loader2,
  Package,
  PackagePlus,
  Pencil,
  Search,
  Tags,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
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
import { ADMIN_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

const ALL = "all";
const PAGE_SIZE = 12;

type ProductStatus = "active" | "inactive" | "draft";

type BrandSummary = {
  id: number;
  name: string;
};

type CatalogProduct = {
  id: number;
  name: string;
  slug: string;
  sku?: string | null;
  image?: string | null;
  price?: string | number | null;
  status?: ProductStatus | null;
  visibility?: "public" | "private" | null;
  inStock?: boolean | null;
  createdAt?: string | Date | null;
  categoryId: number;
  category?: {
    id: number;
    name: string;
    slug: string;
  } | null;
  subCategory?: {
    id: number;
    name: string;
  } | null;
  brand?: BrandSummary | null;
  productBrands?: Array<{
    id?: number;
    brandId: number;
    brand?: BrandSummary | null;
  }>;
  variantPrices?: Array<{
    id: number;
    variantOptionId: number;
    brandId?: number | null;
    consumerPrice?: string | number | null;
    isActive?: boolean | null;
    variantOption?: {
      id: number;
      name: string;
      unit?: string | null;
      size?: string | null;
    } | null;
  }>;
  variants?: Array<{
    id: number;
    unitLabel?: string | null;
    variantType?: string | null;
    brandId?: number | null;
    isActive?: boolean | null;
  }>;
};

type FilterOption = {
  value: string;
  label: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function uniqueOptions(options: FilterOption[]) {
  return Array.from(
    new Map(options.map((option) => [option.value, option.label])),
    ([value, label]) => ({ value, label }),
  ).sort((left, right) => left.label.localeCompare(right.label));
}

function getProductBrands(product: CatalogProduct) {
  const brands = new Map<number, BrandSummary>();

  if (product.brand) brands.set(product.brand.id, product.brand);
  for (const link of product.productBrands ?? []) {
    if (link.brand) brands.set(link.brand.id, link.brand);
  }

  return Array.from(brands.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function getVariants(product: CatalogProduct) {
  const configuredPrices = (product.variantPrices ?? [])
    .filter((price) => price.isActive !== false)
    .map((price) => ({
      id: `price-${price.id}`,
      label: price.variantOption?.name?.trim() || "Variant",
      price: price.consumerPrice,
    }));

  if (configuredPrices.length > 0) return configuredPrices;

  return (product.variants ?? [])
    .filter((variant) => variant.isActive !== false)
    .map((variant) => ({
      id: `variant-${variant.id}`,
      label: variant.unitLabel?.trim() || "Variant",
      price: null,
    }));
}

function formatMoney(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  return `৳${amount.toLocaleString("en-BD", {
    maximumFractionDigits: 2,
  })}`;
}

function statusLabel(status: ProductStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClass(status: ProductStatus) {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "draft") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [brandFilter, setBrandFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [page, setPage] = useState(1);

  const productsQuery = useQuery(
    orpc.product.getAdminWebViewProducts.queryOptions({ input: {} }),
  );

  const products = (productsQuery.data?.products ?? []) as CatalogProduct[];

  const categoryOptions = useMemo(
    () =>
      uniqueOptions(
        products.map((product) => ({
          value: String(product.category?.id ?? product.categoryId),
          label: product.category?.name ?? "Uncategorized",
        })),
      ),
    [products],
  );

  const brandOptions = useMemo(
    () =>
      uniqueOptions(
        products.flatMap((product) =>
          getProductBrands(product).map((brand) => ({
            value: String(brand.id),
            label: brand.name,
          })),
        ),
      ),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const searchText = normalize(deferredSearch);

    return products.filter((product) => {
      const brands = getProductBrands(product);
      const variants = getVariants(product);
      const matchesCategory =
        categoryFilter === ALL ||
        String(product.category?.id ?? product.categoryId) === categoryFilter;
      const matchesBrand =
        brandFilter === ALL ||
        brands.some((brand) => String(brand.id) === brandFilter);
      const matchesStatus =
        statusFilter === ALL || (product.status ?? "active") === statusFilter;
      const matchesSearch =
        !searchText ||
        [
          product.name,
          product.sku,
          product.category?.name,
          product.subCategory?.name,
          ...brands.map((brand) => brand.name),
          ...variants.map((variant) => variant.label),
        ]
          .map((value) => normalize(value))
          .join(" ")
          .includes(searchText);

      return matchesCategory && matchesBrand && matchesStatus && matchesSearch;
    });
  }, [brandFilter, categoryFilter, deferredSearch, products, statusFilter]);

  const stats = useMemo(() => {
    const brandIds = new Set(
      products.flatMap((product) =>
        getProductBrands(product).map((brand) => brand.id),
      ),
    );
    const variantCount = products.reduce(
      (total, product) => total + getVariants(product).length,
      0,
    );

    return {
      products: products.length,
      brands: brandIds.size,
      variants: variantCount,
    };
  }, [products]);

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
    categoryFilter !== ALL ||
    brandFilter !== ALL ||
    statusFilter !== ALL;

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter(ALL);
    setBrandFilter(ALL);
    setStatusFilter(ALL);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <Package className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Product Catalog
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Sellable products with their configured brands and variants.
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
          <CatalogStat label="Products" value={stats.products} />
          <CatalogStat label="Brands" value={stats.brands} />
          <CatalogStat label="Variants" value={stats.variants} />
        </div>
      </header>

      {products.length > 0 ? (
        <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1.5fr)_repeat(3,minmax(10rem,1fr))]">
            <div className="space-y-1.5">
              <Label htmlFor="catalog-search" className="text-xs">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="catalog-search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Product, brand, SKU, or variant"
                  className="pl-9"
                />
              </div>
            </div>
            <FilterSelect
              label="Category"
              value={categoryFilter}
              placeholder="All categories"
              options={categoryOptions}
              onChange={(value) => {
                setCategoryFilter(value);
                setPage(1);
              }}
            />
            <FilterSelect
              label="Brand"
              value={brandFilter}
              placeholder="All brands"
              options={brandOptions}
              onChange={(value) => {
                setBrandFilter(value);
                setPage(1);
              }}
            />
            <FilterSelect
              label="Status"
              value={statusFilter}
              placeholder="All statuses"
              options={[
                { value: "active", label: "Active" },
                { value: "draft", label: "Draft" },
                { value: "inactive", label: "Inactive" },
              ]}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            />
          </div>
          {hasFilters ? (
            <div className="flex justify-end border-t pt-3">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Clear filters
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {productsQuery.isLoading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading products…
          </div>
        ) : productsQuery.isError ? (
          <CatalogError onRetry={() => productsQuery.refetch()} />
        ) : products.length === 0 ? (
          <CatalogEmpty />
        ) : filteredProducts.length === 0 ? (
          <NoResults onClear={clearFilters} />
        ) : (
          <>
            <div className="hidden md:block">
              <ProductTable products={visibleProducts} />
            </div>
            <div className="divide-y md:hidden">
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row">
              <span className="text-muted-foreground">
                Showing {filteredProducts.length.toLocaleString("en-BD")} of{" "}
                {products.length.toLocaleString("en-BD")} products
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
          </>
        )}
      </section>
    </div>
  );
}

function ProductTable({ products }: { products: CatalogProduct[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Product</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Brand</TableHead>
          <TableHead>Variants</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <ProductRow key={product.id} product={product} />
        ))}
      </TableBody>
    </Table>
  );
}

function ProductRow({ product }: { product: CatalogProduct }) {
  const brands = getProductBrands(product);
  const variants = getVariants(product);
  const status = product.status ?? "active";

  return (
    <TableRow>
      <TableCell>
        <div className="flex min-w-56 items-center gap-3">
          <ProductImage product={product} />
          <div className="min-w-0">
            <p className="font-medium">{product.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {product.sku?.trim() || `Product #${product.id}`}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-sm">{product.category?.name ?? "Uncategorized"}</p>
        {product.subCategory ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {product.subCategory.name}
          </p>
        ) : null}
      </TableCell>
      <TableCell>
        <BrandBadges brands={brands} />
      </TableCell>
      <TableCell>
        <VariantSummary variants={variants} fallbackPrice={product.price} />
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <Badge variant="outline" className={statusClass(status)}>
            {statusLabel(status)}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {product.visibility === "private" ? "Private" : "Public"}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <ProductActions product={product} />
      </TableCell>
    </TableRow>
  );
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const brands = getProductBrands(product);
  const variants = getVariants(product);
  const status = product.status ?? "active";

  return (
    <article className="space-y-4 p-4">
      <div className="flex items-start gap-3">
        <ProductImage product={product} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-medium">{product.name}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {product.sku?.trim() || `Product #${product.id}`}
              </p>
            </div>
            <Badge variant="outline" className={statusClass(status)}>
              {statusLabel(status)}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {product.category?.name ?? "Uncategorized"}
            {product.subCategory ? ` · ${product.subCategory.name}` : ""}
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Brand
          </p>
          <BrandBadges brands={brands} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Variants
          </p>
          <VariantSummary variants={variants} fallbackPrice={product.price} />
        </div>
      </div>
      <ProductActions product={product} mobile />
    </article>
  );
}

function ProductImage({ product }: { product: CatalogProduct }) {
  const hasImage = Boolean(product.image?.trim());

  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
      {hasImage ? (
        <Image
          src={product.image ?? ""}
          alt={product.name}
          fill
          sizes="48px"
          className="object-contain"
          unoptimized={product.image?.startsWith("http")}
        />
      ) : (
        <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
      )}
    </div>
  );
}

function BrandBadges({ brands }: { brands: BrandSummary[] }) {
  if (brands.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">Not configured</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {brands.map((brand) => (
        <Badge key={brand.id} variant="secondary" className="font-normal">
          <Tags className="h-3 w-3" />
          {brand.name}
        </Badge>
      ))}
    </div>
  );
}

function VariantSummary({
  variants,
  fallbackPrice,
}: {
  variants: ReturnType<typeof getVariants>;
  fallbackPrice?: string | number | null;
}) {
  if (variants.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">Not configured</span>
    );
  }

  return (
    <div className="flex max-w-72 flex-wrap gap-1.5">
      {variants.slice(0, 3).map((variant) => {
        const price = formatMoney(variant.price ?? fallbackPrice);
        return (
          <Badge key={variant.id} variant="outline" className="font-normal">
            {variant.label}
            {price ? (
              <span className="text-muted-foreground">· {price}</span>
            ) : null}
          </Badge>
        );
      })}
      {variants.length > 3 ? (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          +{variants.length - 3} more
        </Badge>
      ) : null}
    </div>
  );
}

function ProductActions({
  product,
  mobile = false,
}: {
  product: CatalogProduct;
  mobile?: boolean;
}) {
  const brandId = getProductBrands(product)[0]?.id;
  const detailHref = `${ADMIN_BASE}/products/${product.id}${
    brandId ? `?brandId=${brandId}` : ""
  }`;

  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2",
        mobile && "border-t pt-3",
      )}
    >
      <Button variant="outline" size="sm" asChild>
        <Link href={detailHref}>
          <Eye className="h-4 w-4" />
          View
        </Link>
      </Button>
      <Button size="sm" asChild>
        <Link href={`${ADMIN_BASE}/products/${product.id}/edit`}>
          <Pencil className="h-4 w-4" />
          Edit
        </Link>
      </Button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
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

function CatalogEmpty() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <PackagePlus className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-base font-semibold">No products yet</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        The catalog stays empty until a sellable product is created with its
        brand and variant configuration.
      </p>
      <Button asChild className="mt-5">
        <Link href={`${ADMIN_BASE}/products/new`}>
          <PackagePlus className="h-4 w-4" />
          Create Product
        </Link>
      </Button>
    </div>
  );
}

function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
      <Search className="h-7 w-7 text-muted-foreground" />
      <h2 className="mt-3 font-medium">No matching products</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Try another search or clear the current filters.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}

function CatalogError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
      <Package className="h-7 w-7 text-destructive" />
      <h2 className="mt-3 font-medium">Could not load the product catalog</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Please retry the catalog request.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
