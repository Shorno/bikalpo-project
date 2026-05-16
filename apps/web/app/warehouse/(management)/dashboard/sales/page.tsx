"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
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
  Receipt,
  RotateCcw,
  Search,
  Share2,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-lg lg:max-w-2xl!">
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
            <SalesDetailPanel detail={detailQuery.data} selectedSale={selectedSale} warehouseLabel={data?.warehouse?.label ?? "Warehouse"} />
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


function SalesDetailPanel({
  detail,
  selectedSale,
  warehouseLabel,
}: {
  detail: any;
  selectedSale: { kind: "pos" | "invoice"; id: number } | null;
  warehouseLabel: string;
}) {
  const status = detail.statusKey ?? detail.status ?? "pending";
  const due = Number(detail.payment?.due ?? 0);
  const invoiceNum =
    detail.basic?.invoiceNumber ?? detail.basic?.orderNumber ?? "-";
  const [collectDueOpen, setCollectDueOpen] = useState(false);
  const [printInvoiceOpen, setPrintInvoiceOpen] = useState(false);
  const [printReceiptOpen, setPrintReceiptOpen] = useState(false);
  const [lastCollectedPayment, setLastCollectedPayment] = useState<{
    amount: number;
    paymentMethod: string;
    transactionRef?: string;
  } | null>(null);
  const queryClient = useQueryClient();

  const collectDueMutation = useMutation({
    mutationFn: (data: {
      amount: number;
      paymentMethod: "cash" | "bkash" | "nagad" | "bank";
      transactionRef?: string;
      note?: string;
    }) =>
      orpc.warehouseSales.collectDue.call({
        kind: selectedSale!.kind,
        id: selectedSale!.id,
        ...data,
      }),
    onSuccess: (_result, variables) => {
      toast.success("Payment collected successfully");
      setCollectDueOpen(false);
      setLastCollectedPayment({
        amount: variables.amount,
        paymentMethod: variables.paymentMethod,
        transactionRef: variables.transactionRef,
      });
      setPrintReceiptOpen(true);
      queryClient.invalidateQueries({
        queryKey: ["warehouseSales"],
      });
    },
    onError: (error: any) => {
      toast.error(error?.message ?? "Failed to collect payment");
    },
  });

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

      <footer className="flex shrink-0 items-center gap-2.5 border-t bg-white px-6 py-4 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <DrawerAction
          icon={Printer}
          label="Print Invoice"
          onClick={() => setPrintInvoiceOpen(true)}
          colorClass="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
        />
        <DrawerAction
          icon={Banknote}
          label="Collect Due"
          onClick={due > 0 ? () => setCollectDueOpen(true) : undefined}
          disabled={due <= 0}
          colorClass="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
        />
        <DrawerAction
          icon={FileText}
          label="Edit Sale"
          colorClass="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
        />
        <DrawerAction
          icon={RotateCcw}
          label="Process Return"
          colorClass="bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
        />
      </footer>

      <CollectDueDialog
        open={collectDueOpen}
        onOpenChange={setCollectDueOpen}
        dueAmount={due}
        invoiceNumber={invoiceNum}
        onCollect={(data) => collectDueMutation.mutate(data)}
        isPending={collectDueMutation.isPending}
      />

      <PrintInvoiceDialog
        open={printInvoiceOpen}
        onOpenChange={setPrintInvoiceOpen}
        detail={detail}
        warehouseLabel={warehouseLabel}
      />

      <PrintReceiptDialog
        open={printReceiptOpen}
        onOpenChange={setPrintReceiptOpen}
        invoiceNumber={invoiceNum}
        customerName={detail.basic?.customerName ?? "-"}
        warehouseLabel={warehouseLabel}
        payment={lastCollectedPayment}
        totalAmount={Number(detail.payment?.total ?? 0)}
        totalPaid={Number(detail.payment?.paid ?? 0)}
        totalDue={due}
      />
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
  onClick,
  disabled,
  colorClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  colorClass?: string;
}) {
  const isDisabled = disabled ?? !onClick;
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition-all",
        "shadow-sm active:scale-[0.97]",
        isDisabled
          ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 opacity-60 shadow-none"
          : colorClass ?? "bg-background text-foreground border-border hover:bg-muted",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

const paymentMethodOptions: {
  value: "cash" | "bkash" | "nagad" | "bank";
  label: string;
}[] = [
    { value: "cash", label: "Cash" },
    { value: "bkash", label: "bKash" },
    { value: "nagad", label: "Nagad" },
    { value: "bank", label: "Bank Transfer" },
  ];

function CollectDueDialog({
  open,
  onOpenChange,
  dueAmount,
  invoiceNumber,
  onCollect,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dueAmount: number;
  invoiceNumber: string;
  onCollect: (data: {
    amount: number;
    paymentMethod: "cash" | "bkash" | "nagad" | "bank";
    transactionRef?: string;
    note?: string;
  }) => void;
  isPending: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "bkash" | "nagad" | "bank"
  >("cash");
  const [transactionRef, setTransactionRef] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setPaymentMethod("cash");
      setTransactionRef("");
      setNote("");
    }
  }, [open]);

  const parsedAmount = Number(amount);
  const isValidAmount =
    amount !== "" &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= dueAmount;
  const showRefField = paymentMethod !== "cash";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount) return;
    onCollect({
      amount: parsedAmount,
      paymentMethod,
      transactionRef: transactionRef.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-600" />
            Collect Due Payment
          </DialogTitle>
          <DialogDescription>
            Collect outstanding balance for{" "}
            <span className="font-semibold text-foreground">
              {invoiceNumber}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Outstanding Due</span>
              <span className="font-mono text-lg font-bold text-red-600">
                {money(dueAmount)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="collect-method">Payment Method</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {paymentMethodOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={cn(
                    "rounded-md border px-2 py-2 text-xs font-medium transition-all",
                    paymentMethod === opt.value
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="collect-amount">Amount</Label>
              <button
                type="button"
                onClick={() => setAmount(String(dueAmount))}
                className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                Collect Full Amount
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ৳
              </span>
              <Input
                id="collect-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={dueAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-7 font-mono tabular-nums"
                autoFocus
              />
            </div>
            {amount !== "" && !isValidAmount && (
              <p className="text-xs text-red-500">
                {parsedAmount > dueAmount
                  ? `Cannot exceed due amount of ${money(dueAmount)}`
                  : "Enter a valid amount"}
              </p>
            )}
          </div>

          {showRefField && (
            <div className="space-y-2">
              <Label htmlFor="collect-ref">
                Transaction Reference
                <span className="ml-1 text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="collect-ref"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                placeholder={
                  paymentMethod === "bkash" || paymentMethod === "nagad"
                    ? "Transaction ID"
                    : "Reference number"
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="collect-note">
              Note
              <span className="ml-1 text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="collect-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note..."
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValidAmount || isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Collecting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Collect {amount ? money(parsedAmount) : "Payment"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function printContent(html: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  iframe.style.width = "0";
  iframe.style.height = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 250);
  };
}

function formatPrintDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPrintTime(value: string | Date | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildPrintStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 12px; color: #1a1a1a; padding: 16px; max-width: 380px; margin: 0 auto; }
    .header { text-align: center; padding-bottom: 12px; border-bottom: 2px solid #333; margin-bottom: 12px; }
    .header h1 { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
    .header p { font-size: 11px; color: #666; }
    .doc-type { text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 8px 0; padding: 4px 0; border-top: 1px dashed #ccc; border-bottom: 1px dashed #ccc; }
    .info-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
    .info-row .label { color: #666; }
    .info-row .value { font-weight: 600; }
    .divider { border: none; border-top: 1px dashed #ccc; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; padding: 4px 0; border-bottom: 1px solid #ccc; font-weight: 600; font-size: 10px; color: #666; text-transform: uppercase; }
    th.right, td.right { text-align: right; }
    td { padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
    .summary-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
    .summary-row.total { font-weight: 700; font-size: 14px; border-top: 1px solid #333; padding-top: 6px; margin-top: 4px; }
    .summary-row.due { color: #dc2626; font-weight: 700; }
    .summary-row.paid { color: #16a34a; }
    .payment-history { margin-top: 6px; }
    .payment-history h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 4px; }
    .payment-entry { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; border-bottom: 1px solid #f5f5f5; }
    .payment-entry .date { color: #666; min-width: 80px; }
    .payment-entry .method { flex: 1; text-align: center; }
    .payment-entry .amount { font-weight: 600; text-align: right; min-width: 70px; }
    .footer { text-align: center; margin-top: 16px; padding-top: 10px; border-top: 1px dashed #ccc; font-size: 10px; color: #999; }
    .highlight-box { border: 2px solid #333; border-radius: 4px; padding: 8px; margin: 8px 0; text-align: center; }
    .highlight-box .big { font-size: 18px; font-weight: 700; }
    .highlight-box .sub { font-size: 11px; color: #666; margin-top: 2px; }
    @media print { body { padding: 0; } }
  `;
}

function PrintInvoiceDialog({
  open,
  onOpenChange,
  detail,
  warehouseLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: any;
  warehouseLabel: string;
}) {
  const [isSharing, setIsSharing] = useState(false);

  const invoiceNum =
    detail.basic?.invoiceNumber ?? detail.basic?.orderNumber ?? "-";

  const buildInvoiceHtml = () => {
    const itemRows = (detail.items ?? [])
      .map(
        (item: any) => `
      <tr>
        <td>${item.product}${item.variant ? ` <span style="color:#666">(${item.variant})</span>` : ""}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${money(item.price)}</td>
        <td class="right">${money(item.total)}</td>
      </tr>`,
      )
      .join("");

    const paymentRows = (detail.paymentHistory ?? [])
      .map(
        (p: any) => `
      <div class="payment-entry">
        <span class="date">${formatPrintDate(p.date)}</span>
        <span class="method">${p.method}</span>
        <span class="amount">${money(p.amount)}</span>
      </div>`,
      )
      .join("");

    const dueVal = Number(detail.payment?.due ?? 0);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${invoiceNum}</title><style>${buildPrintStyles()}</style></head><body>
      <div class="header">
        <h1>${warehouseLabel}</h1>
      </div>
      <div class="doc-type">Sales Invoice</div>
      <div class="info-row"><span class="label">Invoice No</span><span class="value">${invoiceNum}</span></div>
      <div class="info-row"><span class="label">Date</span><span class="value">${formatPrintDate(detail.basic?.date)} ${formatPrintTime(detail.basic?.date)}</span></div>
      <div class="info-row"><span class="label">Customer</span><span class="value">${detail.basic?.customerName ?? "-"}</span></div>
      ${detail.basic?.phone ? `<div class="info-row"><span class="label">Phone</span><span class="value">${detail.basic.phone}</span></div>` : ""}
      ${detail.basic?.salesType ? `<div class="info-row"><span class="label">Type</span><span class="value">${detail.basic.salesType}</span></div>` : ""}
      <hr class="divider">
      <table>
        <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <hr class="divider">
      <div class="summary-row"><span>Subtotal</span><span>${money(detail.payment?.subtotal)}</span></div>
      ${Number(detail.payment?.discount ?? 0) > 0 ? `<div class="summary-row"><span>Discount</span><span>-${money(detail.payment?.discount)}</span></div>` : ""}
      <div class="summary-row total"><span>Total</span><span>${money(detail.payment?.total)}</span></div>
      <div class="summary-row paid"><span>Paid</span><span>${money(detail.payment?.paid)}</span></div>
      ${dueVal > 0 ? `<div class="summary-row due"><span>Balance Due</span><span>${money(detail.payment?.due)}</span></div>` : ""}
      ${paymentRows ? `<hr class="divider"><div class="payment-history"><h3>Payment History</h3>${paymentRows}</div>` : ""}
      <div class="footer">
        <p>Thank you for your purchase!</p>
        <p style="margin-top:4px">${formatPrintDate(new Date())} ${formatPrintTime(new Date())}</p>
      </div>
    </body></html>`;
  };

  const handlePrint = () => {
    printContent(buildInvoiceHtml());
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.top = "-10000px";
      iframe.style.left = "-10000px";
      iframe.style.width = "380px";
      iframe.style.height = "auto";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Could not access iframe document");

      iframeDoc.open();
      iframeDoc.write(buildInvoiceHtml());
      iframeDoc.close();

      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        setTimeout(resolve, 500);
      });

      const canvas = await html2canvas(iframeDoc.body, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        width: 380,
      });
      document.body.removeChild(iframe);

      const dataUrl = canvas.toDataURL("image/png");
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      const fileName = `Invoice-${invoiceNum}-${new Date().toISOString().slice(0, 10)}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Sales Invoice - ${invoiceNum}`,
          text: `Invoice ${invoiceNum} for ${detail.basic?.customerName ?? "customer"}. Total: ${money(detail.payment?.total)}.`,
          files: [file],
        });
        toast.success("Invoice shared successfully");
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        link.click();
        toast.success("Invoice image downloaded");
      }
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      console.error("Share failed:", error);
      toast.error("Failed to share invoice");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Sales Invoice
          </DialogTitle>
          <DialogDescription>
            Print or share the full invoice for{" "}
            <span className="font-semibold text-foreground">{invoiceNum}</span>{" "}
            including line items, payment summary, and payment history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">
                {detail.basic?.customerName ?? "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">
                {money(detail.payment?.total)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Paid</span>
              <span className="font-medium text-emerald-600">
                {money(detail.payment?.paid)}
              </span>
            </div>
            {Number(detail.payment?.due ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due</span>
                <span className="font-semibold text-red-600">
                  {money(detail.payment?.due)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items</span>
              <span>{detail.items?.length ?? 0} item(s)</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleShare}
              disabled={isSharing}
              className="gap-2"
            >
              {isSharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {isSharing ? "Sharing..." : "Share"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                handlePrint();
                onOpenChange(false);
              }}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrintReceiptDialog({
  open,
  onOpenChange,
  invoiceNumber,
  customerName,
  warehouseLabel,
  payment,
  totalAmount,
  totalPaid,
  totalDue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber: string;
  customerName: string;
  warehouseLabel: string;
  payment: {
    amount: number;
    paymentMethod: string;
    transactionRef?: string;
  } | null;
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
}) {
  const [isSharing, setIsSharing] = useState(false);

  if (!payment) return null;

  const methodLabel =
    payment.paymentMethod === "bkash"
      ? "bKash"
      : payment.paymentMethod === "nagad"
        ? "Nagad"
        : payment.paymentMethod === "bank"
          ? "Bank Transfer"
          : "Cash";

  const buildReceiptHtml = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payment Receipt</title><style>${buildPrintStyles()}</style></head><body>
      <div class="header">
        <h1>${warehouseLabel}</h1>
      </div>
      <div class="doc-type">Payment Receipt</div>
      <div class="info-row"><span class="label">Receipt Date</span><span class="value">${formatPrintDate(new Date())} ${formatPrintTime(new Date())}</span></div>
      <div class="info-row"><span class="label">Invoice Ref</span><span class="value">${invoiceNumber}</span></div>
      <div class="info-row"><span class="label">Customer</span><span class="value">${customerName}</span></div>
      <hr class="divider">
      <div class="highlight-box">
        <div class="sub">Amount Collected</div>
        <div class="big">${money(payment.amount)}</div>
        <div class="sub">${methodLabel}${payment.transactionRef ? ` • Ref: ${payment.transactionRef}` : ""}</div>
      </div>
      <hr class="divider">
      <div class="summary-row"><span>Invoice Total</span><span>${money(totalAmount)}</span></div>
      <div class="summary-row paid"><span>Total Paid</span><span>${money(totalPaid + payment.amount)}</span></div>
      <div class="summary-row due"><span>Remaining Due</span><span>${money(Math.max(0, totalDue - payment.amount))}</span></div>
      <div class="footer">
        <p>This is a computer-generated receipt.</p>
        <p style="margin-top:4px">${formatPrintDate(new Date())} ${formatPrintTime(new Date())}</p>
      </div>
    </body></html>`;

  const handlePrint = () => {
    printContent(buildReceiptHtml());
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");

      // Use an iframe for proper HTML rendering (same approach as print)
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.top = "-10000px";
      iframe.style.left = "-10000px";
      iframe.style.width = "380px";
      iframe.style.height = "auto";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Could not access iframe document");

      iframeDoc.open();
      iframeDoc.write(buildReceiptHtml());
      iframeDoc.close();

      // Wait for iframe content to render
      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        // Fallback timeout in case onload doesn't fire
        setTimeout(resolve, 500);
      });

      // Capture the iframe body as canvas
      const canvas = await html2canvas(iframeDoc.body, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        width: 380,
      });
      document.body.removeChild(iframe);

      // Convert canvas to blob via dataURL (more reliable than toBlob)
      const dataUrl = canvas.toDataURL("image/png");
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      const fileName = `Receipt-${invoiceNumber}-${new Date().toISOString().slice(0, 10)}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      // Try native Web Share API first (works on mobile + modern desktop)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Payment Receipt - ${invoiceNumber}`,
          text: `Payment receipt for ${invoiceNumber}. Amount collected: ${money(payment.amount)} via ${methodLabel}.`,
          files: [file],
        });
        toast.success("Receipt shared successfully");
      } else {
        // Fallback: download the image
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        link.click();
        toast.success("Receipt image downloaded");
      }
    } catch (error: any) {
      // User cancelled the share dialog — not an error
      if (error?.name === "AbortError") return;
      console.error("Share failed:", error);
      toast.error("Failed to share receipt");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            Payment Collected
          </DialogTitle>
          <DialogDescription>
            Due payment has been recorded. Would you like to print or share the receipt?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/50 p-4 text-center">
            <p className="text-xs text-emerald-600 font-medium">
              Amount Collected
            </p>
            <p className="text-2xl font-bold text-emerald-700 mt-1 font-mono tabular-nums">
              {money(payment.amount)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {methodLabel}
              {payment.transactionRef
                ? ` • Ref: ${payment.transactionRef}`
                : ""}
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice</span>
              <span className="font-mono text-xs font-semibold">
                {invoiceNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Total</span>
              <span className="tabular-nums">{money(totalAmount)}</span>
            </div>
            <div className="flex justify-between text-emerald-600">
              <span>Total Paid</span>
              <span className="font-medium tabular-nums">
                {money(totalPaid + payment.amount)}
              </span>
            </div>
            {totalDue - payment.amount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Remaining Due</span>
                <span className="font-semibold tabular-nums">
                  {money(totalDue - payment.amount)}
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleShare}
              disabled={isSharing}
              className="gap-2"
            >
              {isSharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {isSharing ? "Sharing..." : "Share"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                handlePrint();
                onOpenChange(false);
              }}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function statusPillClass(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700";
  if (status === "cancelled" || status === "rejected")
    return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}
