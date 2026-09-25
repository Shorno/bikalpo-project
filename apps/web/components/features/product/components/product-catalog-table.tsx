"use client";

import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Clock3,
  Eye,
  Loader2,
  PackagePlus,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useDeferredValue, useMemo, useState } from "react";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { ADMIN_BASE } from "@/lib/routes";

const ALL = "all";
const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50];

export type CatalogProduct = {
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

type ProductCatalogTableProps = {
  data: CatalogProduct[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function productIdLabel(product: CatalogProduct) {
  return product.sku?.trim() || `#${product.id}`;
}

function uniqueOptions(items: Array<FilterOption | null | undefined>) {
  const options = new Map<number, string>();
  for (const item of items) {
    if (item) options.set(item.id, item.name);
  }

  return Array.from(options, ([id, name]) => ({ id, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function SortableHeader({
  column,
  label,
  align = "left",
}: {
  column: Column<CatalogProduct, unknown>;
  label: string;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 font-medium hover:text-foreground ${
        align === "right" ? "ml-auto" : ""
      }`}
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      <ArrowUpDown className="size-3.5 text-muted-foreground" />
    </button>
  );
}

export default function ProductCatalogTable({
  data,
  isLoading,
  isError,
  onRetry,
}: ProductCatalogTableProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });

  const filterValue = (columnId: string) =>
    String(
      columnFilters.find((filter) => filter.id === columnId)?.value ?? ALL,
    );
  const typeFilter = filterValue("type");
  const categoryFilter = filterValue("category");
  const subCategoryFilter = filterValue("subCategory");
  const productFilter = filterValue("product");

  const typeOptions = useMemo(
    () => uniqueOptions(data.map((product) => product.category?.type)),
    [data],
  );
  const categoryOptions = useMemo(
    () =>
      uniqueOptions(
        data
          .filter(
            (product) =>
              typeFilter === ALL ||
              String(product.category?.type?.id ?? "") === typeFilter,
          )
          .map((product) => product.category),
      ),
    [data, typeFilter],
  );
  const subCategoryOptions = useMemo(
    () =>
      uniqueOptions(
        data
          .filter(
            (product) =>
              (typeFilter === ALL ||
                String(product.category?.type?.id ?? "") === typeFilter) &&
              (categoryFilter === ALL ||
                String(product.categoryId) === categoryFilter),
          )
          .map((product) => product.subCategory),
      ),
    [categoryFilter, data, typeFilter],
  );
  const productOptions = useMemo(
    () =>
      uniqueOptions(
        data
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
    [categoryFilter, data, subCategoryFilter, typeFilter],
  );

  const columns = useMemo<ColumnDef<CatalogProduct>[]>(
    () => [
      {
        id: "productId",
        accessorFn: productIdLabel,
        header: ({ column }) => <SortableHeader column={column} label="ID" />,
        cell: ({ row }) => productIdLabel(row.original),
      },
      {
        id: "type",
        accessorFn: (product) => product.category?.type?.name ?? "Unassigned",
        header: ({ column }) => <SortableHeader column={column} label="Type" />,
        filterFn: (row, _columnId, value) =>
          String(row.original.category?.type?.id ?? "") === String(value),
      },
      {
        id: "category",
        accessorFn: (product) => product.category?.name ?? "Uncategorized",
        header: ({ column }) => (
          <SortableHeader column={column} label="Category" />
        ),
        filterFn: (row, _columnId, value) =>
          String(row.original.categoryId) === String(value),
      },
      {
        id: "subCategory",
        accessorFn: (product) => product.subCategory?.name ?? "None",
        header: ({ column }) => (
          <SortableHeader column={column} label="Sub Category" />
        ),
        cell: ({ row }) =>
          row.original.subCategory?.name ?? (
            <span className="text-muted-foreground">None</span>
          ),
        filterFn: (row, _columnId, value) =>
          String(row.original.subCategoryId ?? "") === String(value),
      },
      {
        id: "product",
        accessorFn: (product) => product.name,
        header: ({ column }) => (
          <SortableHeader column={column} label="Product Name" />
        ),
        filterFn: (row, _columnId, value) =>
          String(row.original.id) === String(value),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" asChild>
              <Link href={`${ADMIN_BASE}/products/${row.original.id}`}>
                <Eye className="size-4" />
                View
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: deferredSearch,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    globalFilterFn: (row, _columnId, value) =>
      [
        productIdLabel(row.original),
        row.original.name,
        row.original.category?.type?.name,
        row.original.category?.name,
        row.original.subCategory?.name,
      ]
        .map((field) => normalize(field))
        .join(" ")
        .includes(normalize(String(value))),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (product) => String(product.id),
  });

  const updateFilter = (
    columnId: string,
    value: string,
    dependentColumnIds: string[] = [],
  ) => {
    setColumnFilters((current) => {
      const next = current.filter(
        (filter) =>
          filter.id !== columnId && !dependentColumnIds.includes(filter.id),
      );
      return value === ALL ? next : [...next, { id: columnId, value }];
    });
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  const clearFilters = () => {
    setSearch("");
    setColumnFilters([]);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  };

  const hasFilters = search.trim().length > 0 || columnFilters.length > 0;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(1, table.getPageCount());
  const currentPage = table.getState().pagination.pageIndex + 1;
  const firstRow =
    filteredCount === 0 ? 0 : (currentPage - 1) * pagination.pageSize + 1;
  const lastRow = Math.min(currentPage * pagination.pageSize, filteredCount);

  return (
    <>
      <section
        aria-label="Product filters"
        className="rounded-xl border bg-card p-4 shadow-sm"
      >
        <div className="relative mb-4 w-full sm:w-2/3">
          <Search
            className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="product-catalog-search"
            aria-label="Search products"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              table.setPageIndex(0);
            }}
            placeholder="Search products..."
            className="h-11 pl-10"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Type"
            value={typeFilter}
            options={typeOptions}
            onValueChange={(value) =>
              updateFilter("type", value, [
                "category",
                "subCategory",
                "product",
              ])
            }
          />
          <FilterSelect
            label="Category"
            value={categoryFilter}
            options={categoryOptions}
            onValueChange={(value) =>
              updateFilter("category", value, ["subCategory", "product"])
            }
          />
          <FilterSelect
            label="Sub Category"
            value={subCategoryFilter}
            options={subCategoryOptions}
            onValueChange={(value) =>
              updateFilter("subCategory", value, ["product"])
            }
          />
          <FilterSelect
            label="Product Name"
            value={productFilter}
            options={productOptions}
            onValueChange={(value) => updateFilter("product", value)}
          />
        </div>
        {hasFilters ? (
          <div className="mt-4 flex justify-end border-t pt-3">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" />
              Clear filters
            </Button>
          </div>
        ) : null}
      </section>

      <div className="flex justify-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`${ADMIN_BASE}/setup-requests`}>
              <Clock3 className="size-4" />
              Requests
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`${ADMIN_BASE}/products/new`}>
              <PackagePlus className="size-4" />
              Create Product
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <section
          aria-label="Products"
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={
                          header.column.id === "productId"
                            ? "w-36"
                            : header.column.id === "actions"
                              ? "hidden text-right md:table-cell"
                              : undefined
                        }
                      >
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
                  <StatusRow colSpan={columns.length}>
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading catalog…
                    </span>
                  </StatusRow>
                ) : isError ? (
                  <StatusRow colSpan={columns.length}>
                    <div className="space-y-3">
                      <div>
                        <p className="font-medium">Could not load products</p>
                        <p className="text-sm text-muted-foreground">
                          Please retry the catalog request.
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={onRetry}>
                        Try again
                      </Button>
                    </div>
                  </StatusRow>
                ) : data.length === 0 ? (
                  <StatusRow colSpan={columns.length} tall>
                    <div className="flex flex-col items-center">
                      <PackagePlus className="size-8 text-muted-foreground" />
                      <p className="mt-3 font-medium">No products yet</p>
                      <p className="mt-1 max-w-md text-sm text-muted-foreground">
                        Create a product with its brand and variant
                        configuration to add it to the catalog.
                      </p>
                      <Button asChild size="sm" className="mt-4">
                        <Link href={`${ADMIN_BASE}/products/new`}>
                          <PackagePlus className="size-4" />
                          Create Product
                        </Link>
                      </Button>
                    </div>
                  </StatusRow>
                ) : table.getRowModel().rows.length === 0 ? (
                  <StatusRow colSpan={columns.length}>
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
                  </StatusRow>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    const productHref = `${ADMIN_BASE}/products/${row.original.id}`;
                    const openProduct = () => {
                      if (isMobile) router.push(productHref);
                    };

                    return (
                      <TableRow
                        key={row.id}
                        role={isMobile ? "link" : undefined}
                        tabIndex={isMobile ? 0 : undefined}
                        aria-label={
                          isMobile ? `View ${row.original.name}` : undefined
                        }
                        onClick={openProduct}
                        onKeyDown={(event) => {
                          if (
                            isMobile &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            event.preventDefault();
                            router.push(productHref);
                          }
                        }}
                        className="max-md:cursor-pointer max-md:focus-visible:bg-muted/60 max-md:focus-visible:outline-none"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={
                              cell.column.id === "productId"
                                ? "font-mono text-sm font-medium tabular-nums"
                                : cell.column.id === "product"
                                  ? "font-medium"
                                  : cell.column.id === "actions"
                                    ? "hidden md:table-cell"
                                    : undefined
                            }
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {!isLoading && !isError && data.length > 0 ? (
          <nav
            aria-label="Catalog pagination"
            className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {firstRow}–{lastRow} of {filteredCount}
            </p>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) =>
                  setPagination({ pageIndex: 0, pageSize: Number(value) })
                }
              >
                <SelectTrigger
                  aria-label="Rows per page"
                  className="h-11 w-28 shadow-none sm:h-9"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} rows
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="h-11 sm:h-9"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
                variant="outline"
              >
                Previous
              </Button>
              <span className="min-w-16 text-center font-mono text-xs tabular-nums text-muted-foreground">
                {currentPage} / {pageCount}
              </span>
              <Button
                className="h-11 sm:h-9"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
                variant="outline"
              >
                Next
              </Button>
            </div>
          </nav>
        ) : null}
      </div>
    </>
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

function StatusRow({
  colSpan,
  tall = false,
  children,
}: {
  colSpan: number;
  tall?: boolean;
  children: ReactNode;
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className={`${tall ? "h-52" : "h-36"} text-center`}
      >
        {children}
      </TableCell>
    </TableRow>
  );
}
