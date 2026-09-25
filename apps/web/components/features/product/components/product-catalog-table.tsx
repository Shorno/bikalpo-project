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
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Loader2,
  PackagePlus,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useDeferredValue,
  useId,
  useMemo,
  useState,
} from "react";
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
  compact = false,
}: {
  column: Column<CatalogProduct, unknown>;
  label: string;
  compact?: boolean;
}) {
  const direction = column.getIsSorted();
  const SortIcon = direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      aria-label={`Sort by ${label}`}
      className={
        compact
          ? "flex min-h-11 w-full min-w-0 items-center gap-1 rounded-sm text-left font-medium hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          : "inline-flex items-center gap-1.5 font-medium hover:text-foreground"
      }
      onClick={column.getToggleSortingHandler()}
    >
      <span className="min-w-0">{label}</span>
      {compact && direction ? (
        <SortIcon className="size-3 shrink-0" aria-hidden="true" />
      ) : !compact ? (
        <ArrowUpDown
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
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
  const columns = useMemo<ColumnDef<CatalogProduct>[]>(
    () => [
      {
        id: "productId",
        accessorFn: productIdLabel,
        header: ({ column }) => (
          <SortableHeader column={column} label="ID" compact={isMobile} />
        ),
        cell: ({ row }) => productIdLabel(row.original),
      },
      {
        id: "type",
        accessorFn: (product) => product.category?.type?.name ?? "Unassigned",
        header: ({ column }) => (
          <SortableHeader column={column} label="Type" compact={isMobile} />
        ),
        filterFn: (row, _columnId, value) =>
          String(row.original.category?.type?.id ?? "") === String(value),
      },
      {
        id: "category",
        accessorFn: (product) => product.category?.name ?? "Uncategorized",
        header: ({ column }) => (
          <SortableHeader column={column} label="Category" compact={isMobile} />
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
          <SortableHeader
            column={column}
            label="Product Name"
            compact={isMobile}
          />
        ),
        cell: ({ row }) =>
          isMobile ? (
            <Link
              href={`${ADMIN_BASE}/products/${row.original.id}`}
              className="block min-h-7 rounded-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {row.original.name}
            </Link>
          ) : (
            row.original.name
          ),
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
    [isMobile],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility: { subCategory: !isMobile, actions: !isMobile },
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
  const visibleColumnCount = table.getVisibleLeafColumns().length;

  return (
    <div className="@container/catalog min-w-0 space-y-4 md:space-y-5">
      <section
        aria-label="Product filters"
        className="rounded-xl border bg-card p-4 shadow-sm max-md:p-3"
      >
        <div className="relative mb-4 w-full md:w-2/3">
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <FilterSelect
            compact={isMobile}
            label="Type"
            value={typeFilter}
            options={typeOptions}
            onValueChange={(value) =>
              updateFilter("type", value, ["category", "subCategory"])
            }
          />
          <FilterSelect
            compact={isMobile}
            label="Category"
            value={categoryFilter}
            options={categoryOptions}
            onValueChange={(value) =>
              updateFilter("category", value, ["subCategory"])
            }
          />
          <div className="col-span-2 min-w-0 md:col-span-1">
            <FilterSelect
              compact={isMobile}
              label="Sub Category"
              value={subCategoryFilter}
              options={subCategoryOptions}
              onValueChange={(value) => updateFilter("subCategory", value)}
            />
          </div>
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
          <Button
            asChild
            variant="outline"
            size="sm"
            className="max-md:min-h-11"
          >
            <Link href={`${ADMIN_BASE}/setup-requests`}>
              <Clock3 className="size-4" />
              Requests
            </Link>
          </Button>
          <Button asChild size="sm" className="max-md:min-h-11">
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
          <Table
            className={
              isMobile
                ? "table-fixed text-[11px] leading-4 @xs/catalog:text-xs"
                : "min-w-[760px]"
            }
          >
            <caption className="sr-only">Product catalog</caption>
            {isMobile ? (
              <colgroup>
                <col className="w-[21%] @xs/catalog:w-[26%]" />
                <col className="w-[24%] @xs/catalog:w-[22%]" />
                <col className="w-[29%] @xs/catalog:w-[26%]" />
                <col className="w-[26%]" />
              </colgroup>
            ) : null}
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      scope="col"
                      aria-sort={
                        header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : "none"
                      }
                      className={
                        isMobile
                          ? "whitespace-normal break-words px-1 @sm/catalog:px-2"
                          : header.column.id === "productId"
                            ? "w-36"
                            : header.column.id === "actions"
                              ? "text-right"
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
                <StatusRow colSpan={visibleColumnCount}>
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading catalog…
                  </span>
                </StatusRow>
              ) : isError ? (
                <StatusRow colSpan={visibleColumnCount}>
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
                <StatusRow colSpan={visibleColumnCount} tall>
                  <div className="flex flex-col items-center">
                    <PackagePlus className="size-8 text-muted-foreground" />
                    <p className="mt-3 font-medium">No products yet</p>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      Create a product with its brand and variant configuration
                      to add it to the catalog.
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
                <StatusRow colSpan={visibleColumnCount}>
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium">No products found</p>
                      <p className="text-sm text-muted-foreground">
                        Try a different search or filter.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </div>
                </StatusRow>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const productHref = `${ADMIN_BASE}/products/${row.original.id}`;
                  return (
                    <TableRow
                      key={row.id}
                      onClick={(event) => {
                        if (
                          isMobile &&
                          !(event.target as HTMLElement).closest("a, button")
                        ) {
                          router.push(productHref);
                        }
                      }}
                      className="max-md:cursor-pointer"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={
                            isMobile
                              ? `whitespace-normal break-words px-1 py-2 align-top [overflow-wrap:anywhere] @sm/catalog:px-2 ${
                                  cell.column.id === "productId"
                                    ? "font-mono text-[10px] font-medium tabular-nums @xs/catalog:text-[11px]"
                                    : ""
                                }`
                              : cell.column.id === "productId"
                                ? "font-mono text-sm font-medium tabular-nums"
                                : cell.column.id === "product"
                                  ? "font-medium"
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
        </section>

        {!isLoading && !isError && data.length > 0 ? (
          <nav
            aria-label="Catalog pagination"
            className={
              isMobile
                ? "flex flex-wrap items-center justify-between gap-3 text-sm"
                : "flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            }
          >
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {firstRow}–{lastRow} of {filteredCount}
            </p>
            <div
              className={
                isMobile
                  ? "flex flex-wrap items-center gap-2"
                  : "flex items-center justify-between gap-2 sm:justify-end"
              }
            >
              <Select
                value={String(pagination.pageSize)}
                onValueChange={(value) =>
                  setPagination({ pageIndex: 0, pageSize: Number(value) })
                }
              >
                <SelectTrigger
                  aria-label="Rows per page"
                  className={
                    isMobile
                      ? "w-24 shadow-none data-[size=default]:h-11"
                      : "h-11 w-28 shadow-none sm:h-9"
                  }
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
                aria-label="Previous page"
                title="Previous page"
                className={isMobile ? "h-11 w-11 p-0" : "h-11 sm:h-9"}
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
                variant="outline"
              >
                {isMobile ? (
                  <ChevronLeft className="size-4" aria-hidden="true" />
                ) : (
                  "Previous"
                )}
              </Button>
              <span className="min-w-16 text-center font-mono text-xs tabular-nums text-muted-foreground max-md:min-w-10">
                {currentPage} / {pageCount}
              </span>
              <Button
                aria-label="Next page"
                title="Next page"
                className={isMobile ? "h-11 w-11 p-0" : "h-11 sm:h-9"}
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
                variant="outline"
              >
                {isMobile ? (
                  <ChevronRight className="size-4" aria-hidden="true" />
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

function FilterSelect({
  compact,
  label,
  value,
  options,
  onValueChange,
}: {
  compact: boolean;
  label: string;
  value: string;
  options: FilterOption[];
  onValueChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="space-y-1.5 max-md:min-w-0">
      <Label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          className={
            compact
              ? "w-full min-w-0 text-xs data-[size=default]:h-11 [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
              : "w-full"
          }
        >
          <SelectValue placeholder={`All ${label}`} />
        </SelectTrigger>
        <SelectContent
          position={compact ? "popper" : "item-aligned"}
          align={compact ? "start" : "center"}
          className="max-md:max-w-[calc(100vw-2rem)]"
        >
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((option) => (
            <SelectItem
              key={option.id}
              value={String(option.id)}
              className="max-md:min-h-9 max-md:whitespace-normal max-md:break-words"
            >
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
        className={`${tall ? "h-52" : "h-36"} text-center max-md:whitespace-normal max-md:break-words`}
      >
        {children}
      </TableCell>
    </TableRow>
  );
}
