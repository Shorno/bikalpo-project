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
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
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

type MobileRowDefinition<TData> = {
  href?: (row: TData) => string;
  onSelect?: (row: TData) => void;
  title: (row: TData) => ReactNode;
  description?: (row: TData) => ReactNode;
  meta?: (row: TData) => ReactNode[];
  status?: (row: TData) => ReactNode;
  columns?: Array<{
    id: string;
    label: string;
    width: string;
    cell?: (row: TData) => ReactNode;
  }>;
  primaryColumn?: string;
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
  const router = useRouter();
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

  const footer = (
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between max-md:flex-row max-md:flex-wrap max-md:items-center max-md:justify-between">
      <p className="font-mono text-xs tabular-nums text-muted-foreground">
        {totalItems === 0 ? 0 : (effectivePage - 1) * effectivePageSize + 1}–
        {Math.min(effectivePage * effectivePageSize, totalItems)} of{" "}
        {totalItems}
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end max-md:flex-wrap">
        <Select
          onValueChange={(value) => {
            changePageSize(Number(value));
            changePage(1);
          }}
          value={String(effectivePageSize)}
        >
          <SelectTrigger
            aria-label="Rows per page"
            className="h-11 w-28 shadow-none sm:h-9 max-md:w-24 max-md:data-[size=default]:h-11"
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
          aria-label="Previous page"
          className="h-11 md:h-9 max-md:w-11 max-md:p-0"
          disabled={effectivePage <= 1}
          onClick={() => changePage(effectivePage - 1)}
          variant="outline"
        >
          <span className="md:hidden">
            <ChevronLeft aria-hidden="true" className="size-4" />
          </span>
          <span className="max-md:hidden">Previous</span>
        </Button>
        <span className="min-w-16 text-center font-mono text-xs tabular-nums text-muted-foreground max-md:min-w-10">
          {effectivePage} / {pageCount}
        </span>
        <Button
          aria-label="Next page"
          className="h-11 md:h-9 max-md:w-11 max-md:p-0"
          disabled={effectivePage >= pageCount}
          onClick={() => changePage(effectivePage + 1)}
          variant="outline"
        >
          <span className="max-md:hidden">Next</span>
          <span className="md:hidden">
            <ChevronRight aria-hidden="true" className="size-4" />
          </span>
        </Button>
      </div>
    </div>
  );

  const mobileColumns =
    mobile.columns ??
    table.getVisibleLeafColumns().map((column) => ({
      id: column.id,
      label:
        typeof column.columnDef.header === "string"
          ? column.columnDef.header
          : column.id,
      width: `${100 / table.getVisibleLeafColumns().length}%`,
      cell: undefined,
    }));
  const mobileTable = (
    <div className="@container/setup-table overflow-hidden rounded-xl border bg-card shadow-sm md:hidden">
      <Table className="table-fixed text-[11px] leading-4 @xs/setup-table:text-xs">
        <caption className="sr-only">Setup records</caption>
        <colgroup>
          {mobileColumns.map((column) => (
            <col key={column.id} style={{ width: column.width }} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow>
            {mobileColumns.map((definition) => {
              const column = table.getColumn(definition.id);
              if (!column) return null;
              const sorted = column.getIsSorted();
              return (
                <TableHead
                  key={definition.id}
                  scope="col"
                  aria-sort={
                    sorted === "asc"
                      ? "ascending"
                      : sorted === "desc"
                        ? "descending"
                        : "none"
                  }
                  className="h-11 whitespace-normal break-words px-1 text-[11px] font-medium"
                >
                  {column.getCanSort() ? (
                    <button
                      type="button"
                      aria-label={`Sort by ${definition.label}`}
                      onClick={column.getToggleSortingHandler()}
                      className="flex min-h-11 w-full min-w-0 items-center gap-0.5 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className="min-w-0">{definition.label}</span>
                      {sorted === "asc" ? (
                        <ArrowUp
                          aria-hidden="true"
                          className="size-3 shrink-0"
                        />
                      ) : sorted === "desc" ? (
                        <ArrowDown
                          aria-hidden="true"
                          className="size-3 shrink-0"
                        />
                      ) : null}
                    </button>
                  ) : (
                    definition.label
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              className="h-11 cursor-pointer hover:bg-muted/30"
              key={row.id}
              onClick={(event) => {
                if (
                  (event.target as Element).closest(
                    "a, button, [role=menuitem]",
                  )
                )
                  return;
                if (mobile.href) router.push(mobile.href(row.original));
                else mobile.onSelect?.(row.original);
              }}
            >
              {mobileColumns.map((definition) => {
                const cell = row
                  .getAllCells()
                  .find((item) => item.column.id === definition.id);
                if (!cell) return null;
                const content = definition.cell
                  ? definition.cell(row.original)
                  : flexRender(cell.column.columnDef.cell, cell.getContext());
                return (
                  <TableCell
                    key={cell.id}
                    className={`whitespace-normal break-words px-1 py-2 align-top [overflow-wrap:anywhere] [&_span]:[font-size:inherit] [&_p]:[font-size:inherit] [&_a]:block [&_a]:min-h-7 [&_a]:text-primary [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-ring [&_[data-slot=badge]]:max-w-full [&_[data-slot=badge]]:whitespace-normal [&_[data-slot=badge]]:px-1 [&_[data-slot=badge]]:text-[10px] ${definition.id === "skuCode" || definition.id === "composedSku" ? "text-[10px] @xs/setup-table:text-[11px]" : ""} ${definition.id === "actions" ? "px-0.5 [&_button]:size-11" : ""}`}
                  >
                    {definition.id === mobile.primaryColumn &&
                    mobile.onSelect ? (
                      <button
                        type="button"
                        onClick={() => mobile.onSelect?.(row.original)}
                        className="block min-h-7 w-full rounded-sm text-left text-primary focus-visible:outline-2 focus-visible:outline-ring"
                        aria-label={`Review ${String(mobile.title(row.original))}`}
                      >
                        {content}
                      </button>
                    ) : (
                      content
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          {data.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={mobileColumns.length}
                className="h-40 whitespace-normal break-words px-4 py-6 text-center"
              >
                <h2 className="text-sm font-semibold">{emptyTitle}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {emptyDescription}
                </p>
                {emptyAction && <div className="mt-4">{emptyAction}</div>}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (data.length === 0) {
    return (
      <div className="min-w-0 space-y-4">
        <div className="hidden min-h-64 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center shadow-sm md:flex">
          <h2 className="text-sm font-semibold">{emptyTitle}</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {emptyDescription}
          </p>
          {emptyAction && <div className="mt-4">{emptyAction}</div>}
        </div>
        {mobileTable}
        {footer}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm md:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      className="h-10 whitespace-nowrap text-sm font-medium text-foreground"
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
                <TableRow className="h-11 hover:bg-muted/30" key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell className="py-2" key={cell.id}>
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

      {mobileTable}

      {footer}
    </div>
  );
}
