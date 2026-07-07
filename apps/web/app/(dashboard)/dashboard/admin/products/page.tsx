"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type Column,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronRight,
  Edit3,
  Eye,
  Layers3,
  Loader2,
  Package,
  Plus,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

type CatalogCoreProduct = {
  id: number;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  image: string;
  categoryId: number;
  subCategoryId: number | null;
  supportsPack?: boolean;
  supportsLoose?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  category: {
    id: number;
    name: string;
    slug: string;
    typeId: number | null;
    type?: {
      id: number;
      name: string;
    } | null;
  };
  subCategory: {
    id: number;
    name: string;
  } | null;
};

type CatalogOptions = {
  brands?: Array<{ id: number; name: string; slug: string }>;
  variantOptions?: Array<{
    id: number;
    name: string;
    unit: string;
    size: string | null;
    variantType: "pack" | "loose";
    typeId: number | null;
    categoryId: number | null;
  }>;
};

type FilterOption = { id: number; name: string };

const ALL = "all";

type EditableProductCandidate = {
  id: number;
  name: string;
  coreProductId?: number | null;
  createdByWarehouseId?: string | null;
  createdAt?: string | Date | null;
  productBrands?: unknown[];
  variantPrices?: Array<{ brandId?: number | null }>;
};

function uniqueOptions(items: Array<FilterOption | null | undefined>) {
  const map = new Map<number, string>();
  for (const item of items) {
    if (item) map.set(item.id, item.name);
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function matchesText(value: string | null | undefined, search: string) {
  return (value ?? "").toLowerCase().includes(search);
}

function normalizeName(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function getCreatedAtTime(value: string | Date | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function hasMultiBrandConfiguration(product: EditableProductCandidate) {
  if ((product.productBrands?.length ?? 0) > 1) return true;

  const variantBrandIds = new Set(
    (product.variantPrices ?? [])
      .map((variantPrice) => variantPrice.brandId)
      .filter((brandId): brandId is number => typeof brandId === "number"),
  );

  return variantBrandIds.size > 1;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getAvailableVariants(
  coreProduct: CatalogCoreProduct,
  variantOptions: CatalogOptions["variantOptions"] = [],
) {
  const typeId = coreProduct.category.typeId;
  const categoryId = coreProduct.categoryId;

  return variantOptions
    .filter((variant) => {
      const isGlobal = variant.typeId == null && variant.categoryId == null;
      const isTypeWide =
        variant.typeId === typeId && variant.categoryId == null;
      const isCategoryScoped =
        variant.typeId === typeId && variant.categoryId === categoryId;
      return isGlobal || isTypeWide || isCategoryScoped;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function sortableHeader(label: string) {
  return function SortableHeader({
    column,
  }: {
    column: Column<CatalogCoreProduct, unknown>;
  }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 data-[state=open]:bg-accent"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {label}
        <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    );
  };
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

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [subCategoryFilter, setSubCategoryFilter] = useState(ALL);
  const [coreFilter, setCoreFilter] = useState(ALL);
  const [selectedProduct, setSelectedProduct] =
    useState<CatalogCoreProduct | null>(null);

  const productsQuery = useQuery(
    orpc.adminCoreProduct.getAll.queryOptions({
      input: {},
    }),
  );

  const optionsQuery = useQuery({
    queryKey: ["adminCatalogApproval", "catalogOptions"],
    queryFn: () => orpc.adminCatalogApproval.getRequestOptions.call({}),
  });

  const coreProducts = (productsQuery.data?.coreProducts ??
    []) as CatalogCoreProduct[];
  const options = optionsQuery.data as CatalogOptions | undefined;

  const typeOptions = useMemo(
    () =>
      uniqueOptions(
        coreProducts.map((product) =>
          product.category.type
            ? {
                id: product.category.type.id,
                name: product.category.type.name,
              }
            : null,
        ),
      ),
    [coreProducts],
  );

  const categoryOptions = useMemo(
    () =>
      uniqueOptions(
        coreProducts
          .filter(
            (product) =>
              typeFilter === ALL ||
              String(product.category.typeId ?? "") === typeFilter,
          )
          .map((product) => product.category),
      ),
    [coreProducts, typeFilter],
  );

  const subCategoryOptions = useMemo(
    () =>
      uniqueOptions(
        coreProducts
          .filter(
            (product) =>
              (typeFilter === ALL ||
                String(product.category.typeId ?? "") === typeFilter) &&
              (categoryFilter === ALL ||
                String(product.categoryId) === categoryFilter),
          )
          .map((product) => product.subCategory),
      ),
    [categoryFilter, coreProducts, typeFilter],
  );

  const coreOptions = useMemo(
    () =>
      uniqueOptions(
        coreProducts
          .filter(
            (product) =>
              (typeFilter === ALL ||
                String(product.category.typeId ?? "") === typeFilter) &&
              (categoryFilter === ALL ||
                String(product.categoryId) === categoryFilter) &&
              (subCategoryFilter === ALL ||
                String(product.subCategoryId ?? "") === subCategoryFilter),
          )
          .map((product) => ({ id: product.id, name: product.name })),
      ),
    [categoryFilter, coreProducts, subCategoryFilter, typeFilter],
  );

  const filteredProducts = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return coreProducts.filter((product) => {
      const productTypeId = String(product.category.typeId ?? "");
      const productSubCategoryId = String(product.subCategoryId ?? "");
      const matchesFilters =
        (typeFilter === ALL || productTypeId === typeFilter) &&
        (categoryFilter === ALL ||
          String(product.categoryId) === categoryFilter) &&
        (subCategoryFilter === ALL ||
          productSubCategoryId === subCategoryFilter) &&
        (coreFilter === ALL || String(product.id) === coreFilter);

      if (!matchesFilters) return false;
      if (!searchText) return true;

      return (
        matchesText(product.name, searchText) ||
        matchesText(product.sku, searchText) ||
        matchesText(product.category.name, searchText) ||
        matchesText(product.subCategory?.name, searchText) ||
        matchesText(product.category.type?.name, searchText)
      );
    });
  }, [
    categoryFilter,
    coreFilter,
    coreProducts,
    search,
    subCategoryFilter,
    typeFilter,
  ]);

  const isLoading = productsQuery.isLoading || optionsQuery.isLoading;

  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<CatalogCoreProduct>[]>(
    () => [
      {
        id: "index",
        header: () => <span className="pl-1 text-muted-foreground">#</span>,
        enableSorting: false,
        cell: ({ row, table }) => {
          const seq =
            table.getSortedRowModel().rows.findIndex((r) => r.id === row.id) + 1;
          return (
            <span className="pl-1 tabular-nums text-muted-foreground">
              {seq}
            </span>
          );
        },
        size: 48,
      },
      {
        id: "type",
        accessorFn: (product) => product.category.type?.name ?? "",
        header: sortableHeader("Type"),
        cell: ({ row }) => (
          <Badge variant="outline">
            {row.original.category.type?.name || "Unassigned"}
          </Badge>
        ),
      },
      {
        id: "category",
        accessorFn: (product) => product.category.name,
        header: sortableHeader("Category"),
        cell: ({ row }) => row.original.category.name,
      },
      {
        id: "subCategory",
        accessorFn: (product) => product.subCategory?.name ?? "",
        header: sortableHeader("Sub Category"),
        cell: ({ row }) =>
          row.original.subCategory?.name || (
            <span className="text-muted-foreground">None</span>
          ),
      },
      {
        id: "core",
        accessorFn: (product) => product.name,
        header: sortableHeader("Core Identity"),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">
              SKU {row.original.sku}
            </div>
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div
            className="flex justify-end gap-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedProduct(row.original)}
            >
              <Eye className="h-4 w-4" />
              View
            </Button>
            <Button size="sm" asChild>
              <Link
                href={`${ADMIN_BASE}/products/new?coreProductId=${row.original.id}`}
              >
                <Plus className="h-4 w-4" />
                Add
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredProducts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3.5 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Layers3 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Public Product Catalog
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Browse core identities by type, category, and sub category before
              viewing brands and variants.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x border-t bg-muted/30">
          <CatalogStat label="Core Identities" value={coreProducts.length} />
          <CatalogStat label="Types" value={typeOptions.length} />
          <CatalogStat label="Categories" value={categoryOptions.length} />
        </div>
      </header>

      {/* Catalog */}
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
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Product name or SKU…"
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
                setCoreFilter(ALL);
              }}
            />
            <FilterSelect
              label="Category"
              value={categoryFilter}
              options={categoryOptions}
              onValueChange={(value) => {
                setCategoryFilter(value);
                setSubCategoryFilter(ALL);
                setCoreFilter(ALL);
              }}
            />
            <FilterSelect
              label="Sub Category"
              value={subCategoryFilter}
              options={subCategoryOptions}
              onValueChange={(value) => {
                setSubCategoryFilter(value);
                setCoreFilter(ALL);
              }}
            />
            <FilterSelect
              label="Core Identity"
              value={coreFilter}
              options={coreOptions}
              onValueChange={setCoreFilter}
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-36 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading catalog...
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-36 text-center">
                  <div className="space-y-1">
                    <p className="font-medium">No products found</p>
                    <p className="text-sm text-muted-foreground">
                      Try a different search or filter.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedProduct(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col items-center justify-between gap-3 border-t p-4 text-sm sm:flex-row">
          <span className="text-muted-foreground">
            {filteredProducts.length} of {coreProducts.length} core identities
          </span>
          {table.getPageCount() > 1 ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {selectedProduct && (
        <ProductDetailDialog
          product={selectedProduct}
          brands={options?.brands ?? []}
          variants={getAvailableVariants(
            selectedProduct,
            options?.variantOptions,
          )}
          onOpenChange={(open) => {
            if (!open) setSelectedProduct(null);
          }}
        />
      )}
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
          <SelectValue placeholder={label} />
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

function ProductDetailDialog({
  product,
  brands,
  variants,
  onOpenChange,
}: {
  product: CatalogCoreProduct;
  brands: Array<{ id: number; name: string; slug: string }>;
  variants: NonNullable<CatalogOptions["variantOptions"]>;
  onOpenChange: (open: boolean) => void;
}) {
  const priceQuery = useQuery(
    orpc.product.listConsumerReferencePrices.queryOptions({
      input: { coreProductId: product.id },
    }),
  );
  const priceItems = priceQuery.data?.items ?? [];

  const productsQuery = useQuery({
    ...orpc.product.getAll.queryOptions({ input: {} }),
    queryKey: ["admin-products"],
  });

  const editableProduct = useMemo(() => {
    const candidates = (productsQuery.data?.products ?? [])
      .map((created) => created as EditableProductCandidate)
      .filter(
        (created) =>
          created.coreProductId === product.id && !created.createdByWarehouseId,
      );

    if (candidates.length === 0) return null;

    return [...candidates].sort((left, right) => {
      const leftNameMatch =
        normalizeName(left.name) === normalizeName(product.name);
      const rightNameMatch =
        normalizeName(right.name) === normalizeName(product.name);
      if (leftNameMatch !== rightNameMatch) return leftNameMatch ? -1 : 1;

      const leftMultiBrand = hasMultiBrandConfiguration(left);
      const rightMultiBrand = hasMultiBrandConfiguration(right);
      if (leftMultiBrand !== rightMultiBrand) return leftMultiBrand ? -1 : 1;

      const createdAtDiff =
        getCreatedAtTime(left.createdAt) - getCreatedAtTime(right.createdAt);
      if (createdAtDiff !== 0) return createdAtDiff;

      return left.id - right.id;
    })[0];
  }, [product.id, product.name, productsQuery.data?.products]);

  const isResolvingEdit = productsQuery.isLoading;
  const editHref = editableProduct
    ? `${ADMIN_BASE}/products/${editableProduct.id}/edit`
    : `${ADMIN_BASE}/products/new?coreProductId=${product.id}`;

  const priceGroups = useMemo(() => {
    const map = new Map<string, typeof priceItems>();
    for (const item of priceItems) {
      const brandName =
        item.brandDisplay && item.brandDisplay !== "—"
          ? item.brandDisplay
          : "Unbranded";
      const brandItems = map.get(brandName) ?? [];
      brandItems.push(item);
      map.set(brandName, brandItems);
    }

    return Array.from(map.entries()).map(([brandName, items]) => {
      return {
        brandName,
        variantCount: items.length,
        items,
      };
    });
  }, [priceItems]);

  const configuredVariantCount = priceItems.length;

  const packVariants = variants.filter(
    (variant) => variant.variantType === "pack",
  );
  const looseVariants = variants.filter(
    (variant) => variant.variantType === "loose",
  );
  const hasLoose = product.supportsLoose || looseVariants.length > 0;
  const variantTypes = [
    product.supportsPack !== false || packVariants.length > 0 ? "Pack" : null,
    hasLoose ? "Loose" : null,
  ].filter(Boolean) as string[];

  const hasImage =
    !!product.image &&
    (product.image.startsWith("http") || product.image.startsWith("/"));

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <DialogDescription className="sr-only">
          Core product details for {product.name}
        </DialogDescription>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5 pr-14">
          <div className="flex items-start gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {hasImage ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="56px"
                  className="object-contain"
                  unoptimized={product.image.startsWith("http")}
                />
              ) : (
                <Package className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1">
              <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">
                {product.name}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                <span>{product.category.type?.name || "Unassigned"}</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <span>{product.category.name}</span>
                {product.subCategory && (
                  <>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    <span>{product.subCategory.name}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">SKU {product.sku}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/products/${product.category.slug}/${product.slug}`}>
                <Eye className="mr-1.5 h-4 w-4" />
                Preview
              </Link>
            </Button>

            {isResolvingEdit ? (
              <Button size="sm" disabled>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Edit
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link href={editHref}>
                  {editableProduct ? (
                    <Edit3 className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Plus className="mr-1.5 h-4 w-4" />
                  )}
                  {editableProduct ? "Edit" : "Add"}
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Tabbed Content */}
        <Tabs defaultValue="overview" className="flex-1">
          <div className="border-b px-6">
            <TabsList variant="line" className="h-11">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="variants">Variants &amp; Pricing</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[calc(92vh-160px)]">
            {/* Overview Tab */}
            <TabsContent value="overview" className="m-0 space-y-8 p-6">
              {/* Product Information */}
              <section className="space-y-4">
                <SectionHeading title="Product Information" />
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <DataField
                    label="Type"
                    value={product.category.type?.name || "—"}
                  />
                  <DataField label="Category" value={product.category.name} />
                  <DataField
                    label="Sub Category"
                    value={product.subCategory?.name || "—"}
                  />
                  <DataField label="Core Name" value={product.name} />
                  <DataField label="SKU" value={product.sku} />
                  <DataField label="Product ID" value={`#${product.id}`} />
                </dl>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Brands
                  </p>
                  {brands.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {brands.map((brand) => (
                        <Badge
                          key={brand.id}
                          variant="secondary"
                          className="font-normal"
                        >
                          {brand.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No brands linked
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Variant Types
                  </p>
                  {variantTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {variantTypes.map((type) => (
                        <Badge
                          key={type}
                          variant="outline"
                          className="font-normal"
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No variants configured
                    </p>
                  )}
                </div>
              </section>

              {/* Description */}
              <section className="space-y-4">
                <SectionHeading title="Description" />
                {product.description?.trim() ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                    {product.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No description added
                  </p>
                )}
              </section>

              {/* History */}
              <section className="space-y-4">
                <SectionHeading title="History" />
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <DataField
                    label="Created"
                    value={formatDate(product.createdAt)}
                  />
                  <DataField
                    label="Last Updated"
                    value={formatDate(product.updatedAt)}
                  />
                </dl>
              </section>
            </TabsContent>

            {/* Variants & Pricing Tab */}
            <TabsContent value="variants" className="m-0 p-6">
              <section className="space-y-4">
                <SectionHeading
                  title="Consumer Pricing"
                  description="Configured brand and variant prices"
                />
                {priceQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading prices…
                  </div>
                ) : priceItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No prices configured for this product yet.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="font-normal">
                        {priceGroups.length}{" "}
                        {priceGroups.length === 1 ? "brand" : "brands"}
                      </Badge>
                      <Badge variant="outline" className="font-normal">
                        {configuredVariantCount} configured{" "}
                        {configuredVariantCount === 1 ? "variant" : "variants"}
                      </Badge>
                    </div>

                    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(18rem,100%),1fr))]">
                      {priceGroups.map((group) => (
                        <div
                          key={group.brandName}
                          className="overflow-hidden rounded-lg border bg-background"
                        >
                          <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                            <h4 className="truncate text-sm font-semibold text-foreground">
                              {group.brandName}
                            </h4>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {group.variantCount}{" "}
                              {group.variantCount === 1
                                ? "variant"
                                : "variants"}
                            </span>
                          </div>

                          <div className="divide-y">
                            {group.items.map((item) => (
                              <div
                                key={item.variantPriceId}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate text-sm font-medium text-foreground">
                                      {item.variantName}
                                    </span>
                                    {item.variantUnit ? (
                                      <Badge
                                        variant="outline"
                                        className="h-5 rounded-sm px-1.5 text-[11px] font-normal"
                                      >
                                        {item.variantUnit}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="text-right text-sm tabular-nums">
                                  {item.consumerPrice &&
                                  item.consumerPrice !== "0" ? (
                                    <span className="font-semibold text-foreground">
                                      ৳ {item.consumerPrice}
                                    </span>
                                  ) : (
                                    <span className="font-medium text-muted-foreground">
                                      ৳ 0.00
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Reference prices only — sellers can override these.
                    </p>
                  </>
                )}
              </section>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="border-b pb-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
