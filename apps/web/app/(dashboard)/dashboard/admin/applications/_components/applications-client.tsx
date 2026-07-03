"use client";

import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { orpc } from "@/utils/orpc";
import {
  applicationColumns,
  type ApplicationRow,
} from "./application-columns";

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type TypeFilter = "all" | "seller" | "warehouse";
type ReferralFilter = "all" | "direct" | "invited";

const PAGE_SIZE = 20;

const statusFilters: {
  key: StatusFilter;
  label: string;
  overviewKey: "total" | "pending" | "approved" | "rejected";
}[] = [
  { key: "all", label: "All", overviewKey: "total" },
  { key: "pending", label: "Pending", overviewKey: "pending" },
  { key: "approved", label: "Approved", overviewKey: "approved" },
  { key: "rejected", label: "Rejected", overviewKey: "rejected" },
];

function generatePageNumbers(
  current: number,
  total: number,
): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export function ApplicationsClient() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [referral, setReferral] = useState<ReferralFilter>("all");
  const [district, setDistrict] = useState("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [search]);

  const { data: overview } = useQuery({
    ...orpc.adminApplication.getOverview.queryOptions(),
  });

  const { data: filterOptions } = useQuery({
    ...orpc.adminApplication.getFilterOptions.queryOptions(),
  });

  const listInput = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status,
      type,
      referral,
      district: district !== "all" ? district : undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, status, type, referral, district, page],
  );

  const { data: listData, isLoading, isError } = useQuery({
    ...orpc.adminApplication.list.queryOptions({ input: listInput }),
  });

  const items = (listData?.items ?? []) as ApplicationRow[];
  const totalCount = listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const showFrom = totalCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(page * PAGE_SIZE, totalCount);

  const table = useReactTable({
    data: items,
    columns: applicationColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  const selectStatus = (next: StatusFilter) => {
    setStatus(next);
    setPage(1);
  };

  const counts: Record<StatusFilter, number> = {
    all: overview?.total ?? 0,
    pending: overview?.pending ?? 0,
    approved: overview?.approved ?? 0,
    rejected: overview?.rejected ?? 0,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Applications
            </h1>
            {(overview?.pending ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {overview?.pending} awaiting review
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Review seller and warehouse registration requests in one place
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="inline-flex w-full max-w-2xl flex-wrap gap-1 rounded-lg border bg-muted/20 p-1">
          {statusFilters.map((tab) => {
            const isActive = status === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectStatus(tab.key)}
                className={cn(
                  "inline-flex min-w-[5.5rem] flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-background font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {counts[tab.key].toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
        {overview && overview.pending > 0 && (
          <p className="text-xs text-muted-foreground">
            Pending: {overview.pendingSeller} seller, {overview.pendingWarehouse}{" "}
            warehouse
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name / Phone / Request ID..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v as TypeFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="seller">Seller</SelectItem>
              <SelectItem value="warehouse">Warehouse</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={district}
            onValueChange={(v) => {
              setDistrict(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {(filterOptions?.districts ?? []).map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={referral}
            onValueChange={(v) => {
              setReferral(v as ReferralFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Referral" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Referral</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-5 w-20 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <h2 className="mt-3 font-semibold">Failed to load applications</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try refreshing or adjusting your filters.
              </p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="mt-3 font-semibold">No applications found</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Applications matching your current filters will appear here.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="bg-muted/30 hover:bg-muted/30"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="px-4 text-xs font-semibold uppercase tracking-wider"
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
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
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
        )}

        {!isLoading && !isError && totalCount > 0 && (
          <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {showFrom}–{showTo} of {totalCount} applications
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {generatePageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`dot-${i}`} className="px-1 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => setPage(p as number)}
                  >
                    {p}
                  </Button>
                ),
              )}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
