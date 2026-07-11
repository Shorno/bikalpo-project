"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
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
import { useDeferredValue, useMemo, useState } from "react";
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
  inventoryId: number;
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
    totalVariants: number;
    lastUpdated: string | null;
  };
  filterOptions?: {
    types?: FilterOption[];
    categories?: FilterOption[];
    subCategories?: FilterOption[];
    coreProducts?: FilterOption[];
    brands?: FilterOption[];
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
  const deferredSearch = useDeferredValue(search.trim());
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
  const [visibleCount, setVisibleCount] = useState(50);

  const { data, isLoading, isError, error, refetch } = useQuery<PriceListData>({
    queryKey: [
      "warehouse",
      "getWarehousePriceList",
      "productsPage",
      {
        typeId: selectedTypeId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId,
        coreProductId: selectedCoreProductId,
        brandId: selectedBrandId,
        search: deferredSearch,
      },
    ],
    queryFn: () =>
      (orpc.warehouse as any).getWarehousePriceList.call({
        typeId: selectedTypeId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId,
        coreProductId: selectedCoreProductId,
        brandId: selectedBrandId,
        search: deferredSearch || undefined,
      }),
    staleTime: 30_000,
  });

  const deactivateMutation = useMutation({
    mutationFn: (productId: number) =>
      (orpc.warehouse as any).updateWarehouseProductStatus.call({
        productId,
        status: "inactive",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["warehouse", "getWarehousePriceList"],
      });
      toast.success("Product deactivated");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to deactivate product");
    },
  });

  const allItems = data?.items ?? [];
  const activeRows = useMemo(
    () => allItems.filter(isActiveProductRow),
    [allItems],
  );

  const filterOptions = data?.filterOptions ?? {};
  const scopedRows = activeRows.length > 0 ? activeRows : allItems;

  const typeOptions =
    filterOptions.types ?? uniqueOptions(scopedRows, "typeId", "typeName");
  const categoryOptions =
    selectedTypeId || deferredSearch
      ? uniqueOptions(scopedRows, "categoryId", "categoryName")
      : (filterOptions.categories ??
        uniqueOptions(scopedRows, "categoryId", "categoryName"));
  const subCategoryOptions =
    selectedCategoryId || selectedTypeId || deferredSearch
      ? uniqueOptions(scopedRows, "subCategoryId", "subCategoryName")
      : (filterOptions.subCategories ??
        uniqueOptions(scopedRows, "subCategoryId", "subCategoryName"));
  const coreProductOptions =
    selectedTypeId ||
    selectedCategoryId ||
    selectedSubCategoryId ||
    deferredSearch
      ? uniqueOptions(scopedRows, "coreProductId", "coreProductName")
      : (filterOptions.coreProducts ??
        uniqueOptions(scopedRows, "coreProductId", "coreProductName"));
  const brandOptions =
    selectedTypeId ||
    selectedCategoryId ||
    selectedSubCategoryId ||
    deferredSearch
      ? uniqueOptions(scopedRows, "brandId", "brandName")
      : (filterOptions.brands ??
        uniqueOptions(scopedRows, "brandId", "brandName"));

  const stockCounts = useMemo(() => {
    const counts = { inStock: 0, lowStock: 0, outOfStock: 0 };

    for (const row of activeRows) {
      const state = getStockState(row);
      if (state === "in_stock") counts.inStock++;
      if (state === "low_stock") counts.lowStock++;
      if (state === "out_of_stock") counts.outOfStock++;
    }

    return counts;
  }, [activeRows]);

  const filteredRows = useMemo(() => {
    const rows = activeRows.filter((row) => {
      if (stockFilter === "all") return true;
      return getStockState(row) === stockFilter;
    });

    return [...rows].sort((left, right) => {
      if (sortBy === "name_asc") {
        return left.coreProductName.localeCompare(right.coreProductName);
      }
      if (sortBy === "name_desc") {
        return right.coreProductName.localeCompare(left.coreProductName);
      }
      if (sortBy === "stock_desc") {
        return toNumber(right.availableQty) - toNumber(left.availableQty);
      }
      if (sortBy === "stock_asc") {
        return toNumber(left.availableQty) - toNumber(right.availableQty);
      }
      if (sortBy === "price_desc") {
        return toNumber(right.packPrice) - toNumber(left.packPrice);
      }
      return toNumber(left.packPrice) - toNumber(right.packPrice);
    });
  }, [activeRows, sortBy, stockFilter]);

  const visibleRows = filteredRows.slice(0, visibleCount);
  const activeProductCount = new Set(
    activeRows.map((row) => row.productId),
  ).size;
  const hasMore = visibleRows.length < filteredRows.length;
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
    setVisibleCount(50);
  };

  const handleDeactivate = (item: WarehouseProductRow) => {
    if (
      window.confirm(
        `Deactivate ${item.coreProductName || item.productName}? This will hide the product from active product lists.`,
      )
    ) {
      deactivateMutation.mutate(item.productId);
    }
  };

  const notifyNotImplemented = (action: string) => {
    toast.info(`${action} is not implemented yet.`);
  };

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
            {activeProductCount.toLocaleString("en-BD")} active products · {activeRows.length.toLocaleString("en-BD")} variants
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
              setVisibleCount(50);
            }}
            placeholder="Search by name, SKU..."
            className="pl-9"
          />
        </div>

        <Tabs value={stockFilter} onValueChange={(v) => { setStockFilter(v as StockFilter); setVisibleCount(50); }}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="in_stock">In Stock</TabsTrigger>
            <TabsTrigger value="low_stock">Low Stock</TabsTrigger>
            <TabsTrigger value="out_of_stock">Out of Stock</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
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
          onChange={(value) => { setSelectedTypeId(value); setSelectedCategoryId(undefined); setSelectedSubCategoryId(undefined); setSelectedCoreProductId(undefined); setVisibleCount(50); }}
        />
        <FilterSelect label="Category" value={selectedCategoryId} placeholder="All Categories" options={categoryOptions}
          onChange={(value) => { setSelectedCategoryId(value); setSelectedSubCategoryId(undefined); setSelectedCoreProductId(undefined); setVisibleCount(50); }}
        />
        <FilterSelect label="Sub Category" value={selectedSubCategoryId} placeholder="All Sub Categories" options={subCategoryOptions}
          onChange={(value) => { setSelectedSubCategoryId(value); setSelectedCoreProductId(undefined); setVisibleCount(50); }}
        />
        <FilterSelect label="Core Identity" value={selectedCoreProductId} placeholder="All Core Identities" options={coreProductOptions}
          onChange={(value) => { setSelectedCoreProductId(value); setVisibleCount(50); }}
        />
        <FilterSelect label="Brand" value={selectedBrandId} placeholder="All Brands" options={brandOptions}
          onChange={(value) => { setSelectedBrandId(value); setVisibleCount(50); }}
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
        ) : filteredRows.length === 0 ? (
          <NoResultsState onClear={clearFilters} />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[240px]">Product</TableHead>
                      <TableHead className="min-w-[130px]">Category</TableHead>
                      <TableHead className="min-w-[180px]">Variant</TableHead>
                      <TableHead className="min-w-[140px]">Stock</TableHead>
                      <TableHead className="min-w-[100px] text-right">Price</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((item) => {
                      const qty = toNumber(item.availableQty);
                      const stock = getStockState(item);

                      return (
                        <TableRow key={item.inventoryId} className="cursor-pointer transition-colors hover:bg-muted/50">
                          <TableCell>
                            <Link href={getDetailHref(item)} className="block">
                              <div className="font-medium">{item.productName}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                {item.brandName !== "—" && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {item.brandName}
                                  </Badge>
                                )}
                                <Badge
                                  variant={item.isOwnedByWarehouse ? "default" : "secondary"}
                                  className="text-[10px]"
                                >
                                  {item.isOwnedByWarehouse
                                    ? "Created by this warehouse"
                                    : item.creatorSource === "shop"
                                      ? "Retailer product"
                                      : item.creatorSource === "admin"
                                        ? "Admin product"
                                        : "External warehouse product"}
                                </Badge>
                              </div>
                              {item.sku && (
                                <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                                  {item.sku}
                                </span>
                              )}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{item.categoryName}</div>
                            {item.subCategoryName && item.subCategoryName !== "—" && (
                              <div className="text-xs text-muted-foreground">{item.subCategoryName}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-medium">
                              {getVariantText(item)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium tabular-nums">
                                {formatNumber(qty)} {getStockUnit(item)}
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
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(item.packPrice)}
                          </TableCell>
                          <TableCell>
                            <RowActions
                              item={item}
                              stockQty={qty}
                              onDeactivate={handleDeactivate}
                              onNotImplemented={notifyNotImplemented}
                              isDeactivating={deactivateMutation.isPending}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {hasMore && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {visibleRows.length} of {filteredRows.length.toLocaleString("en-BD")} results
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setVisibleCount((c) => c + 50)}>
                    Load More
                  </Button>
                </div>
              )}
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
            <Link href={`${WH}/catalog/add/${item.coreProductId}`}>
              Manage Brand & Variants
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

