"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  FileText,
  Inbox,
  Search,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { type ElementType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DashboardKpiCard,
  DashboardKpiGrid,
  type DashboardKpiTone,
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
import { getDeliveryColumns } from "./_components/delivery-columns";
import { DeliveryInvoiceDrawer } from "./_components/delivery-invoice-drawer";
import { DeliveryTypeModal } from "./_components/delivery-type-modal";
import { InternalGroupModal } from "./_components/internal-group-modal";
import {
  type DeliveryDisplayStatus,
  type DeliveryInvoiceRow,
  type DeliveryKpiFilter,
  type DeliveryTypeFilter,
} from "./_components/delivery-utils";

const PER_PAGE = 20;

type DateFilter = "all" | "today" | "this_month";

const kpiConfig: {
  key: DeliveryKpiFilter;
  label: string;
  emoji: string;
  icon: ElementType;
  tone: DashboardKpiTone;
  description: string;
}[] = [
  {
    key: "all",
    label: "Total Invoice",
    emoji: "📋",
    icon: FileText,
    tone: "slate",
    description: "All delivery-stage invoices",
  },
  {
    key: "pending",
    label: "Pending",
    emoji: "🟡",
    icon: Clock,
    tone: "amber",
    description: "Delivery type not selected yet",
  },
  {
    key: "in_delivery",
    label: "In Delivery",
    emoji: "🚚",
    icon: Truck,
    tone: "violet",
    description: "Grouped or out for delivery",
  },
  {
    key: "delivered",
    label: "Delivered",
    emoji: "✅",
    icon: CheckCircle2,
    tone: "emerald",
    description: "Successfully delivered",
  },
];

const dateOptions = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "this_month", label: "This Month" },
];

const deliveryTypeOptions = [
  { value: "all", label: "All Delivery Types" },
  { value: "not_selected", label: "Not Selected" },
  { value: "internal", label: "Internal" },
  { value: "third_party", label: "Third Party" },
];

const statusOptions: { value: "all" | DeliveryDisplayStatus; label: string }[] =
  [
    { value: "all", label: "All Status" },
    { value: "pending", label: "Pending" },
    { value: "locked", label: "Locked" },
    { value: "in_delivery", label: "In Delivery" },
    { value: "delivered", label: "Delivered" },
  ];

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

export default function DeliveryManagementPage() {
  const queryClient = useQueryClient();
  const [kpi, setKpi] = useState<DeliveryKpiFilter>("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateFilter>("all");
  const [deliveryType, setDeliveryType] = useState<DeliveryTypeFilter>("all");
  const [status, setStatus] = useState<"all" | DeliveryDisplayStatus>("all");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [viewInvoiceId, setViewInvoiceId] = useState<number | null>(null);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupInvoices, setGroupInvoices] = useState<DeliveryInvoiceRow[]>([]);

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

  const listQuery = useQuery({
    ...orpc.warehouse.getDeliveryManagementInvoices.queryOptions({
      input: {
        search: debouncedSearch || undefined,
        kpi,
        deliveryType,
        status,
        dateRange,
        page,
        limit: PER_PAGE,
      },
    }),
  });

  const selectTypeMutation = useMutation(
    orpc.warehouse.selectDeliveryManagementType.mutationOptions(),
  );

  const invoices = (listQuery.data?.invoices ?? []) as DeliveryInvoiceRow[];
  const kpis = listQuery.data?.kpis ?? {
    total: 0,
    pending: 0,
    inDelivery: 0,
    delivered: 0,
  };
  const pagination = listQuery.data?.pagination ?? {
    page: 1,
    limit: PER_PAGE,
    total: 0,
    totalPages: 1,
  };

  const selectedInvoices = useMemo(
    () => invoices.filter((row) => rowSelection[String(row.id)]),
    [invoices, rowSelection],
  );

  const selectionMode = useMemo(() => {
    if (selectedInvoices.length === 0) return null;
    const allPending = selectedInvoices.every(
      (row) => row.deliveryType === "not_selected",
    );
    const allInternalReady = selectedInvoices.every(
      (row) =>
        row.deliveryType === "internal" &&
        !row.group &&
        row.deliveryStatus === "not_assigned",
    );
    if (allPending) return "choose_type" as const;
    if (allInternalReady) return "create_group" as const;
    return "mixed" as const;
  }, [selectedInvoices]);

  const selectKpi = (next: DeliveryKpiFilter) => {
    setKpi(next);
    setPage(1);
    setRowSelection({});
  };

  const invalidateList = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: orpc.warehouse.getDeliveryManagementInvoices.queryKey(),
    });
  }, [queryClient]);

  const handleToggleRow = useCallback(
    (invoice: DeliveryInvoiceRow, checked: boolean) => {
      if (!invoice.isSelectable) return;
      setRowSelection((prev) => {
        const next = { ...prev };
        if (checked) next[String(invoice.id)] = true;
        else delete next[String(invoice.id)];
        return next;
      });
    },
    [],
  );

  const handleToggleAll = useCallback(
    (checked: boolean, rows: DeliveryInvoiceRow[]) => {
      if (!checked) {
        setRowSelection({});
        return;
      }
      const next: RowSelectionState = {};
      for (const row of rows) {
        if (row.isSelectable) next[String(row.id)] = true;
      }
      setRowSelection(next);
    },
    [],
  );

  const handleChooseDeliveryType = () => {
    if (selectedInvoices.length === 0) {
      toast.error("Select at least one invoice");
      return;
    }
    if (selectionMode === "mixed") {
      toast.error(
        "Select only pending invoices, or only internal invoices awaiting a group",
      );
      return;
    }
    if (selectionMode === "create_group") {
      setGroupInvoices(selectedInvoices);
      setGroupModalOpen(true);
      return;
    }
    setTypeModalOpen(true);
  };

  const handleConfirmInternal = async () => {
    const invoiceIds = selectedInvoices.map((inv) => inv.id);
    try {
      await selectTypeMutation.mutateAsync({
        invoiceIds,
        deliveryType: "internal_delivery",
      });
      setTypeModalOpen(false);
      setGroupInvoices(
        selectedInvoices.map((inv) => ({
          ...inv,
          deliveryType: "internal",
          fulfillmentMode: "internal_delivery",
        })),
      );
      setRowSelection({});
      setGroupModalOpen(true);
      invalidateList();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to choose delivery type",
      );
    }
  };

  const handleGroupSuccess = ({ riderAssigned }: { riderAssigned: boolean }) => {
    invalidateList();
    if (!riderAssigned) {
      toast.success("Delivery group saved", {
        description: "Assign a rider in Delivery Team when ready.",
        action: {
          label: "Delivery Team",
          onClick: () => {
            window.location.href = "/warehouse/dashboard/delivery-team";
          },
        },
      });
    }
  };

  const columns = useMemo(
    () =>
      getDeliveryColumns({
        rowSelection,
        onToggleRow: handleToggleRow,
        onToggleAll: handleToggleAll,
        onView: (invoice) => setViewInvoiceId(invoice.id),
      }, invoices),
    [rowSelection, handleToggleRow, handleToggleAll, invoices],
  );

  const table = useReactTable({
    data: invoices,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    manualPagination: true,
    pageCount: pagination.totalPages,
  });

  const counts: Record<DeliveryKpiFilter, number> = {
    all: kpis.total,
    pending: kpis.pending,
    in_delivery: kpis.inDelivery,
    delivered: kpis.delivered,
  };

  const showFrom =
    pagination.total > 0 ? (pagination.page - 1) * PER_PAGE + 1 : 0;
  const showTo = Math.min(pagination.page * PER_PAGE, pagination.total);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Delivery Management
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Select pending invoices, choose delivery type, and create delivery
            groups
          </p>
        </div>
        <Link
          href="/warehouse/dashboard/delivery-team"
          className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Truck className="h-4 w-4" />
          Delivery Team
        </Link>
      </div>

      <DashboardKpiGrid className="sm:grid-cols-2 xl:grid-cols-4">
        {kpiConfig.map((cfg) => {
          const isActive = kpi === cfg.key;
          const Icon = cfg.icon;
          return (
            <DashboardKpiCard
              key={cfg.key}
              active={isActive}
              description={cfg.description}
              footer={{ label: "Invoices", value: counts[cfg.key].toLocaleString() }}
              icon={<Icon className="h-6 w-6" />}
              label={cfg.label}
              onClick={() => selectKpi(cfg.key)}
              tone={cfg.tone}
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Invoice / Order / Customer..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <Select
            value={deliveryType}
            onValueChange={(value) => {
              setDeliveryType(value as DeliveryTypeFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {deliveryTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as "all" | DeliveryDisplayStatus);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={dateRange}
            onValueChange={(value) => {
              setDateRange(value as DateFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1 border-b px-4 py-2">
          {kpiConfig.map((tab) => {
            const active = kpi === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => selectKpi(tab.key)}
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

        {selectedInvoices.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
            <p className="text-sm font-medium">
              {selectedInvoices.length} invoice
              {selectedInvoices.length === 1 ? "" : "s"} selected
            </p>
            <Button type="button" size="sm" onClick={handleChooseDeliveryType}>
              {selectionMode === "create_group"
                ? "Create Delivery Group"
                : "Choose Delivery Type"}
            </Button>
          </div>
        ) : null}

        {listQuery.isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3.5">
                <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : listQuery.isError ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="mt-3 text-sm font-medium">Failed to load invoices</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void listQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No delivery invoices</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Invoices appear here after dispatch with delivery mode selected.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
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
                    <TableCell key={cell.id}>
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

        <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {showFrom}–{showTo} of {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {generatePageNumbers(page, pagination.totalPages).map((item, index) =>
              item === "..." ? (
                <span key={`ellipsis-${index}`} className="px-1 text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={page === item ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(item)}
                >
                  {item}
                </Button>
              ),
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= pagination.totalPages}
              onClick={() =>
                setPage((current) =>
                  Math.min(pagination.totalPages, current + 1),
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(pagination.totalPages)}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <DeliveryTypeModal
        open={typeModalOpen}
        onOpenChange={setTypeModalOpen}
        selectedCount={selectedInvoices.length}
        loading={selectTypeMutation.isPending}
        onConfirmInternal={() => void handleConfirmInternal()}
      />

      <InternalGroupModal
        open={groupModalOpen}
        onOpenChange={setGroupModalOpen}
        invoices={groupInvoices}
        onSuccess={handleGroupSuccess}
      />

      <DeliveryInvoiceDrawer
        invoiceId={viewInvoiceId}
        open={viewInvoiceId !== null}
        onOpenChange={(open) => {
          if (!open) setViewInvoiceId(null);
        }}
      />
    </div>
  );
}
