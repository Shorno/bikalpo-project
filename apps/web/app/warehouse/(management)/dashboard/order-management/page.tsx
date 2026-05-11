"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Inbox,
  PackageCheck,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type Source = "direct" | "salesman" | "estimate" | "pre_order";
type StatusFilter = "all" | "pending" | "accepted" | "processing" | "rejected";
type PaymentFilter = "all" | "paid" | "due" | "partial";
type DateFilter = "today" | "this_month" | "custom" | "all";

const sourceCards: Array<{
  key: Source;
  label: string;
  description: string;
  enabled: boolean;
  accentClassName: string;
  activeClassName: string;
  countClassName: string;
}> = [
  {
    key: "direct",
    label: "Direct",
    description: "Retailer checkout",
    enabled: true,
    accentClassName: "bg-rose-500",
    activeClassName: "border-rose-300 bg-rose-50/80 text-rose-950",
    countClassName: "text-rose-700",
  },
  {
    key: "salesman",
    label: "Salesman",
    description: "Field sales flow",
    enabled: false,
    accentClassName: "bg-sky-500",
    activeClassName: "border-sky-300 bg-sky-50/80 text-sky-950",
    countClassName: "text-sky-700",
  },
  {
    key: "estimate",
    label: "Estimate",
    description: "Quote conversions",
    enabled: false,
    accentClassName: "bg-violet-500",
    activeClassName: "border-violet-300 bg-violet-50/80 text-violet-950",
    countClassName: "text-violet-700",
  },
  {
    key: "pre_order",
    label: "Pre-order",
    description: "Reserved demand",
    enabled: false,
    accentClassName: "bg-amber-500",
    activeClassName: "border-amber-300 bg-amber-50/80 text-amber-950",
    countClassName: "text-amber-700",
  },
];

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All status" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "processing", label: "Processing" },
  { value: "rejected", label: "Rejected" },
];

const paymentOptions: Array<{
  value: PaymentFilter;
  label: string;
  disabled?: boolean;
}> = [
  { value: "all", label: "All payment" },
  { value: "paid", label: "Paid" },
  { value: "due", label: "Due" },
  { value: "partial", label: "Partial", disabled: true },
];

const controlClassName =
  "h-10 w-full rounded-md border border-slate-200 bg-[oklch(0.99_0.004_100)] px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-[oklch(0.998_0.002_110)] focus:ring-3 focus:ring-slate-400/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

const searchControlClassName =
  "h-10 w-full rounded-md border border-slate-200 bg-[oklch(0.99_0.004_100)] px-3 text-sm text-slate-900 outline-none transition focus-within:border-slate-400 focus-within:bg-[oklch(0.998_0.002_110)] focus-within:ring-3 focus-within:ring-slate-400/15";

const selectTriggerClassName =
  "h-10 w-full justify-between rounded-md border-slate-200 bg-[oklch(0.99_0.004_100)] px-3 text-sm text-slate-900 shadow-none hover:bg-[oklch(0.985_0.004_100)] focus-visible:border-slate-400 focus-visible:ring-3 focus-visible:ring-slate-400/15 data-[placeholder]:text-slate-400 [&_svg]:text-slate-500";

const selectContentClassName =
  "border border-slate-800 bg-slate-950/95 text-slate-100 shadow-xl ring-slate-950/10 before:backdrop-blur-none";

const selectItemClassName =
  "text-slate-200 focus:bg-slate-800 focus:text-slate-50 data-disabled:text-slate-500";

const labelClassName =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";

function formatMoney(value: unknown) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD")}`;
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dateRangeLabel(value: DateFilter) {
  if (value === "today") {
    return "Today";
  }
  if (value === "this_month") {
    return "This month";
  }
  if (value === "custom") {
    return "Custom range";
  }
  return "All dates";
}

type OrderStatusRow = {
  status: string;
  requiresBuyerAcceptance?: boolean;
  invoicePrepared?: boolean;
  invoiceDeliveryStatus?: string | null;
  deliveryGroupStatus?: string | null;
  deliverymanId?: string | null;
  readyAt?: string | Date | null;
  packingStartedAt?: string | Date | null;
};

function statusBadge(order: OrderStatusRow) {
  if (order.status === "cancelled") {
    return {
      label: "Rejected",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      icon: XCircle,
    };
  }
  if (order.requiresBuyerAcceptance) {
    return {
      label: "Accepted, buyer review",
      className: "border-orange-200 bg-orange-50 text-orange-700",
      icon: AlertCircle,
    };
  }
  if (
    order.status === "delivered" ||
    order.invoiceDeliveryStatus === "delivered" ||
    order.deliveryGroupStatus === "completed"
  ) {
    return {
      label: "Delivered",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    };
  }
  if (order.deliveryGroupStatus === "partial") {
    return {
      label: "Partial delivery",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      icon: AlertCircle,
    };
  }
  if (order.deliveryGroupStatus === "out_for_delivery") {
    return {
      label: "Out for delivery",
      className: "border-blue-200 bg-blue-50 text-blue-700",
      icon: Truck,
    };
  }
  if (order.deliveryGroupStatus === "assigned" || order.deliverymanId) {
    return {
      label: "Delivery assigned",
      className: "border-sky-200 bg-sky-50 text-sky-700",
      icon: Truck,
    };
  }
  if (order.invoicePrepared || order.readyAt || order.packingStartedAt) {
    return {
      label: "Ready for dispatch",
      className: "border-violet-200 bg-violet-50 text-violet-700",
      icon: PackageCheck,
    };
  }
  if (order.status === "processing") {
    return {
      label: "Processing",
      className: "border-blue-200 bg-blue-50 text-blue-700",
      icon: Truck,
    };
  }
  if (order.status === "confirmed") {
    return {
      label: "Accepted",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    };
  }
  return {
    label: "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock,
  };
}

export default function WarehouseOrderManagementPage() {
  const [source, setSource] = useState<Source>("direct");
  const [page, setPage] = useState(1);

  const [draftSearch, setDraftSearch] = useState("");
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("all");
  const [draftPayment, setDraftPayment] = useState<PaymentFilter>("all");
  const [draftDateRange, setDraftDateRange] = useState<DateFilter>("all");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    status: "all" as StatusFilter,
    payment: "all" as PaymentFilter,
    dateRange: "all" as DateFilter,
    dateFrom: "",
    dateTo: "",
  });

  const queryInput = useMemo(
    () => ({
      source,
      status: filters.status,
      payment: filters.payment,
      dateRange: filters.dateRange,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      search: filters.search || undefined,
      page,
      limit: 20,
    }),
    [filters, page, source],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["warehouse", "order-management", queryInput],
    queryFn: () => orpc.warehouse.getOrderOverview.call(queryInput),
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination;
  const summary = data?.summary ?? {
    direct: 0,
    salesman: 0,
    estimate: 0,
    preOrder: 0,
  };

  const counts: Record<Source, number> = {
    direct: summary.direct,
    salesman: summary.salesman,
    estimate: summary.estimate,
    pre_order: summary.preOrder,
  };

  const selectedSource =
    sourceCards.find((card) => card.key === source) ?? sourceCards[0];
  const activeCount = counts[source];
  const totalOrders =
    counts.direct + counts.salesman + counts.estimate + counts.pre_order;

  const applyFilters = () => {
    setFilters({
      search: draftSearch,
      status: draftStatus,
      payment: draftPayment,
      dateRange: draftDateRange,
      dateFrom: draftDateFrom,
      dateTo: draftDateTo,
    });
    setPage(1);
  };

  return (
    <div className="space-y-4 text-slate-950">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-[oklch(0.995_0.003_105)] shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)]">
        <div className="grid lg:grid-cols-[1fr_340px]">
          <div className="border-b border-slate-200 p-5 md:p-6 lg:border-r lg:border-b-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <PackageCheck className="h-4 w-4 text-slate-500" />
              Sales management / Order management
            </div>
            <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-[1.65rem] font-semibold tracking-tight text-slate-950">
                  Order management
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Review direct retailer orders, filter the queue, and move
                  accepted work toward dispatch.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-[oklch(0.998_0.002_110)] px-3 text-xs font-medium text-slate-700">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                  {dateRangeLabel(filters.dateRange)}
                </span>
                <span className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-[oklch(0.998_0.002_110)] px-3 text-xs font-medium text-slate-700">
                  {data?.warehouse.label ?? "Loading warehouse"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-5 text-slate-100 md:p-6">
            <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              <span>Queue in view</span>
              <span>{selectedSource.label}</span>
            </div>
            <div className="mt-5 flex items-end gap-3">
              <span className="text-4xl font-semibold tracking-tight text-slate-50">
                {activeCount}
              </span>
              <span className="pb-1 text-sm text-slate-300">
                orders currently matching filters
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-slate-50/10 bg-slate-50/5 p-3">
                <div className="text-slate-400">All sources</div>
                <div className="mt-1 text-base font-semibold text-slate-100">
                  {totalOrders}
                </div>
              </div>
              <div className="rounded-md border border-slate-50/10 bg-slate-50/5 p-3">
                <div className="text-slate-400">Date scope</div>
                <div className="mt-1 text-base font-semibold text-slate-100">
                  {dateRangeLabel(filters.dateRange)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-[oklch(0.998_0.002_110)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-slate-600">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                Queue controls
              </h2>
              <p className="text-xs text-slate-500">
                Search by order, customer, or phone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={applyFilters}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-slate-50 shadow-sm transition hover:bg-slate-800 focus-visible:ring-3 focus-visible:ring-slate-400/30"
          >
            Apply filters
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(260px,2fr)_repeat(3,minmax(150px,1fr))]">
          <label>
            <span className={labelClassName}>Search</span>
            <div
              className={cn(
                searchControlClassName,
                "flex items-center gap-2 px-3",
              )}
            >
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
                placeholder="Order ID, customer, or phone"
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </label>

          <label>
            <span className={labelClassName}>Status</span>
            <Select
              value={draftStatus}
              onValueChange={(value) => setDraftStatus(value as StatusFilter)}
            >
              <SelectTrigger className={selectTriggerClassName}>
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                {statusOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className={selectItemClassName}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label>
            <span className={labelClassName}>Payment</span>
            <Select
              value={draftPayment}
              onValueChange={(value) => setDraftPayment(value as PaymentFilter)}
            >
              <SelectTrigger className={selectTriggerClassName}>
                <SelectValue placeholder="All payment" />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                {paymentOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className={selectItemClassName}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label>
            <span className={labelClassName}>Date</span>
            <Select
              value={draftDateRange}
              onValueChange={(value) => setDraftDateRange(value as DateFilter)}
            >
              <SelectTrigger className={selectTriggerClassName}>
                <SelectValue placeholder="All dates" />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                <SelectItem value="today" className={selectItemClassName}>
                  Today
                </SelectItem>
                <SelectItem value="this_month" className={selectItemClassName}>
                  This month
                </SelectItem>
                <SelectItem value="custom" className={selectItemClassName}>
                  Custom range
                </SelectItem>
                <SelectItem value="all" className={selectItemClassName}>
                  All dates
                </SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>

        {draftDateRange === "custom" && (
          <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-3">
            <div className="grid gap-3 md:grid-cols-2 xl:w-1/2">
              <label>
                <span className={labelClassName}>From</span>
                <input
                  type="date"
                  value={draftDateFrom}
                  onChange={(event) => setDraftDateFrom(event.target.value)}
                  className={controlClassName}
                />
              </label>
              <label>
                <span className={labelClassName}>To</span>
                <input
                  type="date"
                  value={draftDateTo}
                  onChange={(event) => setDraftDateTo(event.target.value)}
                  className={controlClassName}
                />
              </label>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-[oklch(0.998_0.002_110)] shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 bg-[oklch(0.985_0.004_100)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">
              Order sources
            </h2>
            <p className="text-xs text-slate-500">
              Direct is live now. Additional queues are prepared for rollout.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Direct v1 active
          </span>
        </div>
        <div className="grid divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
          {sourceCards.map((card) => {
            const isActive = source === card.key;
            return (
              <button
                key={card.key}
                type="button"
                disabled={!card.enabled}
                onClick={() => {
                  setSource(card.key);
                  setPage(1);
                }}
                className={cn(
                  "min-h-[112px] border-transparent bg-[oklch(0.998_0.002_110)] p-4 text-left transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-slate-400/15",
                  isActive && card.activeClassName,
                  card.enabled && !isActive && "hover:bg-slate-50",
                  !card.enabled &&
                    "cursor-not-allowed bg-slate-50/70 text-slate-400 hover:bg-slate-50/70",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        card.enabled ? card.accentClassName : "bg-slate-300",
                      )}
                    />
                    <span className="text-sm font-semibold">{card.label}</span>
                  </div>
                  <ShoppingCart className="h-4 w-4 opacity-60" />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div
                    className={cn(
                      "text-3xl font-semibold tracking-tight",
                      card.enabled ? card.countClassName : "text-slate-400",
                    )}
                  >
                    {counts[card.key]}
                  </div>
                  <span className="rounded-md border border-current/10 bg-slate-50/70 px-2 py-1 text-[11px] font-medium">
                    {card.enabled ? "Live queue" : "Coming later"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-current/70">
                  {card.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-[oklch(0.998_0.002_110)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                selectedSource.accentClassName,
              )}
            />
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                {selectedSource.label} queue
              </h2>
              <p className="text-xs text-slate-500">
                {activeCount} orders, {dateRangeLabel(filters.dateRange)} view
              </p>
            </div>
          </div>
          <Link
            href="/warehouse/dashboard/dispatch-orders"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-slate-200 bg-[oklch(0.998_0.002_110)] px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Truck className="h-3.5 w-3.5" />
            Dispatch board
          </Link>
        </div>

        {isLoading ? (
          <div className="p-4">
            <div className="overflow-hidden rounded-md border border-slate-200">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="grid gap-4 border-b border-slate-100 p-4 last:border-0 md:grid-cols-[1.2fr_1.4fr_0.8fr_0.8fr_1fr_0.8fr]"
                >
                  <div className="h-4 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 animate-pulse rounded bg-slate-200" />
                  <div className="h-4 animate-pulse rounded bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
        ) : isError ? (
          <div className="grid min-h-[280px] place-items-center px-6 py-12 text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-500">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-950">
                Failed to load orders
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Refresh the queue or try a different filter set.
              </p>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="grid min-h-[280px] place-items-center px-6 py-12 text-center">
            <div className="max-w-md">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400">
                <Inbox className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-950">
                No direct orders match this view
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                New retailer orders and filtered results will appear here when
                the queue has matching work.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((item: any) => {
                  const badge = statusBadge(item);
                  const BadgeIcon = badge.icon;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 transition last:border-0 hover:bg-[oklch(0.985_0.005_145)]"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-[13px] font-semibold tracking-tight text-slate-950">
                          {item.orderNumber}
                        </div>
                        <div className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                          {item.itemCount} item{item.itemCount === 1 ? "" : "s"}
                          {item.firstItemName ? ` / ${item.firstItemName}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
                            <User className="h-4 w-4 text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900">
                              {item.customerName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {item.shippingPhone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="font-semibold text-slate-950">
                          {formatMoney(item.total)}
                        </div>
                        <div className="text-xs text-slate-500">
                          Order total
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold",
                            badge.className,
                          )}
                        >
                          <BadgeIcon className="h-3.5 w-3.5" />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/warehouse/dashboard/order-management/${item.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-[oklch(0.998_0.002_110)] px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          Review order
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-500">
              Page {pagination.page} of {pagination.totalPages}.{" "}
              {pagination.totalCount} orders total.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
                className="h-8 rounded-md border border-slate-200 bg-[oklch(0.998_0.002_110)] px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="h-8 rounded-md border border-slate-200 bg-[oklch(0.998_0.002_110)] px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
