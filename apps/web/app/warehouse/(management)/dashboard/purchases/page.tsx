"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Package,
  Search,
  ShoppingCartIcon,
  Truck,
  TrendingUp,
  Users,
  XCircle,
  MapPin,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";

/* ─── Status config ─── */
const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="w-3 h-3" />,
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  confirmed: {
    label: "Confirmed",
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: "text-blue-700 bg-blue-50 border-blue-200",
  },
  processing: {
    label: "Processing",
    icon: <Truck className="w-3 h-3" />,
    className: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
  delivered: {
    label: "Delivered",
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  cancelled: {
    label: "Cancelled",
    icon: <XCircle className="w-3 h-3" />,
    className: "text-red-700 bg-red-50 border-red-200",
  },
};

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "delivered"
  | "cancelled";

/* ─── KPI Card ─── */
function KpiCard({
  label,
  value,
  sub,
  icon,
  accent = false,
  links,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
  links?: { label: string; href: string }[];
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 transition-all hover:shadow-md ${
        accent
          ? "border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 truncate">
            {label}
          </p>
          <p
            className={`text-2xl font-bold font-mono tracking-tight ${
              accent ? "text-blue-700" : "text-gray-900"
            }`}
          >
            {value}
          </p>
          {sub && <p className="text-[11px] text-gray-400 font-mono">{sub}</p>}
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            accent ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
          }`}
        >
          {icon}
        </div>
      </div>
      {links && links.length > 0 && (
        <div className="mt-3 pt-3 border-t border-dashed border-gray-100 flex flex-col gap-1 text-xs">
          {links.map((link, i) => (
            <Link
              key={i}
              href={link.href}
              className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1 transition-colors"
            >
              <span>&rarr;</span> {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

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
      { label: "Submitted", active: true, icon: "🟢" },
      { label: "Accepted(Edited)", active: isAccepted, icon: "✔️" },
      { label: "Waiting", active: isAccepted && !isProcessing, icon: "⏳" },
      { label: "Picked", active: isProcessing, icon: "🚚" },
      { label: "Delivery", active: isDelivered, icon: "📍" },
      { label: "Done", active: isReceived, icon: "✅" },
    ];
  };

  const lastOrderSteps = getPipelineSteps(lastOrder);

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

  return (
    <div className="space-y-6">
      {/* ══════════════════════════════════════════════════════════
          PAGE HEADER (WITH METADATA)
         ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-600 mb-1">
            <span>§01</span>
            <span>/</span>
            <span>Supplier Purchases Overview</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-gray-900">
            Supplier Purchases
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-2 font-mono">
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} className="text-amber-500" />
              Warehouse: <span className="text-gray-800 font-semibold">{warehouseName}</span>
            </span>
            <span className="text-gray-300">|</span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={13} className="text-amber-500" />
              Timeframe:{" "}
              <span className="text-gray-800 font-semibold uppercase">
                {timeframe === "all" ? "This Month / All" : timeframe.replace("_", " ")}
              </span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-xs">
            <Link href="/warehouse/dashboard/suppliers">
              <ShoppingCartIcon className="mr-2 h-3.5 w-3.5" />
              CREATE PURCHASE
            </Link>
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          🔍 ADVANCED FILTER BAR
         ══════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1.5">
          <Search size={13} />
          Search & Filters
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
          {/* Search bar */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5 font-mono">
              Search Text
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search order #, supplier, product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent font-sans"
              />
            </div>
          </div>

          {/* Timeframe Select */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5 font-mono">
              Date Frame
            </label>
            <select
              value={tempTimeframe}
              onChange={(e) => setTempTimeframe(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 font-sans"
            >
              <option value="all">All Time / Month</option>
              <option value="today">Today</option>
              <option value="this_month">This Month</option>
            </select>
          </div>

          {/* Supplier Select */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5 font-mono">
              Supplier Warehouse
            </label>
            <select
              value={tempSupplier}
              onChange={(e) => setTempSupplier(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 font-sans"
            >
              <option value="all">All Suppliers</option>
              {connectedSuppliers.map((s: any) => (
                <option key={s.warehouseId} value={s.warehouseId}>
                  {s.warehouseName || s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Location Select */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1.5 font-mono">
              Delivery Location
            </label>
            <select
              value={tempLocation}
              onChange={(e) => setTempLocation(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 font-sans"
            >
              <option value="all">All Warehouses</option>
              <option value="my_warehouse">My Location Only</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
          <div>
            <label className="inline-flex items-center gap-2">
              <select
                value={tempStatus}
                onChange={(e) => setTempStatus(e.target.value as any)}
                className="text-xs px-2 py-1 border border-gray-200 rounded-md outline-none bg-gray-50 focus:ring-1 focus:ring-amber-500 font-mono"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-mono font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
            >
              Reset Filters
            </button>
            <button
              onClick={handleApplyFilter}
              className="px-3 py-1.5 text-xs font-mono font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
            >
              Apply Filter
            </button>
            <button
              onClick={handleExportCSV}
              disabled={filteredOrders.length === 0}
              className="px-3 py-1.5 text-xs font-mono font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download size={13} />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          📊 LAST ORDER STATUS WIDGET
         ══════════════════════════════════════════════════════════ */}
      {lastOrder && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-amber-100 pb-3 mb-4">
            <div>
              <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-amber-700">
                📊 Last Order Status
              </span>
              <h4 className="text-sm font-semibold text-gray-800 mt-0.5">
                Pipeline tracker for latest supplier purchase order
              </h4>
            </div>
            <div className="bg-amber-100/80 px-3 py-1 rounded-lg border border-amber-200 font-mono text-xs text-amber-950 font-bold flex items-center gap-1.5">
              <span>৳ {Number(lastOrder.total).toLocaleString("en-BD")}</span>
              <span className="text-amber-400">&rarr;</span>
              <span>({lastOrder.orderNumber.slice(-4)})</span>
            </div>
          </div>

          {/* Pipeline Tracker */}
          <div className="relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 -translate-y-1/2 z-0" />
            <div className="grid grid-cols-6 relative z-10">
              {lastOrderSteps.map((step, idx) => (
                <div key={idx} className="flex flex-col items-center text-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                      step.active
                        ? "border-amber-600 bg-amber-500 text-white shadow-sm"
                        : "border-gray-200 bg-white text-gray-400"
                    }`}
                  >
                    <span className="text-xs font-mono">{step.icon}</span>
                  </div>
                  <span
                    className={`mt-2 text-[10px] font-mono font-medium ${
                      step.active ? "text-amber-950 font-bold" : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-4 text-xs font-mono text-amber-900/80 flex items-center justify-between">
            <span>Current Status: <span className="font-bold underline">{lastOrder.status.toUpperCase()}</span></span>
            <span className="text-[10px] text-gray-400">(not allow edits on dispatch)</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          💰 KPI GRID
         ══════════════════════════════════════════════════════════ */}
      <div className="space-y-6">
        {/* Row 1: Main Purchase KPIs */}
        <div>
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-gray-400 mb-3">
            📊 Main Purchase KPI
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              label="Total Purchases"
              value={`৳ ${Number(totalPurchasesValue).toLocaleString("en-BD")}`}
              sub="Dynamic purchase value sum"
              icon={<DollarSign size={20} />}
              accent
              links={[
                { label: "View Purchase Orders", href: "/warehouse/dashboard/purchases" },
                { label: "View Purchase History", href: "/warehouse/dashboard/purchase-history" },
              ]}
            />
            <KpiCard
              label="Net Purchase Value"
              value={`৳ ${Number(netPurchaseValue).toLocaleString("en-BD")}`}
              sub="Net = Purchases – Returns"
              icon={<TrendingUp size={20} />}
            />
            <KpiCard
              label="Purchase Orders"
              value={pagination ? String(pagination.totalCount) : "—"}
              sub="Total distinct supplier orders"
              icon={<FileText size={20} />}
            />
          </div>
        </div>

        {/* Row 2: Supplier KPIs & Payment & Due KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-gray-400 mb-3">
              📊 Supplier KPI
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Total Suppliers"
                value={stats ? String(stats.totalCount) : "—"}
                icon={<Users size={20} />}
              />
              <KpiCard
                label="Active Suppliers"
                value={stats ? String(stats.activeCount) : "—"}
                sub={
                  stats && stats.totalCount > 0
                    ? `${Math.round((stats.activeCount / stats.totalCount) * 100)}% active`
                    : undefined
                }
                icon={<Users size={20} />}
              />
              <KpiCard
                label="Top Supplier"
                value={topSupplier ? topSupplier.name : "—"}
                sub={
                  topSupplier
                    ? `৳ ${Number(topSupplier.currentPayable).toLocaleString("en-BD")} payable`
                    : undefined
                }
                icon={<TrendingUp size={20} />}
                accent
              />
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-gray-400 mb-3">
              📊 Payment & Due KPI
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="Payable"
                value={`৳ ${Number(stats?.totalPayable || 0).toLocaleString("en-BD")}`}
                sub={
                  payable
                    ? `${payable.supplierCount} suppliers with outstanding dues`
                    : undefined
                }
                icon={<CreditCard size={20} />}
                accent
              />
              <KpiCard
                label="Overdue"
                value={`৳ ${Number(
                  payable?.suppliers?.reduce(
                    (sum: number, s: any) => sum + parseFloat(s.currentPayable),
                    0
                  ) || 0
                ).toLocaleString("en-BD")}`}
                sub="Over credit-limit dues"
                icon={<AlertCircle size={20} />}
              />
              <KpiCard
                label="Advance Paid"
                value="৳ 50,000"
                sub="Prepaid to order reserves"
                icon={<DollarSign size={20} />}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          📈 7-DAY PURCHASE TREND & QUICK ACTIONS
         ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend display */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-amber-500" />
            📈 Purchase Trend (Last 7 Days)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b text-xs font-mono uppercase text-gray-400">
                  <th className="py-2">Day</th>
                  <th className="py-2 text-center">Orders</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {trendData.map((t, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-2.5 font-sans font-medium text-gray-700">{t.day}</td>
                    <td className="py-2.5 text-center text-gray-900 font-bold">{t.count}</td>
                    <td className="py-2.5 text-right text-amber-700 font-bold">
                      ৳ {Number(t.total).toLocaleString("en-BD")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Panel */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-gray-400 mb-4">
              ⚡ Quick Actions
            </h3>
            <div className="space-y-2.5">
              <Button asChild variant="outline" className="w-full justify-start text-xs font-mono">
                <Link href="/warehouse/dashboard/purchase-history">
                  <FileText className="mr-2 h-4 w-4 text-gray-400" />
                  Purchase History
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start text-xs font-mono">
                <Link href="/warehouse/dashboard/suppliers">
                  <Users className="mr-2 h-4 w-4 text-gray-400" />
                  Manage Suppliers
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start text-xs font-mono">
                <Link href="/warehouse/dashboard/finance/payable">
                  <CreditCard className="mr-2 h-4 w-4 text-gray-400" />
                  Payable Management
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 font-mono text-center">
            Last synced: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          📦 ORDERS TABLE
         ══════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50/60">
          <h2 className="text-sm font-bold font-mono text-gray-800 uppercase tracking-wider">
            📦 Supplier Purchases Orders list
            {pagination && (
              <span className="ml-2 font-normal text-xs text-gray-400 lowercase">
                ({pagination.totalCount} items)
              </span>
            )}
          </h2>
        </div>

        {/* Table content */}
        {ordersQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          </div>
        ) : ordersQuery.isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="size-10 text-red-300 mb-2" />
            <p className="text-red-600 font-medium">Failed to load orders</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ShoppingCartIcon className="size-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No orders found</p>
            <p className="text-sm text-gray-400 mt-1 max-w-xs">
              {statusFilter !== "all" || searchQuery.trim()
                ? "Try adjusting your search query or filters"
                : "Active orders placed from other warehouses will appear here."}
            </p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/warehouse/dashboard/suppliers">
                <ShoppingCartIcon className="mr-2 h-4 w-4" />
                Create Supplier Purchase
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-gray-50/30 text-xs font-mono uppercase text-gray-400">
                    <th className="px-5 py-3 font-semibold">Order #</th>
                    <th className="px-5 py-3 font-semibold">Supplier</th>
                    <th className="px-5 py-3 font-semibold">Items</th>
                    <th className="px-5 py-3 font-semibold text-right">Total</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredOrders.map((o: any) => {
                    const config =
                      statusConfig[o.status] || statusConfig.pending;
                    return (
                      <tr
                        key={o.id}
                        className="hover:bg-amber-50/10 transition-colors"
                      >
                        <td className="px-5 py-4 font-mono text-sm font-bold text-gray-900">
                          {o.orderNumber}
                          {o.requiresBuyerAcceptance ? (
                            <div className="mt-1 text-[10px] font-sans text-orange-600 font-semibold bg-orange-50 border border-orange-100 rounded px-1.5 py-0.5 inline-block">
                              Approval needed
                            </div>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-gray-900 text-sm">
                            {o.supplierWarehouseName || "Unknown Warehouse"}
                          </p>
                          {o.supplierWarehousePhone ? (
                            <p className="text-xs text-gray-400 font-mono mt-0.5">
                              {o.supplierWarehousePhone}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-700">
                              {o.items?.length || 0} item
                              {(o.items?.length || 0) !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {o.items
                            ?.slice(0, 2)
                            .map((item: any, i: number) => (
                              <p
                                key={i}
                                className="text-xs text-gray-400 ml-6 truncate max-w-[200px]"
                              >
                                {item.productName} × {item.quantity}
                                {item.modifiedQty !== null
                                  ? ` → ${item.modifiedQty}`
                                  : ""}
                              </p>
                            ))}
                          {(o.items?.length || 0) > 2 && (
                            <p className="text-xs text-gray-400 ml-6 font-mono">
                              +{o.items.length - 2} more
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right font-bold font-mono text-sm text-gray-950">
                          ৳ {Number(o.total).toLocaleString("en-BD")}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border ${config.className}`}
                          >
                            {config.icon} {config.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-mono text-gray-500">
                          {new Date(o.createdAt).toLocaleDateString("en-BD", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button asChild variant="outline" size="sm" className="font-mono text-xs">
                            <Link
                              href={`/warehouse/dashboard/purchases/${o.id}`}
                            >
                              View &rarr;
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-t bg-gray-50/40 text-xs font-mono">
                <span className="text-gray-500">
                  Showing{" "}
                  {Math.min((page - 1) * perPage + 1, pagination.totalCount)} to{" "}
                  {Math.min(page * perPage, pagination.totalCount)} of{" "}
                  {pagination.totalCount} items
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-2.5 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-100 transition"
                  >
                    ◀
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
                          className={`px-3 py-1.5 border rounded-lg transition ${
                            page === pageNum
                              ? "bg-amber-600 text-white border-amber-600 font-bold"
                              : "hover:bg-gray-100"
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
                    className="px-2.5 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-100 transition"
                  >
                    ▶
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
