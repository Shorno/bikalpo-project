"use client";

import {
  AlertCircle,
  CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  KeyRound,
  Package,
  PackageCheck,
  RotateCcw,
  Search,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePurchaseOrders } from "@/hooks/use-shop-owner-api";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

// ─── Status Config ───────────────────────────────────────────

type OrderStatus = "pending" | "confirmed" | "processing" | "delivered" | "cancelled";

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; className: string; dotColor: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="w-3 h-3" />,
    className: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-800",
    dotColor: "bg-amber-500",
  },
  confirmed: {
    label: "Accepted",
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-800",
    dotColor: "bg-blue-500",
  },
  processing: {
    label: "In Delivery",
    icon: <Truck className="w-3 h-3" />,
    className: "text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-800",
    dotColor: "bg-indigo-500",
  },
  delivered: {
    label: "Received",
    icon: <PackageCheck className="w-3 h-3" />,
    className: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-800",
    dotColor: "bg-emerald-500",
  },
  returned: {
    label: "Returned",
    icon: <RotateCcw className="w-3 h-3" />,
    className: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/30 dark:border-orange-800",
    dotColor: "bg-orange-500",
  },
  cancelled: {
    label: "Cancelled",
    icon: <XCircle className="w-3 h-3" />,
    className: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30 dark:border-red-800",
    dotColor: "bg-red-500",
  },
};

const statusTabs: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All Orders" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Accepted" },
  { value: "processing", label: "In Delivery" },
  { value: "delivered", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

// ─── OTP Badge ──────────────────────────────────────────────

function DeliveryOtpBadge({ orderId, status }: { orderId: number; status: string }) {
  const showForStatuses = ["confirmed", "processing"];
  const { data, isLoading } = useQuery({
    queryKey: ["delivery-otp", orderId],
    queryFn: () => orpc.deliveryman.getOrderDeliveryOtp.call({ orderId }),
    enabled: showForStatuses.includes(status),
    refetchInterval: 30000,
  });

  if (!showForStatuses.includes(status)) return null;
  if (isLoading) return <Skeleton className="h-6 w-16" />;
  if (!data?.showOtp || !data.otp) return <span className="text-xs text-muted-foreground">Awaiting</span>;

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md">
      <KeyRound className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
      <span className="font-mono text-xs font-bold tracking-widest text-emerald-700 dark:text-emerald-300">
        {data.otp}
      </span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<string>("all");

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout((window as any).__poSearchTimer);
    (window as any).__poSearchTimer = setTimeout(() => {
      setSearchDebounced(value);
      setPage(1);
    }, 400);
  };

  // Calculate date filters
  const getDateFilters = () => {
    const now = new Date();
    if (dateRange === "7d") {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { dateFrom: from.toISOString().split("T")[0], dateTo: undefined };
    }
    if (dateRange === "30d") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: from.toISOString().split("T")[0], dateTo: undefined };
    }
    return { dateFrom: undefined, dateTo: undefined };
  };

  const dateFilters = getDateFilters();

  const { data, isLoading, isError } = usePurchaseOrders({
    search: searchDebounced || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    dateFrom: dateFilters.dateFrom,
    dateTo: dateFilters.dateTo,
    page,
    limit: 15,
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination;
  const kpi = data?.kpi;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
          🧾 Purchase Orders
          <span className="text-[10px] text-muted-foreground font-normal">Track & manage wholesale orders</span>
        </h1>
        <Button asChild size="sm" className="h-8 text-xs">
          <Link href="/dashboard/order-from-warehouse">
            <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
            ➕ Create Purchase Order
          </Link>
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          title="Total Orders"
          value={kpi?.totalOrders ?? 0}
          subtitle={`৳ ${Number(kpi?.totalAmount || 0).toLocaleString("en-BD")}`}
          icon={<ShoppingBag className="h-4 w-4" />}
          iconBg="bg-slate-100 dark:bg-slate-800"
          iconColor="text-slate-600 dark:text-slate-400"
          loading={isLoading}
        />
        <KpiCard
          title="Pending"
          value={(kpi?.pendingCount ?? 0) + (kpi?.confirmedCount ?? 0)}
          subtitle={`৳ ${Number(kpi?.pendingAmount || 0).toLocaleString("en-BD")}`}
          icon={<Clock className="h-4 w-4" />}
          iconBg="bg-amber-50 dark:bg-amber-950/30"
          iconColor="text-amber-600 dark:text-amber-400"
          loading={isLoading}
        />
        <KpiCard
          title="In Delivery"
          value={kpi?.processingCount ?? 0}
          icon={<Truck className="h-4 w-4" />}
          iconBg="bg-indigo-50 dark:bg-indigo-950/30"
          iconColor="text-indigo-600 dark:text-indigo-400"
          loading={isLoading}
        />
        <KpiCard
          title="Received"
          value={kpi?.deliveredCount ?? 0}
          icon={<PackageCheck className="h-4 w-4" />}
          iconBg="bg-emerald-50 dark:bg-emerald-950/30"
          iconColor="text-emerald-600 dark:text-emerald-400"
          loading={isLoading}
        />
      </div>

      {/* ── 📊 Last Order Status 🔥 ── */}
      {!isLoading && orders.length > 0 && (() => {
        const latest = orders[0] as any;
        const hasModifications = latest.items?.some((item: any) => item.modifiedQty !== null);
        const statusSteps = [
          { key: "submitted", label: "Submitted", icon: "🟢", done: true },
          { key: "confirmed", label: hasModifications ? "Accepted (Edited)" : "Accepted", icon: hasModifications ? "🔁" : "✔", done: ["confirmed", "processing", "delivered"].includes(latest.status) },
          { key: "waiting", label: "Waiting", icon: "⏳", done: ["processing", "delivered"].includes(latest.status) },
          { key: "picked", label: "Picked", icon: "🚚", done: ["processing", "delivered"].includes(latest.status) },
          { key: "delivery", label: "Delivery", icon: "📍", done: latest.status === "delivered" },
          { key: "done", label: "Done", icon: "✅", done: latest.status === "delivered" },
        ];
        const currentIdx = latest.status === "cancelled"
          ? -1
          : latest.status === "delivered"
            ? 5
            : latest.status === "processing"
              ? 3
              : latest.status === "confirmed"
                ? 1
                : 0;

        return (
          <Card className="border shadow-sm overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  📊 Last Order Status
                  <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0">{latest.orderNumber}</Badge>
                </p>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  ৳ {Number(latest.total).toLocaleString("en-BD")}
                </span>
              </div>

              {latest.status === "cancelled" ? (
                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-medium text-red-700 dark:text-red-300">This order was cancelled</span>
                </div>
              ) : (
                <div className="flex items-center gap-0 overflow-x-auto">
                  {statusSteps.map((step, i) => {
                    const isCurrent = i === currentIdx;
                    const isLast = i === statusSteps.length - 1;
                    return (
                      <div key={step.key} className="flex items-center">
                        <div className="flex flex-col items-center min-w-[56px]">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                              step.done
                                ? "bg-emerald-500 text-white shadow-sm"
                                : isCurrent
                                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30 shadow-sm"
                                  : "bg-muted border border-muted-foreground/20"
                            }`}
                          >
                            {step.done ? "✓" : step.icon}
                          </div>
                          <p className={`text-[9px] mt-1 font-medium text-center leading-tight ${
                            step.done ? "text-emerald-700 dark:text-emerald-400"
                              : isCurrent ? "text-primary font-bold"
                              : "text-muted-foreground"
                          }`}>
                            {step.label}
                          </p>
                        </div>
                        {!isLast && (
                          <div className={`w-5 h-0.5 -mt-3 ${
                            statusSteps[i + 1]?.done ? "bg-emerald-400" : "bg-muted"
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {currentIdx >= 0 && currentIdx < 5 && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Current: {statusSteps[currentIdx]?.icon} <span className="font-medium">{statusSteps[currentIdx]?.label}</span>
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Wholesaler / Product / PO ID..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={dateRange} onValueChange={(v) => { setDateRange(v); setPage(1); }}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <CalendarIcon className="mr-1.5 h-3 w-3 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Status Tabs ────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-1 px-1">
        {statusTabs.map((tab) => {
          const isActive = statusFilter === tab.value;
          const count = tab.value === "all"
            ? kpi?.totalOrders
            : tab.value === "pending"
              ? kpi?.pendingCount
              : tab.value === "confirmed"
                ? kpi?.confirmedCount
                : tab.value === "processing"
                  ? kpi?.processingCount
                  : tab.value === "delivered"
                    ? kpi?.deliveredCount
                    : kpi?.cancelledCount;
          return (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`
                flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer
                ${isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className={`
                  text-[9px] px-1.5 py-0.5 rounded-full font-semibold
                  ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted-foreground/10 text-muted-foreground"}
                `}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Orders Table ───────────────────────────────────── */}
      {isLoading ? (
        <OrdersTableSkeleton />
      ) : isError ? (
        <div className="bg-card rounded-xl border shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Failed to load orders</p>
          <p className="text-sm text-muted-foreground mt-1">Please try again later</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-card rounded-xl border shadow-sm p-12 text-center">
          <ShoppingBag className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-lg font-semibold text-foreground">No purchase orders found</p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {searchDebounced || statusFilter !== "all"
              ? "Try adjusting your search or filter criteria"
              : "Place your first wholesale order to get started"}
          </p>
          {!searchDebounced && statusFilter === "all" && (
            <Button asChild>
              <Link href="/dashboard/order-from-warehouse">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Create Purchase Order
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Order #</TableHead>
                  <TableHead className="font-semibold">Wholesaler</TableHead>
                  <TableHead className="font-semibold">Products</TableHead>
                  <TableHead className="text-right font-semibold">Amount</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">OTP</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="text-right font-semibold">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o: any) => {
                  const config = statusConfig[o.status] || statusConfig.pending;
                  const hasModifications = o.items?.some(
                    (item: any) => item.modifiedQty !== null
                  );

                  return (
                    <TableRow
                      key={o.id}
                      className="group hover:bg-muted/30 transition-colors"
                    >
                      {/* Order Number */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {o.orderNumber}
                          </span>
                          {hasModifications && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/30">
                              Modified
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Wholesaler */}
                      <TableCell>
                        <span className="text-sm font-medium">{o.warehouseName}</span>
                      </TableCell>

                      {/* Products */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {/* Stacked product images */}
                          <div className="flex -space-x-2 shrink-0">
                            {o.items?.slice(0, 3).map((item: any, i: number) => (
                              item.productImage ? (
                                <Image
                                  key={i}
                                  src={item.productImage}
                                  alt={item.productName}
                                  width={28}
                                  height={28}
                                  className="w-7 h-7 rounded-md border-2 border-background object-cover"
                                />
                              ) : (
                                <div
                                  key={i}
                                  className="w-7 h-7 rounded-md border-2 border-background bg-muted flex items-center justify-center"
                                >
                                  <Package className="w-3 h-3 text-muted-foreground" />
                                </div>
                              )
                            ))}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm truncate max-w-[160px]">
                              {o.items?.[0]?.productName || "—"}
                            </p>
                            {(o.items?.length || 0) > 1 && (
                              <p className="text-[11px] text-muted-foreground">
                                +{o.items.length - 1} more item{o.items.length - 1 > 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold tabular-nums">
                          ৳ {Number(o.total).toLocaleString("en-BD")}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1 text-[11px] font-medium ${config.className}`}
                        >
                          {config.icon}
                          {config.label}
                        </Badge>
                      </TableCell>

                      {/* OTP */}
                      <TableCell>
                        <DeliveryOtpBadge orderId={o.id} status={o.status} />
                      </TableCell>

                      {/* Date */}
                      <TableCell>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {new Date(o.createdAt).toLocaleDateString("en-BD", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </TableCell>

                      {/* Action */}
                      <TableCell className="text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="text-xs opacity-60 group-hover:opacity-100 transition-opacity"
                        >
                          <Link href={`/dashboard/orders/${o.id}`}>
                            View →
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
                <span className="hidden sm:inline"> · {pagination.totalCount} orders</span>
              </p>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── KPI Card Component ─────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  iconBg,
  iconColor,
  loading,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </span>
          <div className={`p-1 rounded-md ${iconBg} ${iconColor}`}>
            {icon}
          </div>
        </div>
        {loading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
        ) : (
          <>
            <p className="text-xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Skeleton ───────────────────────────────────────────────

function OrdersTableSkeleton() {
  return (
    <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Order #</TableHead>
            <TableHead>Wholesaler</TableHead>
            <TableHead>Products</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>OTP</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </TableCell>
              <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
              <TableCell><Skeleton className="h-5 w-14" /></TableCell>
              <TableCell><Skeleton className="h-4 w-14" /></TableCell>
              <TableCell><Skeleton className="h-7 w-12 ml-auto" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
