"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { parseAsInteger, useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type MobileRowDefinition<TData> = {
  href?: (row: TData) => string;
  onSelect?: (row: TData) => void;
  title: (row: TData) => ReactNode;
  description?: (row: TData) => ReactNode;
  meta?: (row: TData) => ReactNode[];
  status?: (row: TData) => ReactNode;
};

type SetupEntityTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
  getRowId?: (row: TData) => string;
  mobile: MobileRowDefinition<TData>;
  pageSizeOptions?: number[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
};

export function SetupEntityTable<TData, TValue>({
  columns,
  data,
  emptyTitle,
  emptyDescription,
  emptyAction,
  getRowId,
  mobile,
  pageSizeOptions = [10, 20, 50],
  pagination,
}: SetupEntityTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [urlPage, setUrlPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
  );
  const [urlPageSize, setUrlPageSize] = useQueryState(
    "size",
    parseAsInteger.withDefault(pageSizeOptions[0] ?? 10).withOptions({
      clearOnDefault: true,
    }),
  );
  const defaultPageSize = pageSizeOptions[0] ?? 10;
  const requestedPage = pagination?.page ?? urlPage;
  const requestedPageSize = pagination?.pageSize ?? urlPageSize;
  const effectivePageSize = pageSizeOptions.includes(requestedPageSize)
    ? requestedPageSize
    : defaultPageSize;
  const effectivePage = Math.max(1, requestedPage);
  const totalItems = pagination?.total ?? data.length;

  const pageCount = Math.max(1, Math.ceil(totalItems / effectivePageSize));

  const changePage = useCallback(
    (nextPage: number) => {
      if (pagination) pagination.onPageChange(nextPage);
      else void setUrlPage(nextPage);
    },
    [pagination, setUrlPage],
  );
  const changePageSize = useCallback(
    (nextPageSize: number) => {
      if (pagination) pagination.onPageSizeChange(nextPageSize);
      else void setUrlPageSize(nextPageSize);
    },
    [pagination, setUrlPageSize],
  );

  useEffect(() => {
    if (requestedPage < 1) changePage(1);
    else if (requestedPage > pageCount) changePage(pageCount);
    if (!pageSizeOptions.includes(requestedPageSize)) {
      changePageSize(defaultPageSize);
    }
  }, [
    defaultPageSize,
    changePage,
    changePageSize,
    pageCount,
    pageSizeOptions,
    requestedPage,
    requestedPageSize,
  ]);

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: pagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
    manualPagination: Boolean(pagination),
    onSortingChange: setSorting,
    pageCount,
    state: {
      pagination: {
        pageIndex: effectivePage - 1,
        pageSize: effectivePageSize,
      },
      sorting,
    },
  });

  if (data.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
        <h2 className="text-sm font-semibold">{emptyTitle}</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {emptyDescription}
        </p>
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      className="h-11 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      key={header.id}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className="flex min-h-9 items-center gap-1.5 rounded px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {header.column.getIsSorted() === "asc" ? (
                            <ArrowUp aria-hidden="true" className="size-3.5" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ArrowDown
                              aria-hidden="true"
                              className="size-3.5"
                            />
                          ) : (
                            <ChevronsUpDown
                              aria-hidden="true"
                              className="size-3.5 opacity-50"
                            />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow className="h-12 hover:bg-muted/30" key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell className="py-2.5" key={cell.id}>
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
      </div>

      <div className="divide-y overflow-hidden rounded-lg border md:hidden">
        {table.getRowModel().rows.map((tableRow, index) => {
          const row = tableRow.original;
          const meta = mobile.meta?.(row) ?? [];
          const content = (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold">
                    {mobile.title(row)}
                  </div>
                  {mobile.status?.(row)}
                </div>
                {mobile.description && (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {mobile.description(row)}
                  </div>
                )}
                {meta.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {meta.map((item, metaIndex) => (
                      <span key={metaIndex}>{item}</span>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </>
          );
          const className =
            "group flex min-h-20 w-full items-center gap-3 p-4 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";
          return mobile.href ? (
            <Link
              className={className}
              href={mobile.href(row)}
              key={getRowId?.(row) ?? index}
            >
              {content}
            </Link>
          ) : (
            <button
              className={className}
              key={getRowId?.(row) ?? index}
              onClick={() => mobile.onSelect?.(row)}
              type="button"
            >
              {content}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {totalItems === 0 ? 0 : (effectivePage - 1) * effectivePageSize + 1}–
          {Math.min(effectivePage * effectivePageSize, totalItems)} of{" "}
          {totalItems}
        </p>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Select
            onValueChange={(value) => {
              changePageSize(Number(value));
              changePage(1);
            }}
            value={String(effectivePageSize)}
          >
            <SelectTrigger
              aria-label="Rows per page"
              className="h-11 w-28 shadow-none sm:h-9"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="h-11 sm:h-9"
            disabled={effectivePage <= 1}
            onClick={() => changePage(effectivePage - 1)}
            variant="outline"
          >
            Previous
          </Button>
          <span
            className={cn(
              "min-w-16 text-center font-mono text-xs tabular-nums text-muted-foreground",
            )}
          >
            {effectivePage} / {pageCount}
          </span>
          <Button
            className="h-11 sm:h-9"
            disabled={effectivePage >= pageCount}
            onClick={() => changePage(effectivePage + 1)}
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
