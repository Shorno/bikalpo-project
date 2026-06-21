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
  Clock3,
  FileText,
  Inbox,
  Package,
  Search,
  ShoppingCart,
  Truck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import {
  type ElementType,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DashboardKpiCard,
  type DashboardKpiChartPoint,
  DashboardKpiGrid,
  type DashboardKpiTone,
  type DashboardKpiTrend,
} from "@/components/dashboard/dashboard-kpi-card";
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
import {
  getColumnsForSource,
  type OrderRow,
} from "./_components/order-columns";

/* ── Constants ───────────────────────────────────────────── */

type Source = "all" | "direct" | "salesman" | "estimate" | "pre_order";
type StatusFilter =
  | "all"
  | "pending"
  | "approved"
  | "ready_for_dispatch"
  | "partially_invoiced"
  | "invoiced"
  | "processing"
  | "rejected";
type PaymentFilter = "all" | "paid" | "due" | "partial";
type DateFilter = "today" | "this_month" | "custom" | "all";
type OrderTrendKey = "all" | "direct" | "salesman" | "estimate" | "preOrder";
type OrderTrendPoint = Record<OrderTrendKey, number> & {
  date: string;
  label: string;
};
type OrderTrendSummary = {
  current: Record<OrderTrendKey, number>;
  previous: Record<OrderTrendKey, number>;
};

const sourceConfig: {
  key: Source;
  label: string;
  emoji: string;
  icon: ElementType;
  tone: DashboardKpiTone;
  enabled: boolean;
  description: string;
}[] = [
  {
    key: "all",
    label: "All",
    emoji: "📦",
    icon: Package,
    tone: "slate",
    enabled: true,
    description: "All order types",
  },
  {
    key: "direct",
    label: "Direct",
    emoji: "🔴",
    icon: ShoppingCart,
    tone: "red",
    enabled: true,
    description: "Retailer checkout",
  },
  {
    key: "salesman",
    label: "Salesman",
    emoji: "🔵",
    icon: UserRound,
    tone: "blue",
    enabled: false,
    description: "Field sales flow",
  },
  {
    key: "estimate",
    label: "Estimate",
    emoji: "🟣",
    icon: FileText,
    tone: "violet",
    enabled: false,
    description: "Quote conversions",
  },
  {
    key: "pre_order",
    label: "Pre-Order",
    emoji: "🟡",
    icon: Clock3,
    tone: "amber",
    enabled: false,
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
  { value: "pending", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "ready_for_dispatch", label: "Ready for Dispatch" },
  { value: "partially_invoiced", label: "Partially Invoiced" },
  { value: "invoiced", label: "Invoiced" },
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

const sourceTrendKey: Record<Source, OrderTrendKey> = {
  all: "all",
  direct: "direct",
  salesman: "salesman",
  estimate: "estimate",
  pre_order: "preOrder",
};

function buildTrendCopy(current: number, previous: number): DashboardKpiTrend {
  if (current === 0 && previous === 0) {
    return {
      value: "0%",
      label: "vs Previous 7 Days",
      direction: "neutral",
    };
  }

  if (previous === 0) {
    return {
      value: `+${current.toLocaleString()}`,
      label: "new vs Previous 7 Days",
      direction: "up",
    };
  }

  const change = Math.round(((current - previous) / previous) * 100);

  return {
    value: `${change > 0 ? "+" : ""}${change}%`,
    label: "vs Previous 7 Days",
    direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
  };
}

function buildChartData(
  trend: OrderTrendPoint[],
  key: OrderTrendKey,
): DashboardKpiChartPoint[] {
  return trend.map((point) => ({
    label: point.label,
    value: point[key],
  }));
}

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
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [search]);

  const selectSource = (nextSource: Source) => {
    setSource(nextSource);
    setPage(1);
  };

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
  const trend = (data?.trend ?? []) as OrderTrendPoint[];
  const trendSummary = data?.trendSummary as OrderTrendSummary | undefined;
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
      <DashboardKpiGrid>
        {sourceConfig.map((cfg) => {
          const isActive = source === cfg.key;
          const Icon = cfg.icon;
          const trendKey = sourceTrendKey[cfg.key];
          const currentTrendTotal = trendSummary?.current[trendKey] ?? 0;
          const previousTrendTotal = trendSummary?.previous[trendKey] ?? 0;

          return (
            <DashboardKpiCard
              key={cfg.key}
              active={isActive}
              badge={!cfg.enabled ? "Coming soon" : undefined}
              chartData={buildChartData(trend, trendKey)}
              description={cfg.description}
              disabled={!cfg.enabled}
              footer={{
                label: "Last 7 Days",
                value: currentTrendTotal.toLocaleString(),
              }}
              icon={<Icon className="h-6 w-6" />}
              label={cfg.key === "all" ? "All Orders" : `${cfg.label} Orders`}
              onClick={() => selectSource(cfg.key)}
              tone={cfg.tone}
              trend={buildTrendCopy(currentTrendTotal, previousTrendTotal)}
              value={counts[cfg.key].toLocaleString()}
            />
          );
        })}
      </DashboardKpiGrid>

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
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as StatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={payment}
            onValueChange={(v) => {
              setPayment(v as PaymentFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {paymentOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={dateRange}
            onValueChange={(v) => {
              setDateRange(v as DateFilter);
              setPage(1);
            }}
          >
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
                onClick={() => selectSource(tab.key)}
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
