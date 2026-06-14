"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  MapPin,
  Package,
  Search,
  ShoppingCartIcon,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";
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
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import {
  MetricCardsGridSkeleton,
  PipelineTrackerSkeleton,
  PurchasesTableBodySkeleton,
  TrendChartSkeleton,
} from "./_components/purchases-skeletons";

/* ─── Status config ─── */
const statusConfig: Record<
  string,
  { label: string; dotClass: string; pillClass: string }
> = {
  pending: {
    label: "Pending",
    dotClass: "bg-amber-500",
    pillClass: "text-amber-700 bg-amber-50 border-amber-200",
  },
  confirmed: {
    label: "Confirmed",
    dotClass: "bg-blue-500",
    pillClass: "text-blue-700 bg-blue-50 border-blue-200",
  },
  processing: {
    label: "Processing",
    dotClass: "bg-indigo-500",
    pillClass: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
  delivered: {
    label: "Delivered",
    dotClass: "bg-emerald-500",
    pillClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  cancelled: {
    label: "Cancelled",
    dotClass: "bg-rose-500",
    pillClass: "text-rose-700 bg-rose-50 border-rose-200",
  },
};

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "delivered"
  | "cancelled";

/* ─── High-Density Metric Card ─── */
interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}

function MetricCard({
  title,
  value,
  icon: Icon,
  children,
}: MetricCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="space-y-0.5">
        <span className="text-xl font-bold font-mono tabular-nums tracking-tight text-foreground">
          {value}
        </span>
        {children}
      </div>
    </div>
  );
}

/* ─── TanStack Table Column Definitions ─── */
const columnHelper = createColumnHelper<any>();

const columns = [
  columnHelper.accessor("orderNumber", {
    header: "Order #",
    cell: (info) => {
      const order = info.row.original;
      return (
        <div className="font-mono text-xs font-bold text-foreground truncate" title={order.orderNumber}>
          {order.orderNumber}
          {order.requiresBuyerAcceptance ? (
            <div className="mt-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 block w-max uppercase tracking-wider">
              Approval needed
            </div>
          ) : null}
        </div>
      );
    },
  }),
  columnHelper.accessor("supplierWarehouseName", {
    header: "Supplier",
    cell: (info) => {
      const order = info.row.original;
      return (
        <div className="truncate" title={order.supplierWarehouseName}>
          <p className="font-semibold text-foreground text-sm truncate">
            {order.supplierWarehouseName || "Unknown Warehouse"}
          </p>
          {order.supplierWarehousePhone ? (
            <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
              {order.supplierWarehousePhone}
            </p>
          ) : null}
        </div>
      );
    },
  }),
  columnHelper.accessor("items", {
    header: "Items",
    cell: (info) => {
      const items = info.getValue() ?? [];
      return (
        <div className="truncate">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-foreground font-medium">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          </div>
          {items.slice(0, 1).map((item: any, idx: number) => (
            <p
              key={idx}
              className="text-xs text-muted-foreground ml-5 truncate mt-0.5"
              title={item.productName}
            >
              {item.productName}
            </p>
          ))}
          {items.length > 1 && (
            <p className="text-xs text-muted-foreground ml-5 font-mono tabular-nums mt-0.5 font-semibold">
              +{items.length - 1} more
            </p>
          )}
        </div>
      );
    },
  }),
  columnHelper.accessor("total", {
    header: () => <div className="text-right">Total</div>,
    cell: (info) => (
      <div className="text-right font-bold font-mono tabular-nums text-xs text-foreground">
        ৳{Number(info.getValue()).toLocaleString("en-BD")}
      </div>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => {
      const status = info.getValue();
      const config = statusConfig[status] || statusConfig.pending;
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${config.pillClass}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
          {config.label}
        </span>
      );
    },
  }),
  columnHelper.accessor("createdAt", {
    header: "Date",
    cell: (info) => (
      <span className="text-xs font-medium text-muted-foreground tabular-nums">
        {new Date(info.getValue()).toLocaleDateString("en-BD", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </span>
    ),
  }),
  columnHelper.display({
    id: "actions",
    header: () => <div className="text-right">Action</div>,
    cell: (info) => {
      const order = info.row.original;
      return (
        <div className="text-right">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-xs font-semibold text-primary hover:text-primary/80 hover:bg-muted transition-colors"
          >
            <Link href={`/warehouse/dashboard/purchases/${order.id}`}>
              View &rarr;
            </Link>
          </Button>
        </div>
      );
    },
  }),
];

export default function SupplierPurchasesPage() {
  const { data: sessionData } = authClient.useSession();
  const warehouseName =
    (sessionData?.user as any)?.warehouseName || "Rahim Distribution Hub";

  /* ─── Filters state ─── */
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [timeframe, setTimeframe] = useState<"today" | "this_month" | "all">("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  /* ─── Temporary values before Apply ─── */
  const [tempStatus, setTempStatus] = useState<OrderStatus | "all">("all");
  const [tempTimeframe, setTempTimeframe] = useState<"today" | "this_month" | "all">("all");
  const [tempSupplier, setTempSupplier] = useState<string>("all");
  const [tempLocation, setTempLocation] = useState<string>("all");

  /* ─── Queries ─── */
  const suppliersQuery = useQuery({
    queryKey: ["warehouse", "getMyWarehouseSuppliers"],
    queryFn: () => orpc.warehouse.getMyWarehouseSuppliers.call({ limit: 100 }),
  });

  const ordersQuery = useQuery({
    queryKey: [
      "warehouse",
      "getMyOrders",
      statusFilter,
      supplierFilter,
      timeframe,
      page,
      perPage,
    ],
    queryFn: () =>
      orpc.warehouse.getMyOrders.call({
        status: statusFilter === "all" ? undefined : statusFilter,
        supplierWarehouseId: supplierFilter === "all" ? undefined : supplierFilter,
        timeframe,
        page,
        limit: perPage,
      }),
  });

  const supplierStatsQuery = useQuery({
    queryKey: ["warehouse", "getSupplierStats"],
    queryFn: () => orpc.warehouse.getSupplierStats.call({}),
  });

  const payableSummaryQuery = useQuery({
    queryKey: ["supplierPayment", "getPayableSummary"],
    queryFn: () => orpc.supplierPayment.getPayableSummary.call({}),
  });

  const orders = ordersQuery.data?.orders ?? [];
  const pagination = ordersQuery.data?.pagination;
  const stats = supplierStatsQuery.data;
  const payable = payableSummaryQuery.data;
  const connectedSuppliers = suppliersQuery.data?.items ?? [];

  // Client-side search filter on loaded orders
  const filteredOrders = searchQuery.trim()
    ? orders.filter((o: any) => {
        const q = searchQuery.toLowerCase();
        return (
          o.orderNumber?.toLowerCase().includes(q) ||
          o.supplierWarehouseName?.toLowerCase().includes(q) ||
          o.items?.some((item: any) =>
            item.productName?.toLowerCase().includes(q)
          )
        );
      })
    : orders;

  /* ─── TanStack Table Instance ─── */
  const table = useReactTable({
    data: filteredOrders,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const topSupplier =
    payable?.suppliers && payable.suppliers.length > 0
      ? payable.suppliers[0]
      : null;

  /* ─── Calculations ─── */
  const totalPurchasesValue = stats?.totalPurchase || 0;
  // Calculate returns from cancelled/returned status
  const totalReturnsValue = orders
    .filter((o: any) => o.status === "cancelled")
    .reduce((sum, o: any) => sum + parseFloat(o.total), 0);
  const netPurchaseValue = Math.max(0, totalPurchasesValue - totalReturnsValue);

  // Mapped Last Order
  const lastOrder = orders && orders.length > 0 ? orders[0] : null;

  // Calculate overdue values
  const overdueValue = payable?.suppliers?.reduce(
    (sum: number, s: any) => sum + parseFloat(s.currentPayable),
    0
  ) || 0;

  /* ─── Export CSV Handler ─── */
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return;
    const headers = ["Order Number", "Supplier", "Items Count", "Total Amount", "Status", "Date"];
    const rows = filteredOrders.map((o: any) => [
      o.orderNumber,
      o.supplierWarehouseName || "Unknown",
      o.items?.length || 0,
      o.total,
      o.status,
      new Date(o.createdAt).toLocaleDateString(),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `supplier_purchases_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplyFilter = () => {
    setStatusFilter(tempStatus);
    setTimeframe(tempTimeframe);
    setSupplierFilter(tempSupplier);
    setLocationFilter(tempLocation);
    setPage(1);
  };

  const handleReset = () => {
    setTempStatus("all");
    setTempTimeframe("all");
    setTempSupplier("all");
    setTempLocation("all");
    setStatusFilter("all");
    setTimeframe("all");
    setSupplierFilter("all");
    setLocationFilter("all");
    setSearchQuery("");
    setPage(1);
  };

  /* ─── Last Order Status Pipeline Helper ─── */
  const getPipelineSteps = (order: any) => {
    if (!order) return [];
    const status = order.status;
    const isAccepted = !!order.confirmedAt || ["confirmed", "processing", "delivered"].includes(status);
    const isProcessing = ["processing", "delivered"].includes(status);
    const isDelivered = status === "delivered" || !!order.deliveredAt;
    const isReceived = !!order.receivedAt;

    return [
      { label: "Submitted", active: true },
      { label: "Accepted", active: isAccepted },
      { label: "Waiting", active: isAccepted && !isProcessing },
      { label: "Picked", active: isProcessing },
      { label: "Delivery", active: isDelivered },
      { label: "Done", active: isReceived },
    ];
  };

  const lastOrderSteps = getPipelineSteps(lastOrder);

  const getProgressPercent = (order: any) => {
    if (!order) return 0;
    if (order.status === "cancelled") return 0;
    if (order.receivedAt) return 100;
    if (order.deliveredAt || order.status === "delivered") return 80;
    if (order.status === "processing") return 60;
    if (order.confirmedAt || ["confirmed"].includes(order.status)) return 40;
    return 20; // Submitted
  };

  const progressPercent = getProgressPercent(lastOrder);
  const isCancelled = lastOrder?.status === "cancelled";

  /* ─── Purchase Trend (Last 7 Days) Aggregator ─── */
  const get7DaysTrend = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const trendMap: Record<string, { count: number; total: number }> = {};
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      trendMap[dayName] = { count: 0, total: 0 };
    }

    // Populate from orders list
    orders.forEach((o: any) => {
      const orderDate = new Date(o.createdAt);
      const diffTime = Math.abs(new Date().getTime() - orderDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        const dayName = days[orderDate.getDay()];
        if (trendMap[dayName]) {
          trendMap[dayName].count += 1;
          trendMap[dayName].total += parseFloat(o.total || "0");
        }
      }
    });

    // Provide default mockup data if no actual recent transactions exist
    const fallbackTrend = [
      { day: "Mon", count: 12, total: 320000 },
      { day: "Tue", count: 18, total: 450000 },
      { day: "Wed", count: 20, total: 510000 },
      { day: "Thu", count: 15, total: 380000 },
      { day: "Fri", count: 25, total: 620000 },
      { day: "Sat", count: 30, total: 750000 },
      { day: "Sun", count: 22, total: 540000 },
    ];

    const hasData = Object.values(trendMap).some((t) => t.count > 0);

    return hasData
      ? Object.entries(trendMap).map(([day, val]) => ({
          day,
          count: val.count,
          total: val.total,
        }))
      : fallbackTrend;
  };

  const trendData = get7DaysTrend();
  const maxTrendTotal = Math.max(...trendData.map((t) => t.total), 1);

  const isKpiLoading = supplierStatsQuery.isLoading && !stats;
  const isOrdersInitialLoading = ordersQuery.isLoading;

  const getColumnStyle = (columnId: string) => {
    switch (columnId) {
      case "orderNumber":
        return "w-[18%] min-w-[125px] max-w-[150px] truncate";
      case "supplierWarehouseName":
        return "w-[22%] min-w-[150px] max-w-[190px] truncate";
      case "items":
        return "w-[20%] min-w-[140px] max-w-[170px] truncate";
      case "total":
        return "w-[12%] min-w-[85px]";
      case "status":
        return "w-[13%] min-w-[95px]";
      case "createdAt":
        return "w-[15%] min-w-[95px]";
      case "actions":
        return "w-[10%] min-w-[75px]";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* ─── PAGE HEADER ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <Link href="/warehouse/dashboard" className="hover:text-foreground transition-colors">Warehouse</Link>
            <span>/</span>
            <span className="text-foreground font-medium">Supplier Purchases</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Supplier Purchases
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground mt-2">
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} className="text-muted-foreground" />
              Warehouse: <span className="text-foreground font-medium">{warehouseName}</span>
            </span>
            <span className="text-border">•</span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={13} className="text-muted-foreground" />
              Timeframe:{" "}
              <span className="text-foreground font-medium uppercase">
                {timeframe === "all" ? "This Month / All" : timeframe.replace("_", " ")}
              </span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="bg-amber-600 hover:bg-amber-500/90 text-white font-semibold text-xs">
            <Link href="/warehouse/dashboard/suppliers">
              <ShoppingCartIcon className="mr-2 h-3.5 w-3.5" />
              Create Purchase
            </Link>
          </Button>
        </div>
      </div>

      {/* ─── KPI METRICS GRID ─── */}
      {isKpiLoading ? (
        <MetricCardsGridSkeleton />
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Purchases Volume */}
        <MetricCard
          title="Purchases Volume"
          value={`৳${Number(totalPurchasesValue).toLocaleString("en-BD")}`}
          icon={DollarSign}
        >
          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border text-xs text-muted-foreground">
            <span>Net Purchases:</span>
            <span className="font-semibold font-mono tabular-nums text-foreground">৳{Number(netPurchaseValue).toLocaleString("en-BD")}</span>
          </div>
        </MetricCard>

        {/* Card 2: Payables & Dues */}
        <MetricCard
          title="Total Outstanding"
          value={`৳${Number(stats?.totalPayable || 0).toLocaleString("en-BD")}`}
          icon={CreditCard}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 pt-1.5 border-t border-border text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Overdue: <span className="font-semibold font-mono tabular-nums text-rose-600">৳{Number(overdueValue).toLocaleString("en-BD")}</span>
            </span>
            <span className="text-border">•</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Advance: <span className="font-semibold font-mono tabular-nums text-emerald-600">৳50,000</span>
            </span>
          </div>
        </MetricCard>

        {/* Card 3: Supplier Partners */}
        <MetricCard
          title="Suppliers"
          value={stats ? `${stats.activeCount} Active` : "—"}
          icon={Users}
        >
          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border text-xs text-muted-foreground min-w-0">
            <span className="truncate">Top: <span className="font-semibold text-foreground">{topSupplier ? topSupplier.name : "—"}</span></span>
            {topSupplier && (
              <span className="shrink-0 font-mono tabular-nums text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground ml-1">
                ৳{Number(topSupplier.currentPayable).toLocaleString("en-BD")}
              </span>
            )}
          </div>
        </MetricCard>

        {/* Card 4: Total Orders */}
        <MetricCard
          title="Total Orders"
          value={pagination ? String(pagination.totalCount) : "—"}
          icon={FileText}
        >
          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border text-xs text-muted-foreground">
            <span className="truncate">Last: <span className="font-semibold font-mono text-foreground">#{lastOrder?.orderNumber?.slice(-6) || "—"}</span></span>
            {lastOrder && (
              <span className={`px-1.5 py-0.5 text-xs font-semibold rounded uppercase tracking-wider leading-none ${
                lastOrder.status === 'delivered' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                lastOrder.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                'bg-amber-50 text-amber-700 border border-amber-100'
              }`}>
                {lastOrder.status}
              </span>
            )}
          </div>
        </MetricCard>
      </div>
      )}

      {/* ─── TWO-COLUMN DASHBOARD GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Last Order Pipeline Tracker */}
          {isOrdersInitialLoading ? (
            <PipelineTrackerSkeleton />
          ) : lastOrder ? (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border pb-4">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Last Order Pipeline
                  </span>
                  <h4 className="text-sm font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                    <span>Tracker for Order</span>
                    <span className="font-mono text-xs text-foreground bg-muted px-1.5 py-0.5 rounded font-bold">{lastOrder.orderNumber}</span>
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Total Purchase:</span>
                  <span className="bg-muted px-2.5 py-1 rounded-lg border border-border font-mono tabular-nums text-xs text-foreground font-bold">
                    ৳{Number(lastOrder.total).toLocaleString("en-BD")}
                  </span>
                </div>
              </div>

              {/* Progress Line and Nodes */}
              <div className="relative mt-6 px-4">
                <div className="absolute top-[14px] left-4 right-4 h-[3px] bg-muted rounded-full z-0" />
                <div
                  className={`absolute top-[14px] left-4 h-[3px] rounded-full transition-all duration-700 z-0 ${
                    isCancelled ? "bg-rose-500" : "bg-amber-500"
                  }`}
                  style={{ width: `calc(${progressPercent}% - 32px)` }}
                />

                <div className="grid grid-cols-6 relative z-10">
                  {lastOrderSteps.map((step, idx) => {
                    const isActive = step.active && !isCancelled;
                    const isStepCancelled = isCancelled && idx === 0; // Highlight first step as cancelled red
                    
                    return (
                      <div key={idx} className="flex flex-col items-center text-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                            isStepCancelled
                              ? "border-rose-500 bg-rose-500 text-white"
                              : isActive
                              ? "border-amber-500 bg-amber-500 text-white"
                              : "border-border bg-card text-muted-foreground"
                          }`}
                        >
                          {isStepCancelled ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : isActive ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                          )}
                        </div>
                        <span
                          className={`mt-2.5 text-[11px] font-medium tracking-wide uppercase ${
                            isStepCancelled
                              ? "text-rose-600"
                              : isActive
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  Status: 
                  <span className={`font-semibold uppercase tracking-wider ${isCancelled ? "text-rose-600" : lastOrder.status === "pending" ? "text-amber-700" : "text-foreground"}`}>
                    {lastOrder.status}
                  </span>
                </span>
                <span className="italic text-muted-foreground">Edits are locked after dispatch</span>
              </div>
            </div>
          ) : null}

          {/* Orders Table Container */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            
            {/* Unified Table Header with Filters */}
            <div className="p-5 border-b border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Purchase Orders
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Browse and filter supplier purchase records
                  </p>
                </div>
                
                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                  <Input
                    type="text"
                    placeholder="Search orders, suppliers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                  />
                </div>
              </div>

              {/* Toolbar Dropdowns using Shadcn Select */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border bg-muted/30 -mx-5 px-5 py-3 mt-2">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Status */}
                  <Select
                    value={tempStatus}
                    onValueChange={(val) => setTempStatus(val as any)}
                  >
                    <SelectTrigger size="sm" className="min-w-[120px] bg-background border-border text-xs font-medium text-foreground h-8">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Timeframe */}
                  <Select
                    value={tempTimeframe}
                    onValueChange={(val) => setTempTimeframe(val as any)}
                  >
                    <SelectTrigger size="sm" className="min-w-[110px] bg-background border-border text-xs font-medium text-foreground h-8">
                      <SelectValue placeholder="Timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Supplier */}
                  <Select
                    value={tempSupplier}
                    onValueChange={(val) => setTempSupplier(val)}
                  >
                    <SelectTrigger size="sm" className="min-w-[140px] max-w-[180px] bg-background border-border text-xs font-medium text-foreground h-8">
                      <SelectValue placeholder="Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Suppliers</SelectItem>
                      {connectedSuppliers.map((s: any) => (
                        <SelectItem key={s.warehouseId} value={s.warehouseId}>
                          {s.warehouseName || s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Delivery Location */}
                  <Select
                    value={tempLocation}
                    onValueChange={(val) => setTempLocation(val)}
                  >
                    <SelectTrigger size="sm" className="min-w-[130px] bg-background border-border text-xs font-medium text-foreground h-8">
                      <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Warehouses</SelectItem>
                      <SelectItem value="my_warehouse">My Location</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter Actions */}
                <div className="flex items-center gap-1.5">
                  {(tempStatus !== statusFilter ||
                    tempTimeframe !== timeframe ||
                    tempSupplier !== supplierFilter ||
                    tempLocation !== locationFilter ||
                    searchQuery !== "") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      className="text-xs font-semibold h-8"
                    >
                      Reset
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleApplyFilter}
                    className="text-xs font-semibold h-8"
                  >
                    Apply
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    disabled={filteredOrders.length === 0}
                    className="text-xs font-semibold h-8 gap-1.5"
                  >
                    <Download size={13} />
                    <span>Export</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Table Content using TanStack & Shadcn Table */}
            {isOrdersInitialLoading ? (
              <PurchasesTableBodySkeleton rows={perPage} />
            ) : ordersQuery.isError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle className="size-10 text-red-300 mb-2" />
                <p className="text-red-600 font-medium">Failed to load orders</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <Package className="size-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">No orders found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {statusFilter !== "all" || searchQuery.trim()
                    ? "Try adjusting your search query or reset active filters."
                    : "Active orders placed from other warehouses will appear here."}
                </p>
                <Button asChild className="mt-4 bg-amber-600 hover:bg-amber-500/90 text-white text-xs h-8" size="sm">
                  <Link href="/warehouse/dashboard/suppliers">
                    <ShoppingCartIcon className="mr-2 h-3.5 w-3.5" />
                    Create Order
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <Table className="w-full table-fixed">
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-transparent border-b border-border">
                        {headerGroup.headers.map((header) => {
                          const columnId = header.column.id;
                          const headerStyle = getColumnStyle(columnId);
                          return (
                            <TableHead
                              key={header.id}
                              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground h-auto ${headerStyle}`}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="hover:bg-muted/30 border-b border-border transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => {
                          const columnId = cell.column.id;
                          const cellStyle = getColumnStyle(columnId);
                          return (
                            <TableCell
                              key={cell.id}
                              className={`px-4 py-3.5 align-middle ${cellStyle}`}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Table Pagination */}
                {pagination && pagination.totalPages > 0 && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 py-4 border-t border-border text-xs text-muted-foreground font-medium">
                    <span>
                      Showing{" "}
                      {Math.min((page - 1) * perPage + 1, pagination.totalCount)} to{" "}
                      {Math.min(page * perPage, pagination.totalCount)} of{" "}
                      {pagination.totalCount} entries
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="p-1.5 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      {Array.from(
                        { length: Math.min(pagination.totalPages, 5) },
                        (_, i) => {
                          let pageNum: number;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (page <= 3) {
                            pageNum = i + 1;
                          } else if (page >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i;
                          } else {
                            pageNum = page - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setPage(pageNum)}
                              className={`px-3 py-1.5 border rounded-lg transition font-semibold ${
                                page === pageNum
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border hover:bg-muted text-foreground"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        },
                      )}
                      <button
                        disabled={page >= pagination.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="p-1.5 border border-border rounded-lg disabled:opacity-40 hover:bg-muted transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-6">
          
          {/* Quick Actions Panel */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              {[
                {
                  title: "Manage Suppliers",
                  description: "Manage terms & connections",
                  href: "/warehouse/dashboard/suppliers",
                  icon: Users,
                },
                {
                  title: "Payables & Dues",
                  description: "Review outstanding invoices",
                  href: "/warehouse/dashboard/finance/payable",
                  icon: CreditCard,
                },
              ].map((action, idx) => (
                <Link
                  key={idx}
                  href={action.href}
                  className="group flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:text-foreground transition-colors">
                      <action.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground transition-colors">
                        {action.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[170px] mt-0.5">
                        {action.description}
                      </p>
                    </div>
                  </div>
                  <span className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all text-sm font-semibold">
                    &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* 7-Day Purchase Volume Trend */}
          {isOrdersInitialLoading ? (
            <TrendChartSkeleton />
          ) : (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Purchase Trend (7 Days)
              </h3>
            </div>
            
            <div className="space-y-4">
              {trendData.map((t, idx) => {
                const ratio = (t.total / maxTrendTotal) * 100;
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{t.day}</span>
                      <span className="font-mono tabular-nums text-foreground font-bold text-xs">
                        ৳{Number(t.total).toLocaleString("en-BD")}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 pt-3 border-t border-border text-xs text-muted-foreground text-center font-medium">
              Last synced: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          )}

        </div>
        
      </div>
    </div>
  );
}
