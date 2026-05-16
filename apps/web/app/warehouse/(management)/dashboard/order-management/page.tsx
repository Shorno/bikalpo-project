"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
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
  Inbox,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { type OrderRow, getColumnsForSource } from "./_components/order-columns";

/* ── Constants ───────────────────────────────────────────── */

type Source = "all" | "direct" | "salesman" | "estimate" | "pre_order";
type StatusFilter = "all" | "pending" | "accepted" | "processing" | "rejected";
type PaymentFilter = "all" | "paid" | "due" | "partial";
type DateFilter = "today" | "this_month" | "custom" | "all";

const sourceConfig: {
  key: Source;
  label: string;
  emoji: string;
  enabled: boolean;
  color: string;
  activeColor: string;
  description: string;
}[] = [
  {
    key: "all",
    label: "All",
    emoji: "📦",
    enabled: true,
    color: "text-foreground",
    activeColor: "border-gray-200 bg-gray-50 ring-gray-100",
    description: "All order types",
  },
  {
    key: "direct",
    label: "Direct",
    emoji: "🔴",
    enabled: true,
    color: "text-red-600",
    activeColor: "border-red-200 bg-red-50 ring-red-100",
    description: "Retailer checkout",
  },
  {
    key: "salesman",
    label: "Salesman",
    emoji: "🔵",
    enabled: false,
    color: "text-blue-600",
    activeColor: "border-blue-200 bg-blue-50 ring-blue-100",
    description: "Field sales flow",
  },
  {
    key: "estimate",
    label: "Estimate",
    emoji: "🟣",
    enabled: false,
    color: "text-violet-600",
    activeColor: "border-violet-200 bg-violet-50 ring-violet-100",
    description: "Quote conversions",
  },
  {
    key: "pre_order",
    label: "Pre-Order",
    emoji: "🟡",
    enabled: false,
    color: "text-amber-600",
    activeColor: "border-amber-200 bg-amber-50 ring-amber-100",
    description: "Advance payment",
  },
];

const sourceDescriptions: Record<Source, { title: string; subtitle: string }> = {
  all: {
    title: "All Orders",
    subtitle: "Showing all order types · Direct, Salesman, Estimate, Pre-Order",
  },
  direct: {
    title: "Direct Orders",
    subtitle: "Customer directly placed order · No salesman assigned",
  },
  salesman: {
    title: "Salesman Orders",
    subtitle: "Customer assigned under salesman · Order created manually by salesman",
  },
  estimate: {
    title: "Estimate Converted Orders",
    subtitle: "Estimate approved by customer · Auto converted into order",
  },
  pre_order: {
    title: "Pre-Orders",
    subtitle: "Customer paid advance/full payment before processing",
  },
};

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "processing", label: "Processing" },
  { value: "rejected", label: "Rejected" },
];

const paymentOptions = [
  { value: "all", label: "All Payment" },
  { value: "paid", label: "Paid" },
  { value: "due", label: "Due" },
];

const dateOptions = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "this_month", label: "This Month" },
];

/* ── Page ────────────────────────────────────────────────── */

export default function WarehouseOrderManagementPage() {
  const [source, setSource] = useState<Source>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [dateRange, setDateRange] = useState<DateFilter>("all");

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Debounce search
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [search]);

  // Reset page on filter change
  const resetPage = useCallback(() => setPage(1), []);
  useEffect(resetPage, [source, status, payment, dateRange, debouncedSearch, resetPage]);

  const queryInput = useMemo(
    () => ({
      source,
      status,
      payment,
      dateRange,
      search: debouncedSearch || undefined,
      page,
      limit: 20,
    }),
    [source, status, payment, dateRange, debouncedSearch, page],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["warehouse", "order-management", queryInput],
    queryFn: () => orpc.warehouse.getOrderOverview.call(queryInput),
  });

  const orders = (data?.orders ?? []) as OrderRow[];
  const pagination = data?.pagination;
  const summary = data?.summary ?? { direct: 0, salesman: 0, estimate: 0, preOrder: 0 };
  const counts: Record<Source, number> = {
    all: summary.direct + summary.salesman + summary.estimate + summary.preOrder,
    direct: summary.direct,
    salesman: summary.salesman,
    estimate: summary.estimate,
    pre_order: summary.preOrder,
  };

  const columns = useMemo(() => getColumnsForSource(source), [source]);

  const table = useReactTable({
    data: orders,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
    pageCount: pagination?.totalPages ?? 1,
  });

  const totalPages = pagination?.totalPages ?? 1;
  const totalCount = pagination?.totalCount ?? 0;
  const showFrom = totalCount > 0 ? (page - 1) * 20 + 1 : 0;
  const showTo = Math.min(page * 20, totalCount);
  const currentSource = sourceConfig.find((s) => s.key === source)!;
  const desc = sourceDescriptions[source];

  return (
    <div className="space-y-5">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Order Management
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data?.warehouse?.label ?? "Warehouse"} · Review and manage retailer orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/warehouse/dashboard/dispatch-orders"
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Truck className="h-4 w-4" />
            Dispatch Board
          </Link>
        </div>
      </div>

      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {sourceConfig.map((cfg) => {
          const isActive = source === cfg.key;
          return (
            <button
              key={cfg.key}
              type="button"
              disabled={!cfg.enabled}
              onClick={() => setSource(cfg.key)}
              className={cn(
                "group relative overflow-hidden rounded-xl border p-4 text-left transition-all",
                isActive
                  ? cn(cfg.activeColor, "ring-2 shadow-sm")
                  : cfg.enabled
                    ? "bg-background hover:bg-muted/50 hover:shadow-sm"
                    : "cursor-not-allowed bg-muted/30 opacity-60",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg">{cfg.emoji}</span>
                <ShoppingCart className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="mt-3">
                <div className={cn("text-3xl font-bold tabular-nums tracking-tight", isActive ? cfg.color : "text-foreground")}>
                  {counts[cfg.key]}
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {cfg.label}
                </div>
                <div className="text-xs text-muted-foreground">
                  {cfg.description}
                </div>
              </div>
              {!cfg.enabled && (
                <span className="absolute right-3 top-3 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Coming soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order ID / Customer / Phone..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={payment} onValueChange={(v) => setPayment(v as PaymentFilter)}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateFilter)}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ─── Source Tabs ─── */}
        <div className="flex items-center gap-1 border-b px-4 py-2">
          {sourceConfig.map((tab) => {
            const active = source === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                disabled={!tab.enabled}
                onClick={() => setSource(tab.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : tab.enabled
                      ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                      : "cursor-not-allowed text-muted-foreground/40",
                )}
              >
                <span>{tab.emoji}</span>
                {tab.label}
                <Badge
                  variant={active ? "secondary" : "outline"}
                  className="h-5 min-w-5 justify-center px-1.5 text-[10px]"
                >
                  {counts[tab.key]}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* ─── Source Description ─── */}
        <div className="border-b bg-muted/20 px-4 py-2.5">
          <span className="text-sm font-semibold">{desc.title}</span>
          <span className="ml-2 text-xs text-muted-foreground">{desc.subtitle}</span>
        </div>

        {/* ─── Table ─── */}
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
                <div className="h-7 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <h2 className="mt-3 font-semibold">Failed to load orders</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try refreshing or adjusting your filters.
              </p>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="mt-3 font-semibold">No orders available</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Orders matching your current filters will appear here.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="px-4 text-xs font-semibold uppercase tracking-wider">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
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
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* ─── Pagination ─── */}
        {!isLoading && !isError && totalCount > 0 && (
          <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {showFrom}–{showTo} of {totalCount} orders
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(1)}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {generatePageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`dot-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
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
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Pagination helper ───────────────────────────────────── */

function generatePageNumbers(current: number, total: number): (number | "...")[] {
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
