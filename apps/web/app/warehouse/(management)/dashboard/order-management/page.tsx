"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Filter,
  Inbox,
  PackageCheck,
  Search,
  ShoppingCart,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { orpc } from "@/utils/orpc";

type Source = "direct" | "salesman" | "estimate" | "pre_order";
type StatusFilter = "all" | "pending" | "accepted" | "processing" | "rejected";
type PaymentFilter = "all" | "paid" | "due" | "partial";
type DateFilter = "today" | "this_month" | "custom" | "all";

const sourceCards: Array<{
  key: Source;
  label: string;
  tone: string;
  enabled: boolean;
}> = [
  {
    key: "direct",
    label: "Direct",
    tone: "border-red-200 bg-red-50 text-red-700",
    enabled: true,
  },
  {
    key: "salesman",
    label: "Salesman",
    tone: "border-sky-200 bg-sky-50 text-sky-700",
    enabled: false,
  },
  {
    key: "estimate",
    label: "Estimate",
    tone: "border-violet-200 bg-violet-50 text-violet-700",
    enabled: false,
  },
  {
    key: "pre_order",
    label: "Pre-Order",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    enabled: false,
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

function statusBadge(status: string, requiresBuyerAcceptance?: boolean) {
  if (status === "cancelled") {
    return {
      label: "Rejected",
      className: "border-red-200 bg-red-50 text-red-700",
      icon: XCircle,
    };
  }
  if (requiresBuyerAcceptance) {
    return {
      label: "Accepted (Modify)",
      className: "border-orange-200 bg-orange-50 text-orange-700",
      icon: AlertCircle,
    };
  }
  if (status === "confirmed") {
    return {
      label: "Accepted",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    };
  }
  if (status === "processing") {
    return {
      label: "Processing",
      className: "border-blue-200 bg-blue-50 text-blue-700",
      icon: Truck,
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
  const [draftDateRange, setDraftDateRange] = useState<DateFilter>("today");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    status: "all" as StatusFilter,
    payment: "all" as PaymentFilter,
    dateRange: "today" as DateFilter,
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <PackageCheck className="h-4 w-4" />
            Sales Management / Order Management
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950">
            Order Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Warehouse: {data?.warehouse.label ?? "Loading warehouse..."}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          Showing{" "}
          {filters.dateRange === "today"
            ? "Today"
            : filters.dateRange === "this_month"
              ? "This Month"
              : filters.dateRange === "custom"
                ? "Custom"
                : "All"}
        </div>
      </div>

      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Filter className="h-4 w-4" />
          Search & Filter
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Search
            </span>
            <div className="flex items-center gap-2 rounded-lg border bg-white px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={draftSearch}
                onChange={(event) => setDraftSearch(event.target.value)}
                placeholder="Order ID / Customer / Phone"
                className="h-10 w-full bg-transparent text-sm outline-none"
              />
            </div>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Status
            </span>
            <select
              value={draftStatus}
              onChange={(event) =>
                setDraftStatus(event.target.value as StatusFilter)
              }
              className="h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Payment
            </span>
            <select
              value={draftPayment}
              onChange={(event) =>
                setDraftPayment(event.target.value as PaymentFilter)
              }
              className="h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none"
            >
              {paymentOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                  {option.disabled ? " - static" : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Priority
            </span>
            <select
              disabled
              className="h-10 w-full rounded-lg border bg-gray-50 px-3 text-sm text-muted-foreground outline-none"
            >
              <option>Normal / Urgent - static</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Date
            </span>
            <select
              value={draftDateRange}
              onChange={(event) =>
                setDraftDateRange(event.target.value as DateFilter)
              }
              className="h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none"
            >
              <option value="today">Today</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        {draftDateRange === "custom" && (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:w-1/2">
            <input
              type="date"
              value={draftDateFrom}
              onChange={(event) => setDraftDateFrom(event.target.value)}
              className="h-10 rounded-lg border px-3 text-sm outline-none"
            />
            <input
              type="date"
              value={draftDateTo}
              onChange={(event) => setDraftDateTo(event.target.value)}
              className="h-10 rounded-lg border px-3 text-sm outline-none"
            />
          </div>
        )}

        <button
          type="button"
          onClick={applyFilters}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-medium text-white hover:bg-gray-800"
        >
          Apply Filters
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
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
              className={`rounded-lg border p-4 text-left shadow-sm transition ${card.tone} ${
                isActive ? "ring-2 ring-gray-950/80" : ""
              } ${card.enabled ? "hover:-translate-y-0.5" : "cursor-not-allowed opacity-55"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{card.label}</span>
                <ShoppingCart className="h-4 w-4" />
              </div>
              <div className="mt-3 text-3xl font-bold">{counts[card.key]}</div>
              {!card.enabled && (
                <div className="mt-2 text-xs opacity-80">
                  Static in Direct v1
                </div>
              )}
            </button>
          );
        })}
      </section>

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          {sourceCards.map((tab) => (
            <button
              key={tab.key}
              type="button"
              disabled={!tab.enabled}
              onClick={() => tab.enabled && setSource(tab.key)}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                source === tab.key
                  ? "bg-gray-950 text-white"
                  : tab.enabled
                    ? "text-gray-700 hover:bg-gray-100"
                    : "cursor-not-allowed text-muted-foreground opacity-60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            Loading direct orders...
          </div>
        ) : isError ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <AlertCircle className="mb-2 h-10 w-10 text-red-300" />
            <p className="font-medium text-red-600">Failed to load orders</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center text-center">
            <Inbox className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold text-gray-900">
              No orders available
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Direct retailer orders will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((item: any) => {
                  const badge = statusBadge(
                    item.status,
                    item.requiresBuyerAcceptance,
                  );
                  const BadgeIcon = badge.icon;
                  return (
                    <tr
                      key={item.id}
                      className="border-b last:border-0 hover:bg-gray-50/70"
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-semibold text-gray-950">
                          {item.orderNumber}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {item.itemCount} item{item.itemCount === 1 ? "" : "s"}
                          {item.firstItemName ? ` / ${item.firstItemName}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {item.customerName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.shippingPhone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-950">
                        {formatMoney(item.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${badge.className}`}
                        >
                          <BadgeIcon className="h-3.5 w-3.5" />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/warehouse/dashboard/order-management/${item.id}`}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-gray-50"
                        >
                          View Details
                          <ArrowRight className="h-4 w-4" />
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
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages} /{" "}
              {pagination.totalCount} orders
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-md border px-3 py-1.5 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-md border px-3 py-1.5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <Link
          href="/warehouse/dashboard/order-management"
          className="rounded-lg border bg-white p-3 text-sm font-medium hover:bg-gray-50"
        >
          View Details
        </Link>
        <Link
          href="/warehouse/dashboard/dispatch-orders"
          className="rounded-lg border bg-white p-3 text-sm font-medium hover:bg-gray-50"
        >
          Go to Dispatch
        </Link>
        <button
          type="button"
          disabled
          className="rounded-lg border bg-gray-50 p-3 text-left text-sm font-medium text-muted-foreground"
        >
          View Customer - static
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border bg-gray-50 p-3 text-left text-sm font-medium text-muted-foreground"
        >
          View Salesman - static
        </button>
      </section>
    </div>
  );
}
