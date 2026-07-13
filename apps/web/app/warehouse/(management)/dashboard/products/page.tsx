"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  type Column,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowUpDown,
  Boxes,
  Filter,
  MoreHorizontal,
  Package,
  PackagePlus,
  Printer,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/utils/orpc";

const WH = "/warehouse/dashboard";

type FilterOption = { id: number; name: string };

type WarehouseProductRow = {
  inventoryId: number | null;
  variantId: number;
  sku: string | null;
  variantSku: string | null;
  productId: number;
  productSku: string | null;
  productName: string;
  productStatus: string;
  creatorSource: "admin" | "warehouse" | "shop" | "unknown";
  creatorId: string | null;
  isOwnedByWarehouse: boolean;
  coreProductId: number | null;
  coreProductName: string;
  coreProductImage: string;
  categoryId: number;
  categoryName: string;
  subCategoryId: number | null;
  subCategoryName: string;
  typeId: number | null;
  typeName: string;
  brandId: number | null;
  brandName: string;
  variantLabel: string;
  unitLabel: string;
  packagingType: string;
  packUnit: string;
  packPrice: string;
  basePrice: string;
  isActive: boolean;
  availableQty: string;
  reservedQty: string;
  inCartonQty: string;
  activeCartonCount: number;
  reorderLevel: number;
  updatedAt: string;
  isLoose: boolean;
  weightKg: number;
};

type PriceListData = {
  items?: WarehouseProductRow[];
  stats?: {
    totalProducts: number;
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
  filterOptions?: {
    types?: FilterOption[];
    categories?: FilterOption[];
    subCategories?: FilterOption[];
    coreProducts?: FilterOption[];
    brands?: FilterOption[];
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";
type StockState = Exclude<StockFilter, "all">;
type SortBy =
  | "name_asc"
  | "name_desc"
  | "stock_desc"
  | "stock_asc"
  | "price_desc"
  | "price_asc";

function SortableHeader({
  column,
  title,
  align = "left",
}: {
  column: Column<WarehouseProductRow, unknown>;
  title: string;
  align?: "left" | "right";
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={align === "right" ? "-mr-3 h-8 float-right" : "-ml-3 h-8"}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {title}
      <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  );
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number | string | null | undefined) {
  return Math.round(toNumber(value)).toLocaleString("en-BD");
}

function formatCurrency(value: number | string | null | undefined) {
  return `৳${toNumber(value).toLocaleString("en-BD")}`;
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStockUnit(item: WarehouseProductRow) {
  if (item.isLoose || item.packagingType === "loose") return "KG";
  if (item.packagingType === "packet") return "Pack";
  return titleCase(item.packagingType || item.unitLabel || "Unit");
}

function getStockState(item: WarehouseProductRow): StockState {
  const qty = toNumber(item.availableQty);
  const threshold = item.reorderLevel > 0 ? item.reorderLevel : 10;

  if (qty <= 0) return "out_of_stock";
  if (qty <= threshold) return "low_stock";
  return "in_stock";
}

function getVariantText(item: WarehouseProductRow) {
  const parts = [
    item.brandName && item.brandName !== "—" ? item.brandName : null,
    item.variantLabel || item.unitLabel || item.packUnit,
  ].filter(Boolean);

  return parts.join(" + ") || "—";
}

function getDetailHref(item: WarehouseProductRow) {
  if (item.coreProductId) return `${WH}/stock/core-${item.coreProductId}`;
  return `${WH}/stock/product-${item.productId}`;
}

function uniqueOptions(
  rows: WarehouseProductRow[],
  idKey: keyof WarehouseProductRow,
  nameKey: keyof WarehouseProductRow,
) {
  const map = new Map<number, string>();

  for (const row of rows) {
    const id = row[idKey];
    const name = row[nameKey];
    if (typeof id === "number" && typeof name === "string" && name !== "—") {
      map.set(id, name);
    }
  }

  return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function isActiveProductRow(item: WarehouseProductRow) {
  return item.productStatus === "active" && item.isActive;
}

export default function WarehouseProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
  const [selectedBrandId, setSelectedBrandId] = useState<number | undefined>();
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name_asc");
  const [tableSorting, setTableSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedTypeId, selectedCategoryId, selectedSubCategoryId, selectedCoreProductId, selectedBrandId, stockFilter, sortBy, pageSize]);

  const { data, isLoading, isError, error, refetch } = useQuery<PriceListData>({
    queryKey: [
      "warehouse",
      "getWarehouseProductList",
      "productsPage",
      {
        page,
        pageSize,
        typeId: selectedTypeId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId,
        coreProductId: selectedCoreProductId,
        brandId: selectedBrandId,
        search: debouncedSearch,
        stockFilter,
        sortBy,
      },
    ],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseProductList.call({
        page,
        pageSize,
        typeId: selectedTypeId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId,
        coreProductId: selectedCoreProductId,
        brandId: selectedBrandId,
        search: debouncedSearch || undefined,
        stockFilter,
        sortBy,
      }),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  });

  const deactivateMutation = useMutation({
    mutationFn: (productId: number) =>
      (orpc.warehouse as any).updateWarehouseProductStatus.call({
        productId,
        status: "inactive",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["warehouse", "getWarehouseProductList"],
      });
      toast.success("Product deactivated");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to deactivate product");
    },
  });

  const allItems = useMemo(() => data?.items ?? [], [data?.items]);
  const activeRows = useMemo(
    () => allItems.filter(isActiveProductRow),
    [allItems],
  );

  const filterOptions = data?.filterOptions ?? {};
  const scopedRows = activeRows.length > 0 ? activeRows : allItems;

  const typeOptions =
    filterOptions.types ?? uniqueOptions(scopedRows, "typeId", "typeName");
  const categoryOptions =
    selectedTypeId || debouncedSearch
      ? uniqueOptions(scopedRows, "categoryId", "categoryName")
      : (filterOptions.categories ??
        uniqueOptions(scopedRows, "categoryId", "categoryName"));
  const subCategoryOptions =
    selectedCategoryId || selectedTypeId || debouncedSearch
      ? uniqueOptions(scopedRows, "subCategoryId", "subCategoryName")
      : (filterOptions.subCategories ??
        uniqueOptions(scopedRows, "subCategoryId", "subCategoryName"));
  const coreProductOptions =
    selectedTypeId ||
    selectedCategoryId ||
    selectedSubCategoryId ||
    debouncedSearch
      ? uniqueOptions(scopedRows, "coreProductId", "coreProductName")
      : (filterOptions.coreProducts ??
        uniqueOptions(scopedRows, "coreProductId", "coreProductName"));
  const brandOptions =
    selectedTypeId ||
    selectedCategoryId ||
    selectedSubCategoryId ||
    debouncedSearch
      ? uniqueOptions(scopedRows, "brandId", "brandName")
      : (filterOptions.brands ??
        uniqueOptions(scopedRows, "brandId", "brandName"));

  const stockCounts = {
    inStock: data?.stats?.inStock ?? 0,
    lowStock: data?.stats?.lowStock ?? 0,
    outOfStock: data?.stats?.outOfStock ?? 0,
  };

  const visibleRows = activeRows;
  const activeProductCount = data?.stats?.totalProducts ?? 0;
  const hasActiveFilters = Boolean(
    search ||
      selectedTypeId ||
      selectedCategoryId ||
      selectedSubCategoryId ||
      selectedCoreProductId ||
      selectedBrandId ||
      stockFilter !== "all" ||
      sortBy !== "name_asc",
  );
  const hasNoAssignedProducts = !isLoading && !isError && allItems.length === 0;

  const clearFilters = () => {
    setSearch("");
    setSelectedTypeId(undefined);
    setSelectedCategoryId(undefined);
    setSelectedSubCategoryId(undefined);
    setSelectedCoreProductId(undefined);
    setSelectedBrandId(undefined);
    setStockFilter("all");
    setSortBy("name_asc");
    setPage(1);
  };

  const handleDeactivate = useCallback((item: WarehouseProductRow) => {
    if (
      window.confirm(
        `Deactivate ${item.coreProductName || item.productName}? This will hide the product from active product lists.`,
      )
    ) {
      deactivateMutation.mutate(item.productId);
    }
  }, [deactivateMutation.mutate]);

  const notifyNotImplemented = useCallback((action: string) => {
    toast.info(`${action} is not implemented yet.`);
  }, []);

  const columns = useMemo<ColumnDef<WarehouseProductRow>[]>(() => [
    {
      accessorKey: "productName",
      header: ({ column }) => <SortableHeader column={column} title="Product" />,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <Link href={getDetailHref(item)} className="block min-w-[220px]">
            <div className="font-medium">{item.productName}</div>
            {item.brandName !== "—" && (
              <Badge variant="outline" className="mt-1 text-[10px]">
                {item.brandName}
              </Badge>
            )}
          </Link>
        );
      },
    },
    {
      accessorKey: "categoryName",
      header: ({ column }) => <SortableHeader column={column} title="Category" />,
      cell: ({ row }) => (
        <div className="min-w-[130px]">
          <div className="text-sm font-medium">{row.original.categoryName}</div>
          {row.original.subCategoryName &&
            row.original.subCategoryName !== "—" && (
              <div className="text-xs text-muted-foreground">
                {row.original.subCategoryName}
              </div>
            )}
        </div>
      ),
    },
    {
      id: "variant",
      accessorFn: (row) => getVariantText(row),
      header: ({ column }) => <SortableHeader column={column} title="Variant" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="min-w-[120px] text-xs font-medium">
          {getVariantText(row.original)}
        </Badge>
      ),
    },
    {
      id: "stock",
      accessorFn: (row) => toNumber(row.availableQty),
      header: ({ column }) => <SortableHeader column={column} title="Stock" />,
      cell: ({ row }) => {
        const item = row.original;
        const stock = getStockState(item);
        return (
          <div className="flex min-w-[140px] items-center gap-2">
            <span className="font-medium tabular-nums">
              {formatNumber(item.availableQty)} {getStockUnit(item)}
            </span>
            {stock === "low_stock" && (
              <Badge className="border-amber-200 bg-amber-50 text-[10px] text-amber-700 hover:bg-amber-50">
                Low
              </Badge>
            )}
            {stock === "out_of_stock" && (
              <Badge className="border-red-200 bg-red-50 text-[10px] text-red-700 hover:bg-red-50">
                Out
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "packPrice",
      accessorFn: (row) => toNumber(row.packPrice),
      header: ({ column }) => (
        <SortableHeader column={column} title="Price" align="right" />
      ),
      cell: ({ row }) => (
        <div className="min-w-[90px] text-right font-medium tabular-nums">
          {formatCurrency(row.original.packPrice)}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      enableHiding: false,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <RowActions
              item={item}
              stockQty={toNumber(item.availableQty)}
              onDeactivate={handleDeactivate}
              onNotImplemented={notifyNotImplemented}
              isDeactivating={deactivateMutation.isPending}
            />
          </div>
        );
      },
    },
  ], [deactivateMutation.isPending, handleDeactivate, notifyNotImplemented]);

  const handleTableSortingChange = useCallback(
    (updater: SortingState | ((current: SortingState) => SortingState)) => {
      setTableSorting((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        const selected = next[0];
        if (selected?.id === "productName") {
          setSortBy(selected.desc ? "name_desc" : "name_asc");
        } else if (selected?.id === "stock") {
          setSortBy(selected.desc ? "stock_desc" : "stock_asc");
        } else if (selected?.id === "packPrice") {
          setSortBy(selected.desc ? "price_desc" : "price_asc");
        }
        return next;
      });
    },
    [],
  );

  const table = useReactTable({
    data: visibleRows,
    columns,
    getRowId: (row) => String(row.variantId),
    state: { sorting: tableSorting },
    onSortingChange: handleTableSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    autoResetPageIndex: false,
  });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Package className="h-6 w-6 text-emerald-600" />
            Products
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {activeProductCount.toLocaleString("en-BD")} active products · {(data?.pagination?.totalCount ?? 0).toLocaleString("en-BD")} variants
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => notifyNotImplemented("Print labels")}>
            <Printer className="mr-2 h-4 w-4" />
            Print Labels
          </Button>
          <Button asChild className="gap-1.5">
            <Link href={`${WH}/catalog`}>
              <PackagePlus className="h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard
          icon={Package}
          label="Total Products"
          value={activeProductCount}
          iconBg="bg-blue-100 dark:bg-blue-950/30"
          iconColor="text-blue-600"
        />
        <KpiCard
          icon={Boxes}
          label="In Stock"
          value={stockCounts.inStock}
          iconBg="bg-emerald-100 dark:bg-emerald-950/30"
          iconColor="text-emerald-600"
          valueColor="text-emerald-600"
          onClick={() => setStockFilter("in_stock")}
          active={stockFilter === "in_stock"}
        />
        <KpiCard
          icon={AlertCircle}
          label="Low Stock"
          value={stockCounts.lowStock}
          iconBg="bg-amber-100 dark:bg-amber-950/30"
          iconColor="text-amber-500"
          valueColor={stockCounts.lowStock > 0 ? "text-amber-600" : undefined}
          onClick={() => setStockFilter("low_stock")}
          active={stockFilter === "low_stock"}
        />
        <KpiCard
          icon={AlertCircle}
          label="Out of Stock"
          value={stockCounts.outOfStock}
          iconBg="bg-red-100 dark:bg-red-950/30"
          iconColor="text-red-500"
          valueColor={stockCounts.outOfStock > 0 ? "text-red-600" : undefined}
          onClick={() => setStockFilter("out_of_stock")}
          active={stockFilter === "out_of_stock"}
        />
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by name, SKU..."
            className="pl-9"
          />
        </div>

        <Tabs value={stockFilter} onValueChange={(v) => { setStockFilter(v as StockFilter); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="in_stock">In Stock</TabsTrigger>
            <TabsTrigger value="low_stock">Low Stock</TabsTrigger>
            <TabsTrigger value="out_of_stock">Out of Stock</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={sortBy} onValueChange={(value) => { setSortBy(value as SortBy); setTableSorting([]); }}>
          <SelectTrigger className="w-[180px]">
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Name A-Z</SelectItem>
            <SelectItem value="name_desc">Name Z-A</SelectItem>
            <SelectItem value="stock_desc">Stock High</SelectItem>
            <SelectItem value="stock_asc">Stock Low</SelectItem>
            <SelectItem value="price_desc">Price High</SelectItem>
            <SelectItem value="price_asc">Price Low</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* ── Advanced Filters (collapsible row) ── */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <FilterSelect label="Type" value={selectedTypeId} placeholder="All Types" options={typeOptions}
          onChange={(value) => { setSelectedTypeId(value); setSelectedCategoryId(undefined); setSelectedSubCategoryId(undefined); setSelectedCoreProductId(undefined); setPage(1); }}
        />
        <FilterSelect label="Category" value={selectedCategoryId} placeholder="All Categories" options={categoryOptions}
          onChange={(value) => { setSelectedCategoryId(value); setSelectedSubCategoryId(undefined); setSelectedCoreProductId(undefined); setPage(1); }}
        />
        <FilterSelect label="Sub Category" value={selectedSubCategoryId} placeholder="All Sub Categories" options={subCategoryOptions}
          onChange={(value) => { setSelectedSubCategoryId(value); setSelectedCoreProductId(undefined); setPage(1); }}
        />
        <FilterSelect label="Core Identity" value={selectedCoreProductId} placeholder="All Core Identities" options={coreProductOptions}
          onChange={(value) => { setSelectedCoreProductId(value); setPage(1); }}
        />
        <FilterSelect label="Brand" value={selectedBrandId} placeholder="All Brands" options={brandOptions}
          onChange={(value) => { setSelectedBrandId(value); setPage(1); }}
        />
      </div>

      {/* ── Product Table ── */}
      <section id="product-list">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message={(error as any)?.message || "Could not load warehouse products."} onRetry={() => refetch()} />
        ) : hasNoAssignedProducts ? (
          <EmptyProductsState />
        ) : activeRows.length === 0 ? (
          <NoResultsState onClear={clearFilters} />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
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
                    {table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className="transition-colors hover:bg-muted/50"
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
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Page {data?.pagination?.page ?? page} of {Math.max(1, data?.pagination?.totalPages ?? 1)} · {data?.pagination?.totalCount ?? 0} results
                </p>
                <div className="flex items-center gap-2">
                  <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                    <SelectTrigger className="h-8 w-[92px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25 rows</SelectItem>
                      <SelectItem value="50">50 rows</SelectItem>
                      <SelectItem value="100">100 rows</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= (data?.pagination?.totalPages ?? 1)} onClick={() => setPage((current) => current + 1)}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
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
  value: number | undefined;
  placeholder: string;
  options: FilterOption[];
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </Label>
      <Select
        value={value ? String(value) : "all"}
        onValueChange={(nextValue) =>
          onChange(nextValue === "all" ? undefined : Number(nextValue))
        }
      >
        <SelectTrigger className="h-10">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
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

function RowActions({
  item,
  stockQty,
  onDeactivate,
  onNotImplemented,
  isDeactivating,
}: {
  item: WarehouseProductRow;
  stockQty: number;
  onDeactivate: (item: WarehouseProductRow) => void;
  onNotImplemented: (action: string) => void;
  isDeactivating: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open row actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Row Action</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={getDetailHref(item)}>View Details</Link>
        </DropdownMenuItem>
        {stockQty <= 0 ? (
          <DropdownMenuItem asChild>
            <Link href={`${WH}/stock/add`}>Add Stock</Link>
          </DropdownMenuItem>
        ) : null}
        {item.isOwnedByWarehouse && item.coreProductId ? (
          <DropdownMenuItem asChild>
            <Link href={`${WH}/products/${item.productId}/edit`}>
              Edit Product
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            Product details owned by creator
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={`${WH}/stock-adjustment/create`}>Adjust Stock</Link>
        </DropdownMenuItem>
        {stockQty > 0 ? (
          <DropdownMenuItem asChild>
            <Link href={`${WH}/carton-tracking/${item.productId}`}>
              Transfer
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => onNotImplemented("Print label")}>
          Print Label (Not implemented)
        </DropdownMenuItem>
        {item.isOwnedByWarehouse && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isDeactivating}
              onSelect={() => onDeactivate(item)}
            >
              Deactivate
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
  valueColor,
  onClick,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
  onClick?: () => void;
  active?: boolean;
}) {

  return (
    <Card className={active ? "ring-2 ring-primary ring-offset-1" : ""}>
      <CardContent
        className="flex items-center gap-3 p-4"
        {...(onClick ? { onClick, role: "button", tabIndex: 0 } : {})}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-lg font-bold tabular-nums ${valueColor ?? ""}`}>
            {value.toLocaleString("en-BD")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
        <p className="font-semibold text-red-700">Failed to load products</p>
        <p className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">{message}</p>
        <Button variant="destructive" size="sm" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyProductsState() {
  return (
    <Card>
      <CardContent className="py-20 text-center">
        <Package className="mx-auto mb-4 h-14 w-14 text-muted-foreground/20" />
        <p className="text-lg font-semibold">No products assigned</p>
        <p className="mt-1 text-sm text-muted-foreground mb-6">
          Activate products from the warehouse catalog to start stock management.
        </p>
        <Button asChild>
          <Link href={`${WH}/catalog`}>
            <PackagePlus className="mr-2 h-4 w-4" />
            Activate Products
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function NoResultsState({ onClear }: { onClear: () => void }) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <Filter className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
        <p className="font-semibold">No products match this view</p>
        <p className="mt-1 text-sm text-muted-foreground mb-6">
          Try changing filters or search.
        </p>
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear Filters
        </Button>
      </CardContent>
    </Card>
  );
}

