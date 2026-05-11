"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  Inbox,
  Loader2,
  PackageCheck,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  UserRound,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type SaleType = "all" | "pos" | "order" | "salesman" | "pre_order";
type SaleStatus = "all" | "completed" | "due" | "cancelled";
type PaymentFilter = "all" | "cash" | "bkash" | "nagad" | "bank" | "due";
type DateFilter = "today" | "this_week" | "this_month" | "custom" | "all";

type SaleRow = {
  key: string;
  kind: "pos" | "invoice";
  id: number;
  invoiceNumber: string;
  date: string | Date;
  customerName: string;
  customerPhone: string | null;
  type: Exclude<SaleType, "all">;
  typeLabel: string;
  typeDetail: string | null;
  total: number;
  paid: number;
  due: number;
  paymentMethodLabel: string;
  status: Exclude<SaleStatus, "all">;
  statusLabel: string;
  orderNumber: string | null;
  estimateRef: string | null;
  salesmanName: string | null;
  itemCount: number;
  firstItemName: string | null;
};

const WH = "/warehouse/dashboard";

const saleTypeCards: Array<{
  key: Exclude<SaleType, "all">;
  label: string;
  description: string;
  accentClassName: string;
  activeClassName: string;
  countClassName: string;
}> = [
  {
    key: "pos",
    label: "POS",
    description: "Counter sales",
    accentClassName: "bg-emerald-500",
    activeClassName: "border-emerald-300 bg-emerald-50/80 text-emerald-950",
    countClassName: "text-emerald-700",
  },
  {
    key: "order",
    label: "Order invoices",
    description: "Generated from orders",
    accentClassName: "bg-rose-500",
    activeClassName: "border-rose-300 bg-rose-50/80 text-rose-950",
    countClassName: "text-rose-700",
  },
  {
    key: "salesman",
    label: "Salesman",
    description: "Field sales",
    accentClassName: "bg-sky-500",
    activeClassName: "border-sky-300 bg-sky-50/80 text-sky-950",
    countClassName: "text-sky-700",
  },
  {
    key: "pre_order",
    label: "Pre-order",
    description: "Reserved demand",
    accentClassName: "bg-amber-500",
    activeClassName: "border-amber-300 bg-amber-50/80 text-amber-950",
    countClassName: "text-amber-700",
  },
];

const statusOptions: Array<{ value: SaleStatus; label: string }> = [
  { value: "all", label: "All status" },
  { value: "completed", label: "Completed" },
  { value: "due", label: "Due" },
  { value: "cancelled", label: "Cancelled" },
];

const paymentOptions: Array<{ value: PaymentFilter; label: string }> = [
  { value: "all", label: "All payment" },
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "bank", label: "Bank" },
  { value: "due", label: "Due" },
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

function money(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  return `\u09F3${(Number.isFinite(parsed) ? parsed : 0).toLocaleString(
    "en-BD",
    {
      maximumFractionDigits: 2,
    },
  )}`;
}

function formatDateTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  const dateLabel = date.toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
  });
  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateLabel} ${timeLabel}`;
}

function dateRangeLabel(value: DateFilter) {
  if (value === "today") return "Today";
  if (value === "this_week") return "This week";
  if (value === "this_month") return "This month";
  if (value === "custom") return "Custom range";
  return "All dates";
}

function statusClassName(status: SaleRow["status"]) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "cancelled") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function typeClassName(type: SaleRow["type"]) {
  const card = saleTypeCards.find((item) => item.key === type);
  return card?.activeClassName ?? "border-slate-200 bg-slate-50 text-slate-700";
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export default function WarehouseSalesPage() {
  const [page, setPage] = useState(1);
  const [selectedSale, setSelectedSale] = useState<{
    kind: "pos" | "invoice";
    id: number;
  } | null>(null);

  const [draftSearch, setDraftSearch] = useState("");
  const [draftType, setDraftType] = useState<SaleType>("all");
  const [draftStatus, setDraftStatus] = useState<SaleStatus>("all");
  const [draftPayment, setDraftPayment] = useState<PaymentFilter>("all");
  const [draftSalesman, setDraftSalesman] = useState("all");
  const [draftDateRange, setDraftDateRange] = useState<DateFilter>("all");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");

  const [filters, setFilters] = useState({
    search: "",
    type: "all" as SaleType,
    status: "all" as SaleStatus,
    payment: "all" as PaymentFilter,
    salesmanId: "all",
    dateRange: "all" as DateFilter,
    dateFrom: "",
    dateTo: "",
  });

  const queryInput = useMemo(
    () => ({
      search: filters.search || undefined,
      type: filters.type,
      status: filters.status,
      payment: filters.payment,
      salesmanId: filters.salesmanId === "all" ? undefined : filters.salesmanId,
      dateRange: filters.dateRange,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      page,
      limit: 20,
    }),
    [filters, page],
  );

  const { data, isError, isLoading } = useQuery({
    queryKey: ["warehouseSales", "listSales", queryInput],
    queryFn: () => orpc.warehouseSales.listSales.call(queryInput),
  });

  const detailQuery = useQuery({
    queryKey: ["warehouseSales", "detail", selectedSale],
    queryFn: () =>
      orpc.warehouseSales.getSaleDetail.call({
        kind: selectedSale!.kind,
        id: selectedSale!.id,
      }),
    enabled: !!selectedSale,
  });

  const rows = (data?.rows ?? []) as SaleRow[];
  const exportRows = (data?.exportRows ?? []) as SaleRow[];
  const pagination = data?.pagination;
  const counts = data?.summary?.counts ?? {
    pos: 0,
    order: 0,
    salesman: 0,
    pre_order: 0,
  };
  const totalTransactions = pagination?.totalCount ?? rows.length;

  const applyFilters = () => {
    setFilters({
      search: draftSearch,
      type: draftType,
      status: draftStatus,
      payment: draftPayment,
      salesmanId: draftSalesman,
      dateRange: draftDateRange,
      dateFrom: draftDateFrom,
      dateTo: draftDateTo,
    });
    setPage(1);
  };

  const selectType = (type: SaleType) => {
    setDraftType(type);
    setFilters((current) => ({ ...current, type }));
    setPage(1);
  };

  const exportReport = () => {
    const headers = [
      "Invoice",
      "Date",
      "Customer",
      "Phone",
      "Type",
      "Total",
      "Paid",
      "Due",
      "Payment",
      "Status",
      "Order",
      "Estimate",
      "Salesman",
    ];
    const body = exportRows.map((row) => [
      row.invoiceNumber,
      formatDateTime(row.date),
      row.customerName,
      row.customerPhone,
      row.typeLabel,
      row.total,
      row.paid,
      row.due,
      row.paymentMethodLabel,
      row.statusLabel,
      row.orderNumber,
      row.estimateRef,
      row.salesmanName,
    ]);
    const csv = [headers, ...body]
      .map((line) => line.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `warehouse-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 text-slate-950">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-[oklch(0.995_0.003_105)] shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)]">
        <div className="grid lg:grid-cols-[1fr_360px]">
          <div className="border-b border-slate-200 p-5 md:p-6 lg:border-r lg:border-b-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              <Receipt className="h-4 w-4 text-slate-500" />
              Sales management / Sales history
            </div>
            <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-[1.65rem] font-semibold tracking-tight text-slate-950">
                  Sales
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Invoice-based sales across POS, generated order invoices,
                  salesman work, and pre-orders.
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
              <span>Sales in view</span>
              <span>{dateRangeLabel(filters.dateRange)}</span>
            </div>
            <div className="mt-5 flex items-end gap-3">
              <span className="text-4xl font-semibold tracking-tight text-slate-50">
                {totalTransactions}
              </span>
              <span className="pb-1 text-sm text-slate-300">
                matching invoices and POS sales
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-slate-50/10 bg-slate-50/5 p-3">
                <div className="text-slate-400">Collection</div>
                <div className="mt-1 text-base font-semibold text-slate-100">
                  {money(data?.summary?.totalPaid ?? 0)}
                </div>
              </div>
              <div className="rounded-md border border-slate-50/10 bg-slate-50/5 p-3">
                <div className="text-slate-400">Due</div>
                <div className="mt-1 text-base font-semibold text-amber-200">
                  {money(data?.summary?.totalDue ?? 0)}
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
                Search & filter
              </h2>
              <p className="text-xs text-slate-500">
                Search invoice, customer, phone, order, or salesman.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportReport}
              disabled={exportRows.length === 0}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-[oklch(0.998_0.002_110)] px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export report
            </button>
            <button
              type="button"
              onClick={applyFilters}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-slate-50 shadow-sm transition hover:bg-slate-800 focus-visible:ring-3 focus-visible:ring-slate-400/30"
            >
              Apply filters
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(250px,1.5fr)_repeat(5,minmax(140px,1fr))]">
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
                placeholder="Invoice ID, customer, or phone"
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
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
                <SelectItem value="this_week" className={selectItemClassName}>
                  This week
                </SelectItem>
                <SelectItem value="this_month" className={selectItemClassName}>
                  This month
                </SelectItem>
                <SelectItem value="custom" className={selectItemClassName}>
                  Custom
                </SelectItem>
                <SelectItem value="all" className={selectItemClassName}>
                  All dates
                </SelectItem>
              </SelectContent>
            </Select>
          </label>

          <label>
            <span className={labelClassName}>Type</span>
            <Select
              value={draftType}
              onValueChange={(value) => setDraftType(value as SaleType)}
            >
              <SelectTrigger className={selectTriggerClassName}>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                <SelectItem value="all" className={selectItemClassName}>
                  All types
                </SelectItem>
                {saleTypeCards.map((item) => (
                  <SelectItem
                    key={item.key}
                    value={item.key}
                    className={selectItemClassName}
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label>
            <span className={labelClassName}>Status</span>
            <Select
              value={draftStatus}
              onValueChange={(value) => setDraftStatus(value as SaleStatus)}
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
                    className={selectItemClassName}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label>
            <span className={labelClassName}>Salesman</span>
            <Select value={draftSalesman} onValueChange={setDraftSalesman}>
              <SelectTrigger className={selectTriggerClassName}>
                <SelectValue placeholder="All salesmen" />
              </SelectTrigger>
              <SelectContent className={selectContentClassName}>
                <SelectItem value="all" className={selectItemClassName}>
                  All salesmen
                </SelectItem>
                {data?.filterOptions.salesmen.map((salesman: any) => (
                  <SelectItem
                    key={salesman.id}
                    value={salesman.id}
                    className={selectItemClassName}
                  >
                    {salesman.name}
                  </SelectItem>
                ))}
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
              Sales records
            </h2>
            <p className="text-xs text-slate-500">
              Counts POS sales and generated order invoices, not every raw
              order. Type counts stay visible while the table filters.
            </p>
          </div>
          <button
            type="button"
            onClick={() => selectType("all")}
            className={cn(
              "h-8 rounded-md border px-3 text-xs font-semibold transition",
              filters.type === "all"
                ? "border-slate-950 bg-slate-950 text-slate-50"
                : "border-slate-200 bg-[oklch(0.998_0.002_110)] text-slate-600 hover:bg-slate-50",
            )}
          >
            All types
          </button>
        </div>
        <div className="grid divide-y divide-slate-200 md:grid-cols-4 md:divide-x md:divide-y-0">
          {saleTypeCards.map((card) => {
            const isActive = filters.type === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => selectType(card.key)}
                className={cn(
                  "min-h-[108px] border-transparent bg-[oklch(0.998_0.002_110)] p-4 text-left transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-slate-400/15",
                  isActive && card.activeClassName,
                  !isActive && "hover:bg-slate-50",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        card.accentClassName,
                      )}
                    />
                    <span className="text-sm font-semibold">{card.label}</span>
                  </div>
                  <ShoppingCart className="h-4 w-4 opacity-60" />
                </div>
                <div
                  className={cn(
                    "mt-4 text-3xl font-semibold tracking-tight",
                    card.countClassName,
                  )}
                >
                  {counts[card.key] ?? 0}
                </div>
                <p className="mt-2 text-xs text-current/70">
                  {card.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          icon={Banknote}
          label="Highest sale"
          value={
            data?.insights.highestSale
              ? money(data.insights.highestSale.amount)
              : money(0)
          }
          helper={data?.insights.highestSale?.invoiceNumber ?? "No sale yet"}
        />
        <InsightCard
          icon={PackageCheck}
          label="Most sales via"
          value={data?.insights.mostCommonType ?? "No sales"}
          helper="Current filters"
        />
        <InsightCard
          icon={AlertCircle}
          label="Due transactions"
          value={String(data?.insights.dueTransactions ?? 0)}
          helper={`${money(data?.summary?.totalDue ?? 0)} outstanding`}
        />
        <InsightCard
          icon={CalendarDays}
          label="Peak sales time"
          value={data?.insights.peakSalesTime ?? "No sales"}
          helper={dateRangeLabel(filters.dateRange)}
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-[oklch(0.998_0.002_110)] shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">
              Sales table
            </h2>
            <p className="text-xs text-slate-500">
              {pagination?.totalCount ?? 0} transactions,{" "}
              {dateRangeLabel(filters.dateRange)}
            </p>
          </div>
          <Link
            href={`${WH}/pos`}
            className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-slate-200 bg-[oklch(0.998_0.002_110)] px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Receipt className="h-3.5 w-3.5" />
            Create sale
          </Link>
        </div>

        {isLoading ? (
          <div className="p-4">
            <div className="overflow-hidden rounded-md border border-slate-200">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="grid gap-4 border-b border-slate-100 p-4 last:border-0 md:grid-cols-[1fr_1fr_1.2fr_0.7fr_0.8fr_0.8fr_0.8fr_0.7fr]"
                >
                  {Array.from({ length: 8 }).map((__, innerIndex) => (
                    <div
                      key={`${index}-${innerIndex}`}
                      className="h-4 animate-pulse rounded bg-slate-200"
                    />
                  ))}
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
                Failed to load sales
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Refresh the page or try a smaller filter set.
              </p>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="grid min-h-[280px] place-items-center px-6 py-12 text-center">
            <div className="max-w-md">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400">
                <Inbox className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-950">
                No sales found
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Completed POS sales and prepared order invoices will appear
                here.
              </p>
              <Link
                href={`${WH}/pos`}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-slate-50"
              >
                <Receipt className="h-4 w-4" />
                Create Sale
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Date & time</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-slate-100 transition last:border-0 hover:bg-[oklch(0.985_0.005_145)]"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-mono text-[13px] font-semibold tracking-tight text-slate-950">
                        {row.invoiceNumber}
                      </div>
                      <div className="mt-1 max-w-[240px] truncate text-xs text-slate-500">
                        {row.itemCount} item{row.itemCount === 1 ? "" : "s"}
                        {row.firstItemName ? ` / ${row.firstItemName}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600">
                      {formatDateTime(row.date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
                          <UserRound className="h-4 w-4 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {row.customerName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {row.customerPhone || "No phone"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold",
                          typeClassName(row.type),
                        )}
                      >
                        {row.typeLabel}
                      </span>
                      {row.salesmanName && (
                        <div className="mt-1 text-xs text-slate-500">
                          {row.salesmanName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-950">
                      {money(row.total)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-slate-700">
                      {money(row.paid)}
                      <div className="text-xs text-slate-500">
                        {row.paymentMethodLabel}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold">
                      <span
                        className={
                          row.due > 0 ? "text-amber-700" : "text-slate-500"
                        }
                      >
                        {money(row.due)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold",
                          statusClassName(row.status),
                        )}
                      >
                        {row.status === "completed" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5" />
                        )}
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedSale({ kind: row.kind, id: row.id })
                        }
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-[oklch(0.998_0.002_110)] px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        View
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-slate-500">
              Page {pagination.page} of {pagination.totalPages}.{" "}
              {pagination.totalCount} sales total.
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

      <Sheet
        open={!!selectedSale}
        onOpenChange={(open) => {
          if (!open) setSelectedSale(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl lg:max-w-2xl">
          <SheetHeader className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
            <SheetTitle>Sales detail</SheetTitle>
            <SheetDescription>
              {detailQuery.data?.basic.invoiceNumber ?? "Loading invoice"}
            </SheetDescription>
          </SheetHeader>

          {detailQuery.isLoading ? (
            <div className="flex min-h-[360px] items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading sale details...
            </div>
          ) : detailQuery.isError || !detailQuery.data ? (
            <div className="grid min-h-[360px] place-items-center px-6 text-center">
              <div>
                <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
                <h3 className="mt-3 text-sm font-semibold text-slate-950">
                  Detail unavailable
                </h3>
              </div>
            </div>
          ) : (
            <SalesDetailPanel detail={detailQuery.data as any} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-[oklch(0.998_0.002_110)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
          {label}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 truncate text-xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function SalesDetailPanel({ detail }: { detail: any }) {
  const status = detail.statusKey as SaleRow["status"];

  return (
    <div className="space-y-4 p-5">
      <section className="rounded-lg border border-slate-200 bg-[oklch(0.998_0.002_110)] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
            Basic info
          </h3>
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold",
              statusClassName(status),
            )}
          >
            {detail.status}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailLine label="Invoice ID" value={detail.basic.invoiceNumber} />
          <DetailLine label="Date" value={formatDateTime(detail.basic.date)} />
          <DetailLine label="Customer" value={detail.basic.customerName} />
          <DetailLine label="Phone" value={detail.basic.phone || "No phone"} />
          <DetailLine label="Sales Type" value={detail.basic.salesType} />
          <DetailLine
            label="Salesman"
            value={detail.basic.salesman || "Not assigned"}
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-[oklch(0.998_0.002_110)]">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
            Items
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item: any, index: number) => (
                <tr
                  key={`${item.product}-${index}`}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {item.product}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.variant}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {money(item.price)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-950">
                    {money(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-[oklch(0.998_0.002_110)] p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
            Payment summary
          </h3>
          <div className="space-y-2 text-sm">
            <SummaryLine
              label="Subtotal"
              value={money(detail.payment.subtotal)}
            />
            <SummaryLine
              label="Discount"
              value={money(detail.payment.discount)}
            />
            <SummaryLine
              label="Total"
              value={money(detail.payment.total)}
              strong
            />
            <SummaryLine label="Paid" value={money(detail.payment.paid)} />
            <SummaryLine
              label="Due"
              value={money(detail.payment.due)}
              strong
              danger={Number(detail.payment.due) > 0}
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-[oklch(0.998_0.002_110)] p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
            Source info
          </h3>
          <div className="space-y-2 text-sm">
            <SummaryLine label="Source" value={detail.source.source} />
            <SummaryLine
              label="Source ID"
              value={detail.source.sourceId || "N/A"}
            />
            <SummaryLine
              label="Order ID"
              value={detail.source.orderId || "N/A"}
            />
            <SummaryLine
              label="Estimate Ref"
              value={detail.source.estimateRef || "N/A"}
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-[oklch(0.998_0.002_110)]">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
            Payment history
          </h3>
        </div>
        {detail.paymentHistory.length === 0 ? (
          <div className="px-4 py-5 text-sm text-slate-500">
            No payment has been recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {detail.paymentHistory.map((payment: any, index: number) => (
                  <tr
                    key={`${payment.date}-${index}`}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateTime(payment.date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {payment.method}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-950">
                      {money(payment.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-2 sm:grid-cols-2">
        <ActionShell icon={Printer} label="Print Invoice" />
        <ActionShell icon={Banknote} label="Collect Due" />
        <ActionShell icon={FileText} label="Edit Sale" />
        <ActionShell icon={RotateCcw} label="Process Return" />
      </section>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  strong,
  danger,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span
        className={cn(
          strong ? "font-semibold text-slate-950" : "text-slate-700",
          danger && "text-amber-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ActionShell({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-400"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
