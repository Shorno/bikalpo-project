"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
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
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { orpc } from "@/utils/orpc";

// ─── Types ─────────────────────────────────────────────────────

type CatalogVariant = {
  id: number;
  sku: string;
  unitLabel: string;
  weightKg: string;
  price: string;
  brandId: number | null;
  brand: { id: number; name: string } | null;
  inInventory: boolean;
};

type CatalogProduct = {
  id: number;
  name: string;
  variants: CatalogVariant[];
};

type CoreProduct = {
  id: number;
  name: string;
  slug: string;
  image: string;
  products: CatalogProduct[];
};

type SubCategoryData = {
  id: number;
  name: string;
  slug: string;
  coreProducts: CoreProduct[];
};

type CatalogCategory = {
  id: number;
  name: string;
  slug: string;
  subCategories: SubCategoryData[];
  directCoreProducts: CoreProduct[];
};

type CatalogType = {
  id: number;
  name: string;
  slug: string;
  categories: CatalogCategory[];
};

// Flattened row for table display
type FlatRow = {
  id: string;
  rowNum: number;
  typeName: string;
  typeId: number;
  categoryName: string;
  categoryId: number;
  subCategoryName: string;
  subCategoryId: number | null;
  coreIdentityName: string;
  coreProduct: CoreProduct;
};

// ─── Type color config ─────────────────────────────────────────

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

// ─── Main Page Component ───────────────────────────────────────

export default function WarehouseCatalogPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Filters
  const [selectedTypeId, setSelectedTypeId] = useState<number | undefined>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    number | undefined
  >();
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<
    number | undefined
  >();
  const [selectedCoreIdentity, setSelectedCoreIdentity] = useState<
    string | undefined
  >();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);

  // Search debounce
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__catalogSearchTimer);
    (window as any).__catalogSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
    }, 400);
  };

  // ─── Queries ─────────────────────────────────────────────────

  const {
    data: catalogData,
    isLoading: loadingCatalog,
    isError: catalogError,
    error: catalogErrorMsg,
  } = useQuery({
    queryKey: [
      "warehouse",
      "getFullCatalog",
      {
        typeId: selectedTypeId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId,
        search: debouncedSearch,
      },
    ],
    queryFn: () =>
      (orpc.warehouse as any).getFullCatalog.call({
        typeId: selectedTypeId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId,
        search: debouncedSearch || undefined,
      }),
    retry: 2,
  });

  // ─── Derived Data ────────────────────────────────────────────

  const types: CatalogType[] = catalogData?.types ?? [];

  // Build dropdown data
  const allTypes = types.map((t) => ({ id: t.id, name: t.name }));

  const allCategories = selectedTypeId
    ? (types.find((t) => t.id === selectedTypeId)?.categories ?? [])
    : types.flatMap((t) => t.categories);

  const allSubCategories = selectedCategoryId
    ? (allCategories.find((c) => c.id === selectedCategoryId)?.subCategories ??
      [])
    : [];

  // Flatten hierarchy into table rows
  const flatRows: FlatRow[] = useMemo(() => {
    const rows: FlatRow[] = [];
    let rowNum = 0;

    for (const type of types) {
      for (const cat of type.categories) {
        for (const sc of cat.subCategories) {
          for (const cp of sc.coreProducts) {
            rowNum++;
            rows.push({
              id: `${type.id}-${cat.id}-${sc.id}-${cp.id}`,
              rowNum,
              typeName: type.name,
              typeId: type.id,
              categoryName: cat.name,
              categoryId: cat.id,
              subCategoryName: sc.name,
              subCategoryId: sc.id,
              coreIdentityName: cp.name,
              coreProduct: cp,
            });
          }
        }
        if (cat.directCoreProducts?.length > 0) {
          for (const cp of cat.directCoreProducts) {
            rowNum++;
            rows.push({
              id: `${type.id}-${cat.id}-direct-${cp.id}`,
              rowNum,
              typeName: type.name,
              typeId: type.id,
              categoryName: cat.name,
              categoryId: cat.id,
              subCategoryName: "—",
              subCategoryId: null,
              coreIdentityName: cp.name,
              coreProduct: cp,
            });
          }
        }
      }
    }

    return rows;
  }, [types]);

  // Apply core identity filter
  const filteredRows = useMemo(() => {
    if (!selectedCoreIdentity) return flatRows;
    return flatRows.filter((r) => r.coreIdentityName === selectedCoreIdentity);
  }, [flatRows, selectedCoreIdentity]);

  // All unique core identity names for dropdown
  const coreIdentityOptions = useMemo(() => {
    const names = [...new Set(flatRows.map((r) => r.coreIdentityName))];
    return names.sort();
  }, [flatRows]);

  // ─── Column Definitions ──────────────────────────────────────

  const columns: ColumnDef<FlatRow>[] = useMemo(
    () => [
      {
        accessorKey: "rowNum",
        header: "#",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground font-medium">
            {row.original.rowNum}
          </span>
        ),
        size: 50,
      },
      {
        accessorKey: "typeName",
        header: "Type",
        cell: ({ row }) => (
          <Badge
            variant={typeVariantMap[row.original.typeName] || "outline"}
            className="text-xs"
          >
            {row.original.typeName}
          </Badge>
        ),
      },
      {
        accessorKey: "categoryName",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-sm font-medium text-foreground">
            {row.original.categoryName}
          </span>
        ),
      },
      {
        accessorKey: "subCategoryName",
        header: "Sub Category",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.subCategoryName}
          </span>
        ),
      },
      {
        accessorKey: "coreIdentityName",
        header: "Core Identity",
        cell: ({ row }) => {
          const cp = row.original.coreProduct;
          const allVariants = cp.products.flatMap((p) => p.variants);
          const inStockCount = allVariants.filter((v) => v.inInventory).length;

          return (
            <div className="flex items-center gap-2.5">
              {cp.image && (
                <Image
                  src={cp.image}
                  alt={cp.name}
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-lg object-cover border"
                />
              )}
              <div>
                <span className="text-sm font-semibold text-foreground">
                  {cp.name}
                </span>
                {allVariants.length > 0 && (
                  <span className="text-xs text-muted-foreground ml-1.5">
                    ({inStockCount}/{allVariants.length})
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        cell: ({ row }) => {
          const cpId = row.original.coreProduct.id;
          return (
            <div className="flex justify-end gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                <Eye size={12} />
                View
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() =>
                  router.push(`/warehouse/dashboard/catalog/add/${cpId}`)
                }
              >
                <Plus size={12} />
                Add
              </Button>
            </div>
          );
        },
      },
    ],
    [router],
  );

  // ─── Table Instance ──────────────────────────────────────────

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  });

  // ─── Page Layout ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-xl">
              <Layers className="text-emerald-600" size={22} />
            </div>
            Product Catalog
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse the complete product catalog. Type → Category → Sub Category
            → Core Identity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/warehouse/dashboard/catalog/requests")}
            className="gap-1.5"
          >
            <Clock size={14} />
            <span className="hidden md:inline">Requests</span>
          </Button>
          <Button
            size="sm"
            onClick={() => router.push("/warehouse/dashboard/catalog/requests")}
            className="gap-1.5"
          >
            <Plus size={14} />
            <span className="hidden md:inline">Request Product</span>
          </Button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Filter By
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Type */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Type
            </Label>
            <Select
              value={selectedTypeId?.toString() ?? "all"}
              onValueChange={(val) => {
                setSelectedTypeId(val === "all" ? undefined : Number(val));
                setSelectedCategoryId(undefined);
                setSelectedSubCategoryId(undefined);
                setSelectedCoreIdentity(undefined);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {allTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Category
            </Label>
            <Select
              value={selectedCategoryId?.toString() ?? "all"}
              onValueChange={(val) => {
                setSelectedCategoryId(val === "all" ? undefined : Number(val));
                setSelectedSubCategoryId(undefined);
                setSelectedCoreIdentity(undefined);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub Category */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Sub Category
            </Label>
            <Select
              value={selectedSubCategoryId?.toString() ?? "all"}
              onValueChange={(val) => {
                setSelectedSubCategoryId(
                  val === "all" ? undefined : Number(val),
                );
                setSelectedCoreIdentity(undefined);
              }}
              disabled={!selectedCategoryId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Sub Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sub Categories</SelectItem>
                {allSubCategories.map((sc) => (
                  <SelectItem key={sc.id} value={sc.id.toString()}>
                    {sc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Core Identity */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Core Identity
            </Label>
            <Select
              value={selectedCoreIdentity ?? "all"}
              onValueChange={(val) =>
                setSelectedCoreIdentity(val === "all" ? undefined : val)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Core Identities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Core Identities</SelectItem>
                {coreIdentityOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      {loadingCatalog ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg">
          <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading catalog...</p>
        </div>
      ) : catalogError ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-red-200 rounded-lg bg-red-50/50">
          <AlertCircle className="text-red-400 mb-4" size={40} />
          <p className="text-red-600 font-semibold">Failed to load catalog</p>
          <p className="text-sm text-red-400 mt-1">
            {(catalogErrorMsg as any)?.message ||
              "Could not connect to the server."}
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="mt-4"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ["warehouse", "getFullCatalog"],
              })
            }
          >
            Retry
          </Button>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg">
          <PackageSearch className="text-muted-foreground/30 mb-4" size={48} />
          <p className="text-muted-foreground font-semibold">
            No products found
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {search
              ? "No products match your search. Try different keywords."
              : "No products in the catalog yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Result count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {filteredRows.length}
              </span>{" "}
              products
            </p>
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
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
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
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
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft size={14} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft size={14} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRight size={14} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Can't Find Product CTA ── */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 flex items-center gap-4">
        <div className="p-2.5 bg-amber-100 rounded-xl shrink-0">
          <AlertCircle className="text-amber-600" size={20} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            Can&apos;t find your product?
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            If your product is not listed, request a new product identity.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
          onClick={() => router.push("/warehouse/dashboard/catalog/requests")}
        >
          + Request
        </Button>
      </div>

      {/* ── Footer Info ── */}
      <div className="bg-muted/50 border rounded-lg p-5">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          About This Catalog
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">📌 Important</p>
            <ul className="space-y-1 list-disc list-inside text-[11px]">
              <li>Core Identity is system-controlled</li>
              <li>New products must be requested</li>
              <li>Duplicate identity not allowed</li>
              <li>SKU is auto-generated &amp; immutable</li>
            </ul>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">✔ What you can do</p>
            <ul className="space-y-1 list-disc list-inside text-[11px]">
              <li>Browse all available products</li>
              <li>Add products to your inventory</li>
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
              Each warehouse can browse the full catalog and add variants to
              their inventory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
