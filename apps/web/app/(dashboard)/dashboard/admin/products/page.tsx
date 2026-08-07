"use client";

import { resolveBrandCreationAction } from "@bikalpo-project/db/brand-creation";
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
import { StarRating } from "@/components/features/reviews/star-rating";
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
import { cn } from "@/lib/utils";
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
  hasConfiguration?: boolean;
  configuredBrandCount?: number;
  brandCreationMode: "single" | "batch";
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

type FilterOption = { id: number; name: string };

const ALL = "all";

type ProductFeatureGroup = {
  title: string;
  items: Array<{ key: string; value: string }>;
};

type EditableProductCandidate = {
  id: number;
  name: string;
  coreProductId?: number | null;
  createdByWarehouseId?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  productBrands?: Array<{
    brandId?: number | null;
    brand?: { id: number; name: string } | null;
  }>;
  variantPrices?: Array<{ brandId?: number | null }>;

  // Inventory & product rules (product-row fields from getAll)
  status?: "active" | "inactive" | "draft" | null;
  trackingType?: "none" | "batch" | "serial" | null;
  expiryEnabled?: boolean | null;
  damageControlEnabled?: boolean | null;
  returnPolicyEnabled?: boolean | null;
  conversionEnabled?: boolean | null;
  minimumOrderEnabled?: boolean | null;
  minimumOrderQty?: string | number | null;
  inventoryUnit?: string | null;
  inventoryLooseUnitEnabled?: boolean | null;
  inventoryLooseUnit?: string | null;
  isReturnablePack?: boolean | null;
  defaultPackDepositAmount?: string | number | null;

  // Description content (product-row fields)
  shortDescription?: string | null;
  description?: string | null;
  features?: ProductFeatureGroup[] | null;
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

function formatQuantity(value: string | number | null | undefined) {
  if (value == null || value === "") return "1";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString("en-BD", { maximumFractionDigits: 2 });
}

function formatCurrency(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `৳${num.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function statusLabel(status: string | null | undefined) {
  if (!status) return "Active";
  return status.charAt(0).toUpperCase() + status.slice(1);
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

  const coreProducts = (productsQuery.data?.coreProducts ??
    []) as CatalogCoreProduct[];

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

  const isLoading = productsQuery.isLoading;

  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<CatalogCoreProduct>[]>(
    () => [
      {
        id: "index",
        header: () => <span className="pl-1 text-muted-foreground">#</span>,
        enableSorting: false,
        cell: ({ row, table }) => {
          const seq =
            table.getSortedRowModel().rows.findIndex((r) => r.id === row.id) +
            1;
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
        cell: ({ row }) => {
          const action = resolveBrandCreationAction({
            mode: row.original.brandCreationMode,
            configuredBrandCount: row.original.configuredBrandCount ?? 0,
          });
          const configured = (row.original.configuredBrandCount ?? 0) > 0;
          return (
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
                  href={
                    configured
                      ? `${ADMIN_BASE}/products/core/${row.original.id}/edit`
                      : `${ADMIN_BASE}/products/new?coreProductId=${row.original.id}`
                  }
                >
                  {configured ? (
                    <Edit3 className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {action.label}
                </Link>
              </Button>
            </div>
          );
        },
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
                <TableCell
                  colSpan={columns.length}
                  className="h-36 text-center"
                >
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading catalog...
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-36 text-center"
                >
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
  onOpenChange,
}: {
  product: CatalogCoreProduct;
  onOpenChange: (open: boolean) => void;
}) {
  const action = resolveBrandCreationAction({
    mode: product.brandCreationMode,
    configuredBrandCount: product.configuredBrandCount ?? 0,
  });
  const configured = (product.configuredBrandCount ?? 0) > 0;
  const priceQuery = useQuery(
    orpc.product.listConsumerReferencePrices.queryOptions({
      input: { coreProductId: product.id },
    }),
  );
  const priceItems = priceQuery.data?.items ?? [];

  const configurationQuery = useQuery({
    ...orpc.adminProductConfig.get.queryOptions({
      input: { coreProductId: product.id },
    }),
    enabled: configured,
    retry: false,
  });
  const configuredProducts = configurationQuery.data?.brands ?? [];
  const editableProduct = (configuredProducts.find(
    (configured) => configured.status === "active",
  )?.product ??
    configuredProducts[0]?.product ??
    null) as EditableProductCandidate | null;

  const isResolvingEdit = configurationQuery.isLoading;

  // Admin-scoped brands: only the brands this admin product was configured with,
  // not the global catalog brand list (which also includes warehouse/retailer brands).
  const configuredBrands = configuredProducts.map((configured) => ({
    id: configured.brandId,
    name: configured.brandName,
    status: configured.status,
    productId: configured.productId,
  }));

  const reviewsQuery = useQuery({
    ...orpc.customer.getProductReviews.queryOptions({
      input: { productId: editableProduct?.id ?? 0 },
    }),
    enabled: !!editableProduct?.id,
  });
  const reviews = reviewsQuery.data?.reviews ?? [];
  const reviewStats = reviewsQuery.data?.stats ?? {
    averageRating: 0,
    totalReviews: 0,
  };

  const editHref = configured
    ? `${ADMIN_BASE}/products/core/${product.id}/edit`
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

  const hasImage =
    !!product.image &&
    (product.image.startsWith("http") || product.image.startsWith("/"));

  // Inventory & product rules — sourced from the resolved admin product row.
  const inventoryUnitLabel = editableProduct?.inventoryUnit?.trim() || null;
  const minimumOrderLabel =
    editableProduct && editableProduct.minimumOrderEnabled !== false
      ? `${formatQuantity(editableProduct.minimumOrderQty)}${
          inventoryUnitLabel ? ` ${inventoryUnitLabel}` : ""
        }`
      : null;
  const packDepositLabel = formatCurrency(
    editableProduct?.defaultPackDepositAmount,
  );

  const ruleEntries: Array<{
    label: string;
    enabled: boolean;
    onLabel?: string;
    offLabel?: string;
    detail?: string | null;
  }> = editableProduct
    ? [
        {
          label: "Batch Tracking",
          enabled: editableProduct.trackingType === "batch",
        },
        { label: "Expiry Tracking", enabled: !!editableProduct.expiryEnabled },
        {
          label: "Damage Tracking",
          enabled: !!editableProduct.damageControlEnabled,
        },
        {
          label: "Return Policy",
          enabled: editableProduct.returnPolicyEnabled !== false,
          onLabel: "Allowed",
          offLabel: "Not allowed",
        },
        {
          label: "Minimum Order",
          enabled: editableProduct.minimumOrderEnabled !== false,
          detail: minimumOrderLabel,
        },
        { label: "Conversion", enabled: !!editableProduct.conversionEnabled },
        {
          label: "Empty Pack Exchange",
          enabled: !!editableProduct.isReturnablePack,
          detail: editableProduct.isReturnablePack ? packDepositLabel : null,
        },
      ]
    : [];

  // Description content — prefer the admin product row, fall back to the core.
  const descriptionFeatures = (editableProduct?.features ?? []).filter(
    (group) => group?.items?.length,
  );
  const shortDescription = editableProduct?.shortDescription?.trim() || null;
  const longDescription =
    editableProduct?.description?.trim() || product.description?.trim() || null;
  const hasDescriptionContent =
    !!shortDescription || descriptionFeatures.length > 0 || !!longDescription;

  const lastUpdated = editableProduct?.updatedAt ?? product.updatedAt;

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
                  {configured ? (
                    <Edit3 className="mr-1.5 h-4 w-4" />
                  ) : (
                    <Plus className="mr-1.5 h-4 w-4" />
                  )}
                  {action.label}
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
              <TabsTrigger value="reviews">
                Reviews
                {reviewStats.totalReviews > 0 ? (
                  <span className="ml-1 text-muted-foreground">
                    ({reviewStats.totalReviews})
                  </span>
                ) : null}
              </TabsTrigger>
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
                  <DataField label="Core ID" value={`#${product.id}`} />
                  {inventoryUnitLabel ? (
                    <DataField
                      label="Inventory Unit"
                      value={inventoryUnitLabel}
                    />
                  ) : null}
                  {minimumOrderLabel ? (
                    <DataField
                      label="Minimum Order"
                      value={minimumOrderLabel}
                    />
                  ) : null}
                  {editableProduct ? (
                    <DataField
                      label="Status"
                      value={statusLabel(editableProduct.status)}
                    />
                  ) : null}
                </dl>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Brands
                  </p>
                  {isResolvingEdit ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading brands…
                    </div>
                  ) : configuredBrands.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {configuredBrands.map((brand) => (
                        <Badge
                          key={brand.id}
                          variant="secondary"
                          className="gap-1.5 font-normal"
                        >
                          {brand.name}
                          {brand.status === "inactive" ? (
                            <span className="text-[10px] opacity-60">
                              inactive
                            </span>
                          ) : null}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No brands linked
                    </p>
                  )}
                </div>
              </section>

              {/* Inventory & Product Rules */}
              {isResolvingEdit ? (
                <section className="space-y-4">
                  <SectionHeading title="Inventory & Product Rules" />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading rules…
                  </div>
                </section>
              ) : ruleEntries.length > 0 ? (
                <section className="space-y-4">
                  <SectionHeading
                    title="Inventory & Product Rules"
                    description="Configured inventory behaviour for this product"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ruleEntries.map((rule) => (
                      <RuleRow key={rule.label} rule={rule} />
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Description */}
              <section className="space-y-4">
                <SectionHeading title="Description" />
                {hasDescriptionContent ? (
                  <div className="space-y-5">
                    {shortDescription ? (
                      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                        {shortDescription}
                      </p>
                    ) : null}

                    {descriptionFeatures.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {descriptionFeatures.map((group) => (
                          <SpecGroup key={group.title} group={group} />
                        ))}
                      </div>
                    ) : null}

                    {longDescription ? (
                      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                        {longDescription}
                      </p>
                    ) : null}
                  </div>
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
                    value={formatDate(lastUpdated)}
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

            {/* Reviews Tab */}
            <TabsContent value="reviews" className="m-0 p-6">
              <section className="space-y-4">
                <SectionHeading
                  title="Reviews"
                  description="Customer reviews for this product"
                />
                {!editableProduct ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No published product to collect reviews yet.
                  </p>
                ) : reviewsQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading reviews…
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No reviews yet.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold leading-none tabular-nums">
                        {reviewStats.averageRating.toFixed(1)}
                      </span>
                      <div>
                        <StarRating
                          rating={Math.round(reviewStats.averageRating)}
                          size="sm"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {reviewStats.totalReviews}{" "}
                          {reviewStats.totalReviews === 1
                            ? "review"
                            : "reviews"}
                        </p>
                      </div>
                    </div>

                    <div className="divide-y">
                      {reviews.map((review) => (
                        <div key={review.id} className="py-4 first:pt-0">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-foreground">
                              {review.user?.name?.trim() || "Anonymous"}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <StarRating rating={review.rating} size="sm" />
                            {review.title ? (
                              <span className="text-sm font-medium">
                                {review.title}
                              </span>
                            ) : null}
                          </div>
                          {review.comment ? (
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                              {review.comment}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
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

function RuleRow({
  rule,
}: {
  rule: {
    label: string;
    enabled: boolean;
    onLabel?: string;
    offLabel?: string;
    detail?: string | null;
  };
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {rule.label}
        </p>
        {rule.detail ? (
          <p className="text-xs text-muted-foreground">{rule.detail}</p>
        ) : null}
      </div>
      <Badge
        variant={rule.enabled ? "secondary" : "outline"}
        className={cn(
          "shrink-0 font-normal",
          rule.enabled
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "text-muted-foreground",
        )}
      >
        {rule.enabled
          ? (rule.onLabel ?? "Enabled")
          : (rule.offLabel ?? "Disabled")}
      </Badge>
    </div>
  );
}

function SpecGroup({ group }: { group: ProductFeatureGroup }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-2.5 text-sm font-medium">
        {group.title}
      </div>
      <dl className="divide-y">
        {group.items.map((item) => (
          <div
            key={`${item.key}-${item.value}`}
            className="flex justify-between gap-4 px-4 py-2.5 text-sm"
          >
            <dt className="text-muted-foreground">{item.key}</dt>
            <dd className="text-right font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
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
