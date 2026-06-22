"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  FileText,
  Inbox,
  Package,
  PackageCheck,
  Search,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import {
  type ElementType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
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
  type DispatchOrderRow,
  type DispatchStatus,
  getDispatchColumns,
} from "./_components/dispatch-columns";
import { PartialInvoiceDialog } from "./_components/partial-invoice-dialog";

type StatusFilter = "all" | DispatchStatus;
type DateFilter = "today" | "this_month" | "all";

const PER_PAGE = 20;

const statusConfig: {
  key: StatusFilter;
  label: string;
  emoji: string;
  icon: ElementType;
  tone: DashboardKpiTone;
  description: string;
}[] = [
  {
    key: "all",
    label: "All",
    emoji: "📦",
    icon: Package,
    tone: "slate",
    description: "All dispatch-stage orders",
  },
  {
    key: "ready_for_dispatch",
    label: "Ready",
    emoji: "🟣",
    icon: PackageCheck,
    tone: "violet",
    description: "Approved and awaiting invoice",
  },
  {
    key: "partially_invoiced",
    label: "Partial",
    emoji: "🟡",
    icon: FileText,
    tone: "amber",
    description: "Some quantities still uninvoiced",
  },
  {
    key: "invoiced",
    label: "Invoiced",
    emoji: "🟢",
    icon: FileText,
    tone: "emerald",
    description: "All approved quantities invoiced",
  },
];

const dateOptions = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "this_month", label: "This Month" },
];

function getOrderDate(order: DispatchOrderRow) {
  return new Date(order.readyAt ?? order.createdAt);
}

function matchesDateFilter(order: DispatchOrderRow, dateRange: DateFilter) {
  if (dateRange === "all") return true;
  const date = getOrderDate(order);
  const now = new Date();
  if (dateRange === "today") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function matchesSearch(order: DispatchOrderRow, search: string) {
  if (!search.trim()) return true;
  const query = search.trim().toLowerCase();
  const customer =
    order.customer.warehouseName ||
    order.customer.shopName ||
    order.customer.name ||
    order.shipping.name;
  return (
    order.orderNumber.toLowerCase().includes(query) ||
    customer.toLowerCase().includes(query) ||
    (order.customer.phoneNumber ?? "").toLowerCase().includes(query) ||
    order.shipping.phone.toLowerCase().includes(query)
  );
}

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
  orders: DispatchOrderRow[],
  status: StatusFilter,
): DashboardKpiChartPoint[] {
  const now = new Date();
  const points: DashboardKpiChartPoint[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);

    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const value = orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      const orderDate = getOrderDate(order);
      return orderDate >= day && orderDate < nextDay;
    }).length;

    points.push({
      label: day.toLocaleDateString("en-BD", { weekday: "short" }),
      value,
    });
  }

  return points;
}

function buildTrendTotals(orders: DispatchOrderRow[], status: StatusFilter) {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setHours(0, 0, 0, 0);
  currentStart.setDate(currentStart.getDate() - 6);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - 7);

  const previousEnd = new Date(currentStart);

  const inRange = (order: DispatchOrderRow, start: Date, end: Date) => {
    if (status !== "all" && order.status !== status) return false;
    const orderDate = getOrderDate(order);
    return orderDate >= start && orderDate < end;
  };

  const current = orders.filter((order) =>
    inRange(order, currentStart, new Date(now.getTime() + 86_400_000)),
  ).length;
  const previous = orders.filter((order) =>
    inRange(order, previousStart, previousEnd),
  ).length;

  return { current, previous };
}

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

function buildDefaultPartialQuantities(order: DispatchOrderRow) {
  return order.items.reduce<Record<number, number>>((quantities, item) => {
    if (item.remainingQty > 0) {
      quantities[item.orderItemId] = item.remainingQty;
    }
    return quantities;
  }, {});
}

export default function DispatchOrdersPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("ready_for_dispatch");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [partialInvoiceOrder, setPartialInvoiceOrder] =
    useState<DispatchOrderRow | null>(null);
  const [partialQuantities, setPartialQuantities] = useState<
    Record<number, number>
  >({});

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

  const selectStatus = (nextStatus: StatusFilter) => {
    setStatus(nextStatus);
    setPage(1);
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["warehouse", "dispatch-dashboard"],
    queryFn: () => orpc.warehouse.getDispatchDashboard.call({}),
  });

  const allOrders = useMemo((): DispatchOrderRow[] => {
    if (!data) return [];
    return [
      ...data.readyOrders,
      ...data.partiallyInvoicedOrders,
      ...data.invoicedOrders,
    ].map((order) => ({
      ...order,
      status: order.status as DispatchStatus,
    })) as unknown as DispatchOrderRow[];
  }, [data]);

  const counts: Record<StatusFilter, number> = useMemo(
    () => ({
      all: allOrders.length,
      ready_for_dispatch: data?.readyOrders.length ?? 0,
      partially_invoiced: data?.partiallyInvoicedOrders.length ?? 0,
      invoiced: data?.invoicedOrders.length ?? 0,
    }),
    [allOrders.length, data],
  );

  const filteredOrders = useMemo(() => {
    return allOrders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (!matchesSearch(order, debouncedSearch)) return false;
      if (!matchesDateFilter(order, dateRange)) return false;
      return true;
    });
  }, [allOrders, status, debouncedSearch, dateRange]);

  const totalCount = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filteredOrders.slice(start, start + PER_PAGE);
  }, [filteredOrders, page]);

  const invalidateDispatch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["warehouse", "dispatch-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["warehouse", "order-management"] });
  }, [queryClient]);

  const fullInvoiceMutation = useMutation({
    mutationFn: (orderId: number) =>
      orpc.warehouse.createFullDispatchInvoice.call({ orderId }),
    onSuccess: (result) => {
      toast.success(result.message || "Invoice created");
      invalidateDispatch();
      selectStatus("invoiced");
    },
    onError: (error) =>
      toast.error(error.message || "Failed to create invoice"),
    onSettled: () => setActionLoading(null),
  });

  const partialInvoiceMutation = useMutation({
    mutationFn: (input: {
      orderId: number;
      items: Array<{ orderItemId: number; quantity: number }>;
    }) => orpc.warehouse.createPartialDispatchInvoice.call(input),
    onSuccess: (result) => {
      toast.success(result.message || "Partial invoice created");
      setPartialInvoiceOrder(null);
      setPartialQuantities({});
      invalidateDispatch();
      selectStatus(
        result.fullyInvoiced ? "invoiced" : "partially_invoiced",
      );
    },
    onError: (error) =>
      toast.error(error.message || "Failed to create partial invoice"),
    onSettled: () => setActionLoading(null),
  });

  const handleCreateFullInvoice = useCallback(
    (order: DispatchOrderRow) => {
      setActionLoading(`full-${order.id}`);
      fullInvoiceMutation.mutate(order.id);
    },
    [fullInvoiceMutation],
  );

  const openPartialInvoice = useCallback((order: DispatchOrderRow) => {
    setPartialInvoiceOrder(order);
    setPartialQuantities(buildDefaultPartialQuantities(order));
  }, []);

  const columns = useMemo(
    () =>
      getDispatchColumns({
        actionLoading,
        onCreateFullInvoice: handleCreateFullInvoice,
        onOpenPartialInvoice: openPartialInvoice,
      }),
    [actionLoading, handleCreateFullInvoice, openPartialInvoice],
  );

  const table = useReactTable({
    data: paginatedOrders,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  const handlePartialQuantity = (
    orderItemId: number,
    remainingQty: number,
    nextQuantity: number,
  ) => {
    setPartialQuantities((current) => ({
      ...current,
      [orderItemId]: Math.max(
        0,
        Math.min(
          remainingQty,
          Number.isFinite(nextQuantity) ? nextQuantity : 0,
        ),
      ),
    }));
  };

  const handleCreatePartialInvoice = () => {
    if (!partialInvoiceOrder) return;
    const items = partialInvoiceOrder.items
      .map((item) => ({
        orderItemId: item.orderItemId,
        quantity: partialQuantities[item.orderItemId] ?? 0,
      }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      toast.error("Select at least one item quantity");
      return;
    }

    setActionLoading(`partial-${partialInvoiceOrder.id}`);
    partialInvoiceMutation.mutate({
      orderId: partialInvoiceOrder.id,
      items,
    });
  };

  const showFrom = totalCount > 0 ? (page - 1) * PER_PAGE + 1 : 0;
  const showTo = Math.min(page * PER_PAGE, totalCount);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Dispatch Orders
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Create full or partial invoices for approved warehouse orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/warehouse/dashboard/order-management"
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ShoppingCart className="h-4 w-4" />
            Order Management
          </Link>
        </div>
      </div>

      <DashboardKpiGrid className="sm:grid-cols-2 xl:grid-cols-4">
        {statusConfig.map((cfg) => {
          const isActive = status === cfg.key;
          const Icon = cfg.icon;
          const { current, previous } = buildTrendTotals(allOrders, cfg.key);

          return (
            <DashboardKpiCard
              key={cfg.key}
              active={isActive}
              chartData={buildChartData(allOrders, cfg.key)}
              description={cfg.description}
              footer={{
                label: "Last 7 Days",
                value: current.toLocaleString(),
              }}
              icon={<Icon className="h-6 w-6" />}
              label={
                cfg.key === "all"
                  ? "All Dispatch"
                  : cfg.key === "ready_for_dispatch"
                    ? "Ready for Dispatch"
                    : cfg.key === "partially_invoiced"
                      ? "Partially Invoiced"
                      : "Invoiced"
              }
              onClick={() => selectStatus(cfg.key)}
              tone={cfg.tone}
              trend={buildTrendCopy(current, previous)}
              value={counts[cfg.key].toLocaleString()}
            />
          );
        })}
      </DashboardKpiGrid>

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
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1 border-b px-4 py-2">
          {statusConfig.map((tab) => {
            const active = status === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectStatus(tab.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
              <h2 className="mt-3 font-semibold">Failed to load dispatch orders</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try refreshing or adjusting your filters.
              </p>
            </div>
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="mt-3 font-semibold">No dispatch orders available</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Orders will appear here as they move through approval and become
                ready for invoicing.
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
              Showing {showFrom}–{showTo} of {totalCount} orders
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
                  <span
                    key={`dot-${i}`}
                    className="px-1 text-xs text-muted-foreground"
                  >
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

      <PartialInvoiceDialog
        open={!!partialInvoiceOrder}
        order={partialInvoiceOrder}
        quantities={partialQuantities}
        actionLoading={actionLoading}
        onClose={() => {
          setPartialInvoiceOrder(null);
          setPartialQuantities({});
        }}
        onCreate={() => void handleCreatePartialInvoice()}
        onQuantityChange={handlePartialQuantity}
      />
    </div>
  );
}
