"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Inbox,
  Loader2,
  Package,
  Phone,
  RefreshCcw,
  Search,
  Send,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ElementType, useEffect, useMemo, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type EstimateStatus =
  | "draft"
  | "pending"
  | "sent"
  | "approved"
  | "rejected"
  | "converted";
type StatusFilter = EstimateStatus | "all";
type DirectionFilter = "all" | "sent" | "received";
type EstimateDirection = "sent" | "received";
type DiscountFilter = "all" | "above_5" | "above_10";
type DateFilter = "all" | "today" | "this_week" | "this_month";
type SortBy = "latest" | "highest_value" | "highest_discount";
type Risk = "low" | "medium" | "high";
type QuickActionKind = "approve" | "reject" | "send" | "resend";
type KpiKey = "all" | "sent" | "received" | "pending";

type EstimateRow = {
  id: number;
  estimateNumber: string;
  createdAt: string | Date;
  status: EstimateStatus;
  subtotal: string | number;
  discount: string | number;
  discountPercent: string | number;
  total: string | number;
  convertedOrderId?: number | null;
  itemCount: number;
  risk: Risk;
  direction: EstimateDirection;
  canManage: boolean;
  customer?: {
    id: string;
    name: string | null;
    phoneNumber?: string | null;
    shopName?: string | null;
    warehouseName?: string | null;
  } | null;
  salesman?: {
    id: string;
    name: string | null;
    email?: string | null;
  } | null;
  warehouse?: {
    id: string;
    name: string | null;
    phoneNumber?: string | null;
    warehouseName?: string | null;
    email?: string | null;
  } | null;
  counterparty?: {
    id: string;
    name: string | null;
    phoneNumber?: string | null;
    email?: string | null;
    type: "retailer" | "warehouse";
  } | null;
};

type EstimateExportRow = {
  estimateNumber: string;
  date: string | Date;
  direction: EstimateDirection;
  counterparty: string;
  customer: string;
  salesman: string;
  total: number;
  discountPercent: number;
  status: EstimateStatus;
  risk: Risk;
};

type EstimateDetail = {
  estimate: EstimateRow & {
    validUntil?: string | Date | null;
    notes?: string | null;
    approvedAt?: string | Date | null;
    sentAt?: string | Date | null;
    rejectedAt?: string | Date | null;
    convertedAt?: string | Date | null;
    items: Array<{
      id: number;
      productName: string;
      productSize: string | null;
      quantity: number;
      unitPrice: string | number;
      totalPrice: string | number;
    }>;
  };
  insights: {
    customer: {
      totalOrders: number;
      averageValue: number;
      paymentType: string | null;
    };
    salesman: {
      totalEstimates: number;
      highDiscounts: number;
      approvalRate: number;
      behavior: string;
    };
  };
};

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending Approval" },
  { value: "sent", label: "Sent" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "converted", label: "Converted" },
];

const discountOptions: Array<{ value: DiscountFilter; label: string }> = [
  { value: "all", label: "All Discounts" },
  { value: "above_5", label: "5%+" },
  { value: "above_10", label: "10%+" },
];

const dateOptions: Array<{ value: DateFilter; label: string }> = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
];

const sortOptions: Array<{ value: SortBy; label: string }> = [
  { value: "latest", label: "Latest" },
  { value: "highest_value", label: "Highest Value" },
  { value: "highest_discount", label: "Highest Discount" },
];

const directionTabs: Array<{
  value: DirectionFilter;
  label: string;
  icon: ElementType;
}> = [
  { value: "all", label: "All", icon: Package },
  { value: "sent", label: "Sent", icon: ArrowUpRight },
  { value: "received", label: "Received", icon: ArrowDownLeft },
];

const kpiConfig: Array<{
  key: KpiKey;
  label: string;
  description: string;
  icon: ElementType;
  tone: DashboardKpiTone;
}> = [
  {
    key: "all",
    label: "All Estimates",
    description: "Sent and received",
    icon: FileText,
    tone: "slate",
  },
  {
    key: "sent",
    label: "Sent Estimates",
    description: "Created by this warehouse team",
    icon: ArrowUpRight,
    tone: "blue",
  },
  {
    key: "received",
    label: "Received Estimates",
    description: "Incoming from other sellers",
    icon: ArrowDownLeft,
    tone: "violet",
  },
  {
    key: "pending",
    label: "Approval Pending",
    description: "Needs warehouse review",
    icon: AlertTriangle,
    tone: "amber",
  },
];

const statusLabels: Record<EstimateStatus, string> = {
  draft: "Draft",
  pending: "Pending Approval",
  sent: "Sent to Customer",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
};

const statusTone: Record<EstimateStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-700",
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  sent: "border-blue-200 bg-blue-50 text-blue-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  converted: "border-violet-200 bg-violet-50 text-violet-700",
};

const riskTone: Record<Risk, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-red-200 bg-red-50 text-red-700",
};

function formatMoney(value: string | number | null | undefined) {
  return `Tk ${Number(value ?? 0).toLocaleString("en-BD", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function riskLabel(risk: Risk) {
  if (risk === "high") return "High";
  if (risk === "medium") return "Medium";
  return "Low";
}

function getCounterpartyPhone(estimate: EstimateRow) {
  return (
    estimate.counterparty?.phoneNumber ??
    (estimate.direction === "sent"
      ? estimate.customer?.phoneNumber
      : estimate.warehouse?.phoneNumber)
  );
}

function getCounterpartyName(estimate: EstimateRow) {
  if (estimate.counterparty?.name) return estimate.counterparty.name;
  if (estimate.direction === "sent") {
    return (
      estimate.customer?.shopName ??
      estimate.customer?.warehouseName ??
      estimate.customer?.name ??
      "Customer"
    );
  }
  return (
    estimate.warehouse?.warehouseName ??
    estimate.warehouse?.name ??
    "Seller Warehouse"
  );
}

function getPartyColumnLabel(direction: DirectionFilter) {
  if (direction === "sent") return "Customer";
  if (direction === "received") return "From Warehouse";
  return "Counterparty";
}

function getEstimateStatusLabel(estimate: EstimateRow) {
  if (estimate.direction === "received" && estimate.status === "sent") {
    return "Received";
  }
  return statusLabels[estimate.status];
}

function getExportStatusLabel(row: EstimateExportRow) {
  if (row.direction === "received" && row.status === "sent") {
    return "Received";
  }
  return statusLabels[row.status];
}

function matchesKpi(row: EstimateExportRow, key: KpiKey) {
  if (key === "sent") return row.direction === "sent";
  if (key === "received") return row.direction === "received";
  if (key === "pending") return row.status === "pending";
  return true;
}

function buildEstimateChartData(
  rows: EstimateExportRow[],
  key: KpiKey,
): DashboardKpiChartPoint[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (6 - index));

    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    return {
      label: day.toLocaleDateString("en-BD", { weekday: "short" }),
      value: rows.filter((row) => {
        const rowDate = new Date(row.date);
        return matchesKpi(row, key) && rowDate >= day && rowDate < nextDay;
      }).length,
    };
  });
}

function buildEstimateTrend(
  rows: EstimateExportRow[],
  key: KpiKey,
): DashboardKpiTrend {
  const now = new Date();
  const currentStart = new Date(now);
  currentStart.setHours(0, 0, 0, 0);
  currentStart.setDate(currentStart.getDate() - 6);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - 7);
  const previousEnd = new Date(currentStart);

  const current = rows.filter((row) => {
    const rowDate = new Date(row.date);
    return (
      matchesKpi(row, key) &&
      rowDate >= currentStart &&
      rowDate <= new Date(now.getTime() + 86_400_000)
    );
  }).length;
  const previous = rows.filter((row) => {
    const rowDate = new Date(row.date);
    return (
      matchesKpi(row, key) && rowDate >= previousStart && rowDate < previousEnd
    );
  }).length;

  if (current === 0 && previous === 0) {
    return { value: "0%", label: "vs Previous 7 Days", direction: "neutral" };
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

function generatePageNumbers(current: number, total: number) {
  const pages: Array<number | "..."> = [];
  for (let page = 1; page <= total; page++) {
    if (page === 1 || page === total || Math.abs(page - current) <= 1) {
      pages.push(page);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }
  return pages;
}

export default function WarehouseEstimateManagementPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [discountLevel, setDiscountLevel] = useState<DiscountFilter>("all");
  const [salesmanId, setSalesmanId] = useState("all");
  const [counterpartyId, setCounterpartyId] = useState("all");
  const [dateRange, setDateRange] = useState<DateFilter>("this_month");
  const [sortBy, setSortBy] = useState<SortBy>("latest");
  const [selectedEstimateId, setSelectedEstimateId] = useState<number | null>(
    null,
  );

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
      direction,
      status,
      discountLevel,
      salesmanId: salesmanId === "all" ? undefined : salesmanId,
      counterpartyId: counterpartyId === "all" ? undefined : counterpartyId,
      dateRange,
      sortBy,
      page,
      limit: 20,
    }),
    [
      counterpartyId,
      dateRange,
      debouncedSearch,
      direction,
      discountLevel,
      page,
      salesmanId,
      sortBy,
      status,
    ],
  );

  const estimatesQuery = useQuery({
    queryKey: ["warehouseEstimate", "list", queryInput],
    queryFn: () => orpc.warehouseEstimate.listEstimates.call(queryInput),
  });

  const detailQuery = useQuery({
    queryKey: ["warehouseEstimate", "detail", selectedEstimateId],
    queryFn: () =>
      orpc.warehouseEstimate.getEstimateDetail.call({
        id: selectedEstimateId!,
      }),
    enabled: !!selectedEstimateId,
  });

  const quickActionMutation = useMutation({
    mutationFn: (input: { kind: QuickActionKind; estimate: EstimateRow }) => {
      if (input.kind === "approve") {
        return orpc.warehouseEstimate.reviewEstimate.call({
          id: input.estimate.id,
          action: "approve",
        });
      }
      if (input.kind === "reject") {
        return orpc.warehouseEstimate.reviewEstimate.call({
          id: input.estimate.id,
          action: "reject",
        });
      }
      return orpc.warehouseEstimate.sendEstimate.call({
        id: input.estimate.id,
      });
    },
    onSuccess: (_, variables) => {
      const messages: Record<QuickActionKind, string> = {
        approve: "Estimate approved",
        reject: "Estimate rejected",
        send: "Estimate sent to customer",
        resend: "Estimate resent to customer",
      };
      toast.success(messages[variables.kind]);
      queryClient.invalidateQueries({ queryKey: ["warehouseEstimate"] });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update estimate");
    },
  });

  const data = estimatesQuery.data;
  const estimates = (data?.estimates ?? []) as EstimateRow[];
  const summary = data?.summary ?? {
    total: 0,
    pending: 0,
    approved: 0,
    sent: 0,
    converted: 0,
    highRisk: 0,
    totalValue: 0,
    sentEstimates: 0,
    receivedEstimates: 0,
  };
  const exportData = (data?.exportRows ?? []) as EstimateExportRow[];
  const kpiData = (data?.kpiRows ??
    data?.exportRows ??
    []) as EstimateExportRow[];
  const kpiCounts: Record<KpiKey, number> = {
    all: summary.total,
    sent: summary.sentEstimates,
    received: summary.receivedEstimates,
    pending: summary.pending,
  };
  const salesmen = data?.filterOptions?.salesmen ?? [];
  const counterparties =
    data?.filterOptions?.counterparties ?? data?.filterOptions?.customers ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const totalCount = pagination?.totalCount ?? 0;
  const showFrom = totalCount > 0 ? (page - 1) * 20 + 1 : 0;
  const showTo = Math.min(page * 20, totalCount);
  const showRiskColumn = direction !== "received";

  const setFilter = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const selectDirection = (nextDirection: DirectionFilter) => {
    setDirection(nextDirection);
    setPage(1);
  };

  const selectKpi = (key: KpiKey) => {
    if (key === "pending") {
      setDirection("sent");
      setStatus("pending");
      setPage(1);
      return;
    }

    setDirection(key);
    setStatus("all");
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setDirection("all");
    setStatus("all");
    setDiscountLevel("all");
    setSalesmanId("all");
    setCounterpartyId("all");
    setDateRange("this_month");
    setSortBy("latest");
    setPage(1);
  };

  const exportRows = () => {
    const rows = exportData;
    if (rows.length === 0) return;
    const headers = [
      "Estimate ID",
      "Date",
      "Direction",
      "Counterparty",
      "Salesman",
      "Total",
      "Discount %",
      "Status",
      "Risk",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.estimateNumber,
          formatDate(row.date),
          row.direction,
          row.counterparty,
          row.salesman,
          row.total,
          row.discountPercent,
          getExportStatusLabel(row),
          row.risk,
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "warehouse-estimates.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFollowUp = async (estimate: EstimateRow) => {
    const phone = getCounterpartyPhone(estimate)?.trim();
    if (!phone) {
      toast.info("No counterparty phone number is available");
      return;
    }

    try {
      await navigator.clipboard.writeText(phone);
      toast.success(`Counterparty phone copied: ${phone}`);
    } catch {
      toast.info(`Call counterparty: ${phone}`);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Estimate Management
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Review salesman estimates, approve discounts, and monitor customer
            responses.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportRows}
          disabled={!data?.exportRows?.length}
          className="h-9 gap-2"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      <DashboardKpiGrid className="sm:grid-cols-2 xl:grid-cols-4">
        {kpiConfig.map((cfg) => {
          const Icon = cfg.icon;
          const active =
            cfg.key === "pending"
              ? direction === "sent" && status === "pending"
              : direction === cfg.key && status === "all";

          return (
            <DashboardKpiCard
              key={cfg.key}
              active={active}
              chartData={buildEstimateChartData(kpiData, cfg.key)}
              description={cfg.description}
              footer={{
                label: cfg.key === "all" ? "Total Value" : "Current View",
                value:
                  cfg.key === "all"
                    ? formatMoney(summary.totalValue)
                    : kpiCounts[cfg.key].toLocaleString("en-BD"),
              }}
              icon={<Icon className="h-6 w-6" />}
              label={cfg.label}
              onClick={() => selectKpi(cfg.key)}
              tone={cfg.tone}
              trend={buildEstimateTrend(kpiData, cfg.key)}
              value={kpiCounts[cfg.key].toLocaleString("en-BD")}
            />
          );
        })}
      </DashboardKpiGrid>

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
          <div className="relative flex-1 sm:min-w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Estimate ID / counterparty / salesman..."
              className="h-9 pl-9"
            />
          </div>
          <CompactSelect
            value={status}
            onChange={(value) =>
              setFilter(() => setStatus(value as StatusFilter))
            }
            options={statusOptions}
          />
          <CompactSelect
            value={discountLevel}
            onChange={(value) =>
              setFilter(() => setDiscountLevel(value as DiscountFilter))
            }
            options={discountOptions}
          />
          <Select
            value={salesmanId}
            onValueChange={(value) => setFilter(() => setSalesmanId(value))}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Salesmen</SelectItem>
              {salesmen.map((salesman: { id: string; name: string | null }) => (
                <SelectItem key={salesman.id} value={salesman.id}>
                  {salesman.name ?? "Unnamed salesman"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={counterpartyId}
            onValueChange={(value) => setFilter(() => setCounterpartyId(value))}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Counterparties</SelectItem>
              {counterparties.map(
                (counterparty: { id: string; name: string | null }) => (
                  <SelectItem key={counterparty.id} value={counterparty.id}>
                    {counterparty.name ?? "Unnamed counterparty"}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <CompactSelect
            value={dateRange}
            onChange={(value) =>
              setFilter(() => setDateRange(value as DateFilter))
            }
            options={dateOptions}
          />
          <CompactSelect
            value={sortBy}
            onChange={(value) => setFilter(() => setSortBy(value as SortBy))}
            options={sortOptions}
          />
          <Button
            variant="outline"
            onClick={clearFilters}
            className="h-9 gap-2"
          >
            <Filter className="h-4 w-4" />
            Clear
          </Button>
          {estimatesQuery.isFetching && (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto border-b px-4 py-2">
          {directionTabs.map((tab) => {
            const active = direction === tab.value;
            const Icon = tab.icon;
            const count =
              tab.value === "sent"
                ? summary.sentEstimates
                : tab.value === "received"
                  ? summary.receivedEstimates
                  : summary.total;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => selectDirection(tab.value)}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                <Badge
                  variant={active ? "secondary" : "outline"}
                  className="h-5 min-w-5 justify-center px-1.5 text-[10px]"
                >
                  {count.toLocaleString("en-BD")}
                </Badge>
              </button>
            );
          })}
        </div>

        {estimatesQuery.isLoading ? (
          <TableSkeleton />
        ) : estimatesQuery.isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load estimates"
            description="Try refreshing or adjusting your filters."
            action={
              <Button onClick={() => estimatesQuery.refetch()}>Retry</Button>
            }
          />
        ) : estimates.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No estimates found"
            description="Sent and received estimates matching this view will appear here."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">
                  Estimate ID
                </TableHead>
                <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">
                  Date
                </TableHead>
                <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">
                  {getPartyColumnLabel(direction)}
                </TableHead>
                <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">
                  Salesman
                </TableHead>
                <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-wider">
                  Amount
                </TableHead>
                <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">
                  Discount
                </TableHead>
                <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">
                  Status
                </TableHead>
                {showRiskColumn && (
                  <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider">
                    Risk
                  </TableHead>
                )}
                <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-wider">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.map((estimate) => (
                <TableRow key={estimate.id}>
                  <TableCell className="px-4 py-3">
                    <span className="font-medium">
                      {estimate.estimateNumber}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {formatDate(estimate.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {getCounterpartyName(estimate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getCounterpartyPhone(estimate) ?? ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {estimate.salesman?.name ?? "Salesman"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono font-medium tabular-nums">
                    {formatMoney(estimate.total)}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="font-mono text-sm tabular-nums">
                      {Number(estimate.discountPercent).toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn("border", statusTone[estimate.status])}
                    >
                      {getEstimateStatusLabel(estimate)}
                    </Badge>
                  </TableCell>
                  {showRiskColumn && (
                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn("border", riskTone[estimate.risk])}
                      >
                        {riskLabel(estimate.risk)}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell className="px-4 py-3 text-right">
                    <RowActions
                      estimate={estimate}
                      busyAction={
                        quickActionMutation.isPending &&
                        quickActionMutation.variables?.estimate.id ===
                          estimate.id
                          ? quickActionMutation.variables.kind
                          : null
                      }
                      onAction={(kind) =>
                        quickActionMutation.mutate({ kind, estimate })
                      }
                      onFollowUp={() => handleFollowUp(estimate)}
                      onView={() => setSelectedEstimateId(estimate.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!estimatesQuery.isLoading &&
          !estimatesQuery.isError &&
          totalCount > 0 && (
            <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted-foreground">
                Showing {showFrom}-{showTo} of {totalCount} estimates
              </span>
              <div className="flex items-center gap-1.5">
                <PageButton disabled={page <= 1} onClick={() => setPage(1)}>
                  <ChevronsLeft className="h-4 w-4" />
                </PageButton>
                <PageButton
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </PageButton>
                {generatePageNumbers(page, totalPages).map(
                  (pageNumber, index) =>
                    pageNumber === "..." ? (
                      <span
                        key={`dots-${index}`}
                        className="px-1 text-xs text-muted-foreground"
                      >
                        ...
                      </span>
                    ) : (
                      <Button
                        key={pageNumber}
                        variant={pageNumber === page ? "default" : "outline"}
                        size="icon"
                        className="h-8 w-8 text-xs"
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
                      </Button>
                    ),
                )}
                <PageButton
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </PageButton>
                <PageButton
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  <ChevronsRight className="h-4 w-4" />
                </PageButton>
              </div>
            </div>
          )}
      </div>

      <Sheet
        open={!!selectedEstimateId}
        onOpenChange={(open) => {
          if (!open) setSelectedEstimateId(null);
        }}
      >
        <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-xl lg:max-w-3xl!">
          <SheetHeader className="sr-only">
            <SheetTitle>Estimate Detail</SheetTitle>
            <SheetDescription>Review estimate information</SheetDescription>
          </SheetHeader>
          {detailQuery.isLoading ? (
            <div className="flex min-h-[360px] flex-1 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading estimate details...
            </div>
          ) : detailQuery.isError || !detailQuery.data ? (
            <div className="grid min-h-[360px] flex-1 place-items-center px-6 text-center">
              <div>
                <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
                <h3 className="mt-3 text-sm font-semibold">
                  Detail unavailable
                </h3>
              </div>
            </div>
          ) : (
            <EstimateDetailPanel
              detail={detailQuery.data as unknown as EstimateDetail}
              onDone={() => {
                queryClient.invalidateQueries({
                  queryKey: ["warehouseEstimate"],
                });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function EstimateDetailPanel({
  detail,
  onDone,
}: {
  detail: EstimateDetail;
  onDone: () => void;
}) {
  const router = useRouter();
  const estimate = detail.estimate;
  const [discountInput, setDiscountInput] = useState(
    Number(estimate.discountPercent).toFixed(2),
  );
  const [note, setNote] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the review form when a different estimate is loaded
  useEffect(() => {
    setDiscountInput(Number(estimate.discountPercent).toFixed(2));
    setNote("");
  }, [estimate.id, estimate.discountPercent]);

  const reviewMutation = useMutation({
    mutationFn: (input: {
      action: "approve" | "reject";
      discountPercent?: number;
      note?: string;
    }) =>
      orpc.warehouseEstimate.reviewEstimate.call({
        id: estimate.id,
        ...input,
      }),
    onSuccess: (_, variables) => {
      toast.success(
        variables.action === "approve"
          ? "Estimate approved"
          : "Estimate rejected",
      );
      onDone();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update estimate");
    },
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      orpc.warehouseEstimate.sendEstimate.call({
        id: estimate.id,
      }),
    onSuccess: () => {
      toast.success("Estimate sent to customer");
      onDone();
    },
    onError: (error) => toast.error(error.message || "Failed to send estimate"),
  });

  const acceptMutation = useMutation({
    mutationFn: () =>
      orpc.warehouseEstimate.acceptEstimate.call({
        id: estimate.id,
      }),
    onSuccess: (data) => {
      toast.success(
        data.alreadyConverted
          ? "Estimate was already converted"
          : "Estimate accepted and converted to order",
      );
      onDone();
      const orderId = data.order?.id;
      if (orderId) {
        router.push(`/warehouse/dashboard/purchases/${orderId}`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to accept estimate");
    },
  });

  const discountPercent = Number(discountInput || 0);
  const subtotal = Number(estimate.subtotal || 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const newTotal = Math.max(0, subtotal - discountAmount);
  const canManage = estimate.canManage;
  const isPending = canManage && estimate.status === "pending";
  const isApproved = canManage && estimate.status === "approved";
  const isSubmitting =
    reviewMutation.isPending ||
    sendMutation.isPending ||
    acceptMutation.isPending;
  const isReceived = estimate.direction === "received";
  const canAcceptReceived =
    isReceived &&
    (estimate.status === "sent" || estimate.status === "approved");
  const convertedOrderHref =
    estimate.status === "converted" && estimate.convertedOrderId
      ? isReceived
        ? `/warehouse/dashboard/purchases/${estimate.convertedOrderId}`
        : `/warehouse/dashboard/order-management/${estimate.convertedOrderId}`
      : null;
  const counterpartyName = getCounterpartyName(estimate);
  const counterpartyPhone = getCounterpartyPhone(estimate);

  const approve = () => {
    const parsed = Number(discountInput);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      toast.error("Enter a valid discount between 0 and 100");
      return;
    }
    reviewMutation.mutate({
      action: "approve",
      discountPercent: parsed,
      note: note.trim() || undefined,
    });
  };

  const reject = () => {
    reviewMutation.mutate({
      action: "reject",
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estimate Detail
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {estimate.estimateNumber}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {counterpartyName} · {formatDate(estimate.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "border",
                estimate.direction === "sent"
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-violet-200 bg-violet-50 text-violet-700",
              )}
            >
              {estimate.direction === "sent" ? "Sent" : "Received"}
            </Badge>
            <Badge
              variant="outline"
              className={cn("border", statusTone[estimate.status])}
            >
              {getEstimateStatusLabel(estimate)}
            </Badge>
            {!isReceived && (
              <Badge
                variant="outline"
                className={cn("border", riskTone[estimate.risk])}
              >
                {riskLabel(estimate.risk)} Risk
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="divide-y divide-border">
          {!isReceived && (
            <section className="px-6 py-5">
              <StatusTimeline estimate={estimate} />
            </section>
          )}

          <section className="grid gap-x-10 gap-y-6 px-6 py-5 sm:grid-cols-2">
            <InfoBlock
              title={isReceived ? "Seller Warehouse" : "Customer Information"}
            >
              <InfoLine
                label={isReceived ? "From Warehouse" : "Customer"}
                value={counterpartyName}
              />
              <InfoLine label="Phone" value={counterpartyPhone} />
              {isReceived ? (
                <>
                  <InfoLine
                    label="Email"
                    value={estimate.counterparty?.email ?? "N/A"}
                  />
                  <InfoLine label="Type" value="Warehouse" />
                </>
              ) : (
                <>
                  <InfoLine
                    label="Total Orders"
                    value={detail.insights.customer.totalOrders.toLocaleString()}
                  />
                  <InfoLine
                    label="Avg Value"
                    value={formatMoney(detail.insights.customer.averageValue)}
                  />
                </>
              )}
            </InfoBlock>

            <InfoBlock title="Salesman Information">
              <InfoLine label="Salesman" value={estimate.salesman?.name} />
              <InfoLine
                label="Total Estimates"
                value={detail.insights.salesman.totalEstimates.toLocaleString()}
              />
              <InfoLine
                label="High Discounts"
                value={detail.insights.salesman.highDiscounts.toLocaleString()}
              />
              <InfoLine
                label="Approval Rate"
                value={`${detail.insights.salesman.approvalRate}%`}
              />
              <InfoLine
                label="Insight"
                value={detail.insights.salesman.behavior}
              />
            </InfoBlock>
          </section>

          <section className="px-6 py-5">
            <SectionTitle>Product Breakdown</SectionTitle>
            <Table className="mt-2">
              <TableHeader>
                <TableRow className="border-b hover:bg-transparent">
                  <TableHead className="h-8 px-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Product
                  </TableHead>
                  <TableHead className="h-8 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Qty
                  </TableHead>
                  <TableHead className="h-8 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Price
                  </TableHead>
                  <TableHead className="h-8 px-0 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimate.items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-transparent">
                    <TableCell className="px-0">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.productSize ?? "Variant"}
                      </p>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(item.unitPrice)}
                    </TableCell>
                    <TableCell className="px-0 text-right font-medium tabular-nums">
                      {formatMoney(item.totalPrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section className="px-6 py-5">
            <InfoBlock title="Pricing Summary">
              <InfoLine
                label="Subtotal"
                value={formatMoney(estimate.subtotal)}
              />
              <InfoLine
                label={`Discount (${Number(estimate.discountPercent).toFixed(2)}%)`}
                value={`-${formatMoney(estimate.discount)}`}
              />
              <Separator className="my-1" />
              <InfoLine
                label="Final Amount"
                value={formatMoney(estimate.total)}
                strong
              />
            </InfoBlock>
          </section>

          {canAcceptReceived && (
            <section className="bg-muted/30 px-6 py-5">
              <SectionTitle>Accept & Place Order</SectionTitle>
              <Button
                className="mt-3 gap-2"
                onClick={() => acceptMutation.mutate()}
                disabled={isSubmitting}
              >
                {acceptMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingBag className="h-4 w-4" />
                )}
                Accept & Place Order
              </Button>
            </section>
          )}

          {convertedOrderHref && (
            <section className="px-6 py-5">
              <InfoBlock title="Converted Order">
                <InfoLine
                  label="Status"
                  value={
                    isReceived
                      ? "This estimate was accepted and converted into your purchase order."
                      : "This estimate was converted into a warehouse order."
                  }
                />
                <Button
                  variant="outline"
                  className="mt-3 gap-2"
                  onClick={() => router.push(convertedOrderHref)}
                >
                  <ExternalLink className="h-4 w-4" />
                  View Order
                </Button>
              </InfoBlock>
            </section>
          )}

          {(isPending || isApproved) && (
            <section className="bg-muted/30 px-6 py-5">
              <SectionTitle>
                {isPending ? "Review & Approve" : "Send Estimate"}
              </SectionTitle>

              <div className="mt-3 space-y-3">
                {isPending && (
                  <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                    <div className="w-28 space-y-1.5">
                      <Label htmlFor="discountPercent">Discount (%)</Label>
                      <Input
                        id="discountPercent"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={discountInput}
                        onChange={(event) =>
                          setDiscountInput(event.target.value)
                        }
                      />
                    </div>
                    <p className="pb-2 text-sm text-muted-foreground">
                      New total{" "}
                      <span className="font-semibold text-foreground tabular-nums">
                        {formatMoney(newTotal)}
                      </span>
                      {discountAmount > 0 && (
                        <span className="tabular-nums">
                          {" "}
                          · −{formatMoney(discountAmount)} off
                        </span>
                      )}
                    </p>
                  </div>
                )}

                <Textarea
                  id="internalNote"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Internal note (optional)"
                  rows={2}
                  className="resize-none"
                />

                <div className="flex flex-wrap gap-2">
                  {isPending && (
                    <>
                      <Button
                        onClick={approve}
                        disabled={isSubmitting}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        {reviewMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={reject}
                        disabled={isSubmitting}
                        className="gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                  {isApproved && (
                    <Button
                      onClick={() => sendMutation.mutate()}
                      disabled={isSubmitting}
                      className="gap-2"
                    >
                      {sendMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send to Customer
                    </Button>
                  )}
                </div>
              </div>
            </section>
          )}

          {estimate.notes && (
            <section className="px-6 py-5">
              <SectionTitle>Notes</SectionTitle>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {estimate.notes}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusTimeline({
  estimate,
}: {
  estimate: EstimateDetail["estimate"];
}) {
  const steps = [
    { key: "created", label: "Created", date: estimate.createdAt },
    { key: "approval", label: "Approval", date: estimate.approvedAt },
    { key: "sent", label: "Sent", date: estimate.sentAt },
    { key: "converted", label: "Converted", date: estimate.convertedAt },
  ];
  const isComplete = (index: number) =>
    index === 0 || Boolean(steps[index].date);

  return (
    <ol className="grid grid-cols-4">
      {steps.map((step, index) => {
        const complete = isComplete(index);
        const isLast = index === steps.length - 1;
        return (
          <li
            key={step.key}
            className="relative flex flex-col items-center px-1 text-center"
          >
            {!isLast && (
              <span
                className={cn(
                  "absolute left-1/2 top-3 -z-0 h-0.5 w-full",
                  isComplete(index + 1) ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background transition-colors",
                complete
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-transparent",
              )}
            >
              {complete ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              )}
            </span>
            <span
              className={cn(
                "mt-2 text-xs font-medium",
                complete ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">
              {formatDate(step.date)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RowActions({
  estimate,
  busyAction,
  onAction,
  onFollowUp,
  onView,
}: {
  estimate: EstimateRow;
  busyAction: QuickActionKind | null;
  onAction: (kind: QuickActionKind) => void;
  onFollowUp: () => void;
  onView: () => void;
}) {
  const isBusy = Boolean(busyAction);

  if (!estimate.canManage) {
    return (
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={onView} className="h-8">
          View
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {estimate.status === "pending" && (
        <>
          <Button
            size="sm"
            onClick={() => onAction("approve")}
            disabled={isBusy}
            className="h-8 gap-1.5"
          >
            {busyAction === "approve" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction("reject")}
            disabled={isBusy}
            className="h-8 gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            {busyAction === "reject" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            Reject
          </Button>
        </>
      )}

      {estimate.status === "approved" && (
        <Button
          size="sm"
          onClick={() => onAction("send")}
          disabled={isBusy}
          className="h-8 gap-1.5"
        >
          {busyAction === "send" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Send
        </Button>
      )}

      {estimate.status === "sent" && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction("resend")}
            disabled={isBusy}
            className="h-8 gap-1.5"
          >
            {busyAction === "resend" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            Resend
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onFollowUp}
            className="h-8 gap-1.5"
          >
            <Phone className="h-3.5 w-3.5" />
            Follow-up
          </Button>
        </>
      )}

      <Button size="sm" variant="ghost" onClick={onView} className="h-8">
        View
      </Button>
    </div>
  );
}

function CompactSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[150px]">
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

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Inbox;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[320px] place-items-center text-center">
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="mt-3 font-semibold">{title}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3.5">
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

function PageButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-8 w-8"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold">{children}</h3>;
}

function InfoBlock({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <dl className="mt-3 space-y-2.5">{children}</dl>
    </div>
  );
}

function InfoLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right tabular-nums",
          strong ? "font-semibold" : "font-medium",
        )}
      >
        {value || "N/A"}
      </dd>
    </div>
  );
}
