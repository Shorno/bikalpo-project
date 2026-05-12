"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Banknote,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileText,
  Filter,
  Inbox,
  Loader2,
  Printer,
  RotateCcw,
  Search,
  ShoppingCart,
  UserRound,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import type { SaleRow } from "./_components/sales-columns";

type SaleType = "all" | "pos" | "order" | "salesman";
type SaleStatus = "all" | "completed" | "due" | "cancelled";
type PaymentFilter = "all" | "cash" | "bkash" | "bank" | "due";
type DateFilter = "today" | "this_week" | "this_month" | "custom" | "all";

const WH = "/warehouse/dashboard";

const saleTypeCards: {
  key: Exclude<SaleType, "all">;
  label: string;
  color: string;
  activeColor: string;
  dotColor: string;
  description: string;
}[] = [
  {
    key: "pos",
    label: "POS",
    color: "text-emerald-600",
    activeColor: "border-emerald-200 bg-emerald-50 ring-emerald-100",
    dotColor: "bg-emerald-500",
    description: "Counter sales",
  },
  {
    key: "order",
    label: "Order",
    color: "text-red-600",
    activeColor: "border-red-200 bg-red-50 ring-red-100",
    dotColor: "bg-red-500",
    description: "Order invoices",
  },
  {
    key: "salesman",
    label: "Salesman",
    color: "text-blue-600",
    activeColor: "border-blue-200 bg-blue-50 ring-blue-100",
    dotColor: "bg-blue-500",
    description: "Field sales flow",
  },
];

const salesDescriptions: Record<SaleType, { title: string; subtitle: string }> =
  {
    all: {
      title: "All Transactions",
      subtitle: "POS sales, generated order invoices, and salesman sales",
    },
    pos: {
      title: "POS Sales",
      subtitle: "Counter sales created from the warehouse POS",
    },
    order: {
      title: "Order Invoices",
      subtitle: "Invoices generated from customer orders",
    },
    salesman: {
      title: "Salesman Transactions",
      subtitle: "Orders created or converted through field sales",
    },
  };

const dateOptions: { value: DateFilter; label: string }[] = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "custom", label: "Custom" },
];

const statusOptions: { value: SaleStatus; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "completed", label: "Completed" },
  { value: "due", label: "Due" },
  { value: "cancelled", label: "Cancelled" },
];

const paymentOptions: { value: PaymentFilter; label: string }[] = [
  { value: "all", label: "All Payment" },
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "bKash" },
  { value: "bank", label: "Bank" },
  { value: "due", label: "Due" },
];

export default function WarehouseSalesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateFilter>("all");
  const [saleType, setSaleType] = useState<SaleType>("all");
  const [status, setStatus] = useState<SaleStatus>("all");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [salesmanId, setSalesmanId] = useState("all");
  const [appliedFilters, setAppliedFilters] = useState({
    dateRange: "all" as DateFilter,
    saleType: "all" as SaleType,
    status: "all" as SaleStatus,
    payment: "all" as PaymentFilter,
    salesmanId: "all",
  });
  const [selectedSale, setSelectedSale] = useState<{
    kind: "pos" | "invoice";
    id: number;
  } | null>(null);

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

  const queryInput = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      dateRange: appliedFilters.dateRange,
      type: appliedFilters.saleType,
      status: appliedFilters.status,
      payment: appliedFilters.payment,
      salesmanId:
        appliedFilters.salesmanId === "all"
          ? undefined
          : appliedFilters.salesmanId,
      page,
      limit: 20,
    }),
    [appliedFilters, debouncedSearch, page],
  );

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
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
  const salesmen = data?.filterOptions?.salesmen ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const totalCount = pagination?.totalCount ?? 0;
  const showFrom = totalCount > 0 ? (page - 1) * 20 + 1 : 0;
  const showTo = Math.min(page * 20, totalCount);
  const counts = data?.summary?.counts ?? {
    pos: 0,
    order: 0,
    salesman: 0,
    pre_order: 0,
  };
  const showingLabel =
    dateOptions.find((option) => option.value === appliedFilters.dateRange)
      ?.label ?? "Today";
  const currentDescription = salesDescriptions[appliedFilters.saleType];

  const applyFilters = useCallback(() => {
    setPage(1);
    setAppliedFilters({ dateRange, saleType, status, payment, salesmanId });
  }, [dateRange, payment, saleType, salesmanId, status]);

  const selectSaleType = useCallback(
    (type: SaleType) => {
      setSaleType(type);
      setPage(1);
      setAppliedFilters({
        dateRange,
        saleType: type,
        status,
        payment,
        salesmanId,
      });
    },
    [dateRange, payment, salesmanId, status],
  );

  const exportReport = useCallback(() => {
    const exportRows = ((data?.exportRows ?? rows) as SaleRow[]).map((row) => ({
      Invoice: row.invoiceNumber,
      "Date & Time": formatDateTime(row.date),
      Customer: row.customerName,
      Phone: row.customerPhone ?? "",
      Type: row.typeLabel,
      Total: row.total,
      Paid: row.paid,
      Due: row.due,
      Status: row.statusLabel,
    }));

    if (exportRows.length === 0) return;

    const headers = Object.keys(exportRows[0]);
    const csv = [
      headers.join(","),
      ...exportRows.map((row) =>
        headers
          .map(
            (header) =>
              `"${String(row[header as keyof typeof row]).replace(/"/g, '""')}"`,
          )
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `warehouse-sales-${appliedFilters.dateRange}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [appliedFilters.dateRange, data?.exportRows, rows]);

  const handleTableClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-kind][data-id]",
      );
      if (!btn) return;
      setSelectedSale({
        kind: btn.dataset.kind as "pos" | "invoice",
        id: Number(btn.dataset.id),
      });
    },
    [],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Sales History
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data?.warehouse?.label ?? "Rahim Distribution Hub"} · Showing{" "}
            {showingLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${WH}/pos`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ShoppingCart className="h-4 w-4" />
            POS Sale
          </Link>
          <Button
            variant="outline"
            onClick={exportReport}
            disabled={rows.length === 0}
            className="h-9 gap-2"
          >
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SalesTypeCard
          active={appliedFilters.saleType === "all"}
          count={counts.pos + counts.order + counts.salesman}
          dotColor="bg-slate-500"
          label="All"
          description="All sales history"
          onClick={() => selectSaleType("all")}
        />
        {saleTypeCards.map((cfg) => (
          <SalesTypeCard
            key={cfg.key}
            active={appliedFilters.saleType === cfg.key}
            activeColor={cfg.activeColor}
            count={counts[cfg.key]}
            countColor={cfg.color}
            description={cfg.description}
            dotColor={cfg.dotColor}
            label={cfg.label}
            onClick={() => selectSaleType(cfg.key)}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Invoice ID / Customer / Phone..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <CompactSelect
            value={dateRange}
            onChange={(value) => setDateRange(value as DateFilter)}
            options={dateOptions}
          />
          <CompactSelect
            value={status}
            onChange={(value) => setStatus(value as SaleStatus)}
            options={statusOptions}
          />
          <CompactSelect
            value={payment}
            onChange={(value) => setPayment(value as PaymentFilter)}
            options={paymentOptions}
          />
          <Select value={salesmanId} onValueChange={setSalesmanId}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Salesman</SelectItem>
              {salesmen.map((salesman: { id: string; name: string | null }) => (
                <SelectItem key={salesman.id} value={salesman.id}>
                  {salesman.name ?? "Unnamed salesman"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={applyFilters} className="h-9 gap-2">
            <Filter className="h-4 w-4" />
            Apply Filters
          </Button>
          {isFetching && (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto border-b px-4 py-2">
          <SaleTypeTab
            active={appliedFilters.saleType === "all"}
            count={counts.pos + counts.order + counts.salesman}
            label="All"
            onClick={() => selectSaleType("all")}
          />
          {saleTypeCards.map((tab) => (
            <SaleTypeTab
              key={tab.key}
              active={appliedFilters.saleType === tab.key}
              count={counts[tab.key]}
              dotColor={tab.dotColor}
              label={tab.label}
              onClick={() => selectSaleType(tab.key)}
            />
          ))}
        </div>

        <div className="border-b bg-muted/20 px-4 py-2.5">
          <span className="text-sm font-semibold">
            {currentDescription.title}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            {currentDescription.subtitle}
          </span>
        </div>

        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sales Table (Main Data View)
          </h2>
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <EmptyState
            icon={AlertCircle}
            title="Failed to load sales"
            description="Try refreshing or adjusting your filters."
            action={<Button onClick={() => refetch()}>Retry</Button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No sales found"
            description="POS sales, order invoices, and salesman transactions will appear here."
          />
        ) : (
          <SalesTable rows={rows} onClick={handleTableClick} />
        )}

        {!isLoading && !isError && totalCount > 0 && (
          <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {showFrom}-{showTo} of {totalCount} sales
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
                    ...
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

      <Sheet
        open={!!selectedSale}
        onOpenChange={(open) => {
          if (!open) setSelectedSale(null);
        }}
      >
        <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-md lg:max-w-lg">
          <SheetHeader className="sr-only">
            <SheetTitle>Sales Detail</SheetTitle>
            <SheetDescription>
              {(detailQuery.data as any)?.basic?.invoiceNumber ?? "Loading..."}
            </SheetDescription>
          </SheetHeader>

          {detailQuery.isLoading ? (
            <div className="flex min-h-[360px] flex-1 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading sale details...
            </div>
          ) : detailQuery.isError || !detailQuery.data ? (
            <div className="grid min-h-[360px] flex-1 place-items-center px-6 text-center">
              <div>
                <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
                <h3 className="mt-3 text-sm font-semibold">
                  Detail unavailable
                </h3>
              </div>
            </div>
          ) : (
            <SalesDetailPanel detail={detailQuery.data} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SalesTypeCard({
  active,
  activeColor,
  count,
  countColor,
  description,
  dotColor,
  label,
  onClick,
}: {
  active: boolean;
  activeColor?: string;
  count: number;
  countColor?: string;
  description: string;
  dotColor: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border p-4 text-left transition-all",
        active
          ? cn(
              activeColor ?? "border-slate-200 bg-slate-50 ring-slate-100",
              "ring-2 shadow-sm",
            )
          : "bg-background hover:bg-muted/50 hover:shadow-sm",
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("h-2.5 w-2.5 rounded-full", dotColor)} />
        <ShoppingCart className="h-4 w-4 text-muted-foreground/60" />
      </div>
      <div className="mt-3">
        <div
          className={cn(
            "text-3xl font-bold tabular-nums tracking-tight",
            active ? (countColor ?? "text-foreground") : "text-foreground",
          )}
        >
          {count}
        </div>
        <div className="mt-1 text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}

function CompactSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[130px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SaleTypeTab({
  active,
  count,
  dotColor,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  dotColor?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {dotColor && <span className={cn("h-2 w-2 rounded-full", dotColor)} />}
      {label}
      <Badge
        variant={active ? "secondary" : "outline"}
        className="h-5 min-w-5 justify-center px-1.5 text-[10px]"
      >
        {count}
      </Badge>
    </button>
  );
}

function TableSkeleton() {
  return (
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
  );
}

function SalesTable({
  rows,
  onClick,
}: {
  rows: SaleRow[];
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div className="overflow-x-auto" onClick={onClick}>
      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">
              Invoice
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">
              Date & Time
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">
              Customer
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">
              Type
            </TableHead>
            <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-wider">
              Total
            </TableHead>
            <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-wider">
              Paid
            </TableHead>
            <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-wider">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="px-4 py-3">
                <span className="font-mono text-[13px] font-semibold tracking-tight text-foreground">
                  {row.invoiceNumber}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3 text-muted-foreground tabular-nums">
                {formatDateTime(row.date)}
              </TableCell>
              <TableCell className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {row.customerName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.customerPhone || "No phone"}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={cn("font-semibold", typeBadgeClass(row.type))}
                >
                  {row.typeLabel}
                </Badge>
                {row.salesmanName && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {row.salesmanName}
                  </div>
                )}
              </TableCell>
              <TableCell className="px-4 py-3 text-right text-sm font-semibold tabular-nums">
                <span className={row.due > 0 ? "text-amber-700" : undefined}>
                  {money(row.total)}
                  {row.due > 0 ? " \u26A0" : ""}
                </span>
              </TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">
                <span className="text-sm">{money(row.paid)}</span>
                <div className="text-xs text-muted-foreground">
                  {row.paymentMethodLabel}
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 text-right">
                <button
                  type="button"
                  data-kind={row.kind}
                  data-id={row.id}
                  className="inline-flex h-8 items-center rounded-md border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                >
                  View
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[320px] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-3 font-semibold">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
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

function money(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value || 0);
  return `\u09F3${(Number.isFinite(parsed) ? parsed : 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function formatDateTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  const now = new Date();
  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startYesterday = startToday - 24 * 60 * 60 * 1000;
  const saleDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (saleDay === startToday) return `Today ${timeLabel}`;
  if (saleDay === startYesterday) return "Yesterday";
  return date.toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function typeBadgeClass(type: string) {
  if (type === "pos")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (type === "salesman") return "border-sky-200 bg-sky-50 text-sky-700";
  if (type === "pre_order")
    return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}


function SalesDetailPanel({ detail }: { detail: any }) {
  const status = detail.statusKey ?? detail.status ?? "pending";
  const due = Number(detail.payment?.due ?? 0);
  const invoiceNum =
    detail.basic?.invoiceNumber ?? detail.basic?.orderNumber ?? "-";

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <header className="flex items-start justify-between border-b px-6 pb-5 pt-6">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            Sales Detail
          </p>
          <h2 className="mt-1 font-mono text-lg font-semibold tracking-tight">
            {invoiceNum}
          </h2>
        </div>
        <span
          className={cn(
            "mt-1 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            statusPillClass(status),
          )}
        >
          {detail.status ?? status}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <section className="grid grid-cols-2 gap-x-6 gap-y-4 border-b px-6 py-5">
          <DetailField
            label="Date"
            value={detail.basic?.date ? formatDateTime(detail.basic.date) : "-"}
          />
          <DetailField
            label="Customer"
            value={detail.basic?.customerName ?? "-"}
          />
          <DetailField
            label="Phone"
            value={detail.basic?.phone || "No phone"}
          />
          <DetailField
            label="Sales Type"
            value={detail.basic?.salesType ?? "-"}
          />
          <DetailField
            label="Salesman"
            value={detail.basic?.salesman || "Not assigned"}
          />
          <DetailField
            label="Source Ref"
            value={
              detail.source?.sourceId ??
              detail.source?.orderId ??
              "Not available"
            }
          />
        </section>

        <section className="border-b px-6 py-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[13px] font-semibold">Line Items</h3>
            <span className="text-xs text-muted-foreground">
              {detail.items?.length ?? 0} item
              {detail.items?.length === 1 ? "" : "s"}
            </span>
          </div>
          {detail.items?.length > 0 ? (
            <div className="-mx-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y text-left text-[11px] font-medium text-muted-foreground">
                    <th className="px-6 py-2 font-medium">Product</th>
                    <th className="py-2 pr-4 font-medium">Variant</th>
                    <th className="py-2 pr-4 text-right font-medium">Qty</th>
                    <th className="py-2 pr-4 text-right font-medium">Price</th>
                    <th className="py-2 pr-6 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item: any, index: number) => (
                    <tr
                      key={`${item.product}-${index}`}
                      className="border-b last:border-0"
                    >
                      <td className="px-6 py-2.5 font-medium">
                        {item.product}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {item.variant}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                        {money(item.price)}
                      </td>
                      <td className="py-2.5 pr-6 text-right tabular-nums font-medium">
                        {money(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No items found.</p>
          )}
        </section>

        <section className="border-b px-6 py-5">
          <h3 className="mb-3 text-[13px] font-semibold">Payment</h3>
          <div className="space-y-1.5 text-sm">
            <PaymentRow label="Subtotal" value={money(detail.payment?.subtotal)} />
            <PaymentRow label="Discount" value={money(detail.payment?.discount)} />
            <div className="!mt-2 border-t pt-2">
              <PaymentRow
                label="Total"
                value={money(detail.payment?.total)}
                bold
              />
            </div>
            <PaymentRow label="Paid" value={money(detail.payment?.paid)} />
            <PaymentRow
              label="Due"
              value={money(detail.payment?.due)}
              bold
              className={due > 0 ? "text-red-600" : undefined}
            />
          </div>
          {due > 0 && (
            <p className="mt-3 text-xs text-red-600/80">
              Outstanding balance requires collection.
            </p>
          )}
        </section>

        <section className="border-b px-6 py-5">
          <h3 className="mb-3 text-[13px] font-semibold">Source</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <DetailField
              label="Source"
              value={detail.source?.source ?? "-"}
            />
            <DetailField
              label="Source ID"
              value={detail.source?.sourceId || "N/A"}
            />
            <DetailField
              label="Order ID"
              value={detail.source?.orderId || "N/A"}
            />
            <DetailField
              label="Estimate Ref"
              value={detail.source?.estimateRef || "N/A"}
            />
          </div>
        </section>

        <section className="px-6 py-5">
          <h3 className="mb-3 text-[13px] font-semibold">Payment History</h3>
          {detail.paymentHistory?.length > 0 ? (
            <div className="-mx-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y text-left text-[11px] font-medium text-muted-foreground">
                    <th className="px-6 py-2 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Method</th>
                    <th className="py-2 pr-6 text-right font-medium">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detail.paymentHistory.map((p: any, i: number) => (
                    <tr
                      key={`${p.date}-${i}`}
                      className="border-b last:border-0"
                    >
                      <td className="px-6 py-2.5 text-muted-foreground">
                        {formatDateTime(p.date)}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">{p.method}</td>
                      <td className="py-2.5 pr-6 text-right tabular-nums font-medium">
                        {money(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No payment has been recorded yet.
            </p>
          )}
        </section>
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t bg-muted/30 px-6 py-3">
        <DrawerAction icon={Printer} label="Print Invoice" />
        <DrawerAction icon={Banknote} label="Collect Due" />
        <DrawerAction icon={FileText} label="Edit Sale" />
        <DrawerAction icon={RotateCcw} label="Process Return" />
      </footer>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm" title={value}>
        {value}
      </dd>
    </div>
  );
}

function PaymentRow({
  label,
  value,
  bold,
  className,
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", bold && "font-semibold")}>
        {value}
      </span>
    </div>
  );
}

function DrawerAction({
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
      className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function statusPillClass(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "cancelled" || status === "rejected")
    return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}
