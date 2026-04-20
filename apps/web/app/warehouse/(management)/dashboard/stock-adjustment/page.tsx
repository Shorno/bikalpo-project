"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowRightLeftIcon,
  ArrowUpDown,
  CalendarIcon,
  EyeIcon,
  PlusCircleIcon,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { orpc } from "@/utils/orpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ─────────────────────────────────────────────────────

type AdjustmentListItem = {
  id: number;
  adjustmentNo: string;
  adjustmentType: string;
  reason: string;
  status: string;
  adjustmentDate: string;
  totalItems: number;
  totalQtyChange: string;
  referenceNote: string | null;
  createdAt: string;
};

// ─── Helpers ───────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  increase: "Increase",
  decrease: "Decrease",
  damage: "Damage",
  loss: "Loss",
  correction: "Correction",
};

const TYPE_COLORS: Record<string, string> = {
  increase:
    "bg-emerald-50 text-emerald-700 border-emerald-200",
  decrease:
    "bg-amber-50 text-amber-700 border-amber-200",
  damage:
    "bg-red-50 text-red-700 border-red-200",
  loss:
    "bg-rose-50 text-rose-700 border-rose-200",
  correction:
    "bg-blue-50 text-blue-700 border-blue-200",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 border-gray-200",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const REASON_LABELS: Record<string, string> = {
  physical_count: "Physical Count",
  damage: "Damage",
  expired: "Expired",
  theft: "Theft",
  system_error: "System Error",
  other: "Other",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${TYPE_COLORS[type] || "bg-gray-100 text-gray-600"}`}
    >
      {TYPE_LABELS[type] || type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${STATUS_COLORS[status] || "bg-gray-100 text-gray-600"}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function StockAdjustmentPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: [
      "stockAdjustment",
      "list",
      debouncedSearch,
      typeFilter,
      statusFilter,
      page,
    ],
    queryFn: () =>
      (orpc.stockAdjustment as any).list.call({
        search: debouncedSearch || undefined,
        adjustmentType: typeFilter === "all" ? undefined : typeFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        pageSize,
      }),
  });

  const items: AdjustmentListItem[] = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // ─── Columns ──────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<AdjustmentListItem>[]>(
    () => [
      {
        id: "index",
        header: "#",
        cell: ({ row }) => (
          <span className="text-xs text-gray-400 tabular-nums">
            {(page - 1) * pageSize + row.index + 1}
          </span>
        ),
        size: 40,
      },
      {
        id: "adjustmentNo",
        accessorKey: "adjustmentNo",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Adj ID
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-sm font-mono font-semibold text-gray-900">
            {row.original.adjustmentNo}
          </span>
        ),
        size: 110,
      },
      {
        id: "adjustmentType",
        accessorKey: "adjustmentType",
        header: "Type",
        cell: ({ row }) => <TypeBadge type={row.original.adjustmentType} />,
        size: 110,
      },
      {
        id: "reason",
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <span className="text-xs text-gray-600">
            {REASON_LABELS[row.original.reason] || row.original.reason}
          </span>
        ),
        size: 120,
      },
      {
        id: "totalItems",
        accessorKey: "totalItems",
        header: "Items",
        cell: ({ row }) => (
          <span className="text-sm text-gray-700 tabular-nums">
            {row.original.totalItems} SKU
          </span>
        ),
        size: 70,
      },
      {
        id: "totalQtyChange",
        accessorKey: "totalQtyChange",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 hover:text-gray-900 transition-colors"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Qty Change
            <ArrowUpDown size={12} />
          </button>
        ),
        cell: ({ row }) => {
          const qty = parseFloat(row.original.totalQtyChange);
          const isPositive = qty >= 0;
          return (
            <span
              className={`text-sm font-bold tabular-nums ${isPositive ? "text-emerald-600" : "text-red-600"}`}
            >
              {isPositive ? "+" : ""}
              {qty}
            </span>
          );
        },
        size: 100,
      },
      {
        id: "adjustmentDate",
        accessorKey: "adjustmentDate",
        header: "Date",
        cell: ({ row }) => {
          const d = row.original.adjustmentDate;
          return (
            <span className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
              <CalendarIcon size={11} />
              {new Date(d).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          );
        },
        size: 110,
      },
      {
        id: "status",
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        size: 100,
      },
      {
        id: "action",
        header: () => <span className="text-center block">Action</span>,
        cell: ({ row }) => (
          <div className="text-center">
            <Link
              href={`/warehouse/dashboard/stock-adjustment/${row.original.id}`}
            >
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 hover:text-blue-800 font-medium gap-1"
              >
                <EyeIcon size={13} />
                View
              </Button>
            </Link>
          </div>
        ),
        size: 80,
      },
    ],
    [page, pageSize],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ArrowRightLeftIcon className="w-5 h-5 text-amber-600" />
            Stock Adjustment
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage stock corrections, write-offs, and adjustments
          </p>
        </div>
        <Link href="/warehouse/dashboard/stock-adjustment/create">
          <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700">
            <PlusCircleIcon size={16} />
            Create Adjustment
          </Button>
        </Link>
      </div>

      {/* 🔍 Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white border rounded-lg p-3">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="Search Adjustment ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              clearTimeout((window as any).__adjSearchTimer);
              (window as any).__adjSearchTimer = setTimeout(() => {
                setDebouncedSearch(e.target.value);
                setPage(1);
              }, 300);
            }}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="increase">📈 Increase</SelectItem>
            <SelectItem value="decrease">📉 Decrease</SelectItem>
            <SelectItem value="damage">💥 Damage</SelectItem>
            <SelectItem value="loss">📦 Loss</SelectItem>
            <SelectItem value="correction">🔧 Correction</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40 h-9 text-sm">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">📝 Draft</SelectItem>
            <SelectItem value="submitted">📤 Submitted</SelectItem>
            <SelectItem value="approved">✅ Approved</SelectItem>
            <SelectItem value="rejected">❌ Rejected</SelectItem>
          </SelectContent>
        </Select>

        <p className="text-xs text-muted-foreground ml-auto">
          <span className="font-semibold text-foreground">{totalCount}</span>{" "}
          adjustments
        </p>
      </div>

      {/* 📋 Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg bg-gray-50/50">
          <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading adjustments…
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed rounded-lg bg-gray-50/50">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <ArrowRightLeftIcon className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 text-lg font-medium">
            No adjustment records found
          </p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            {debouncedSearch || typeFilter !== "all" || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Create your first stock adjustment to get started"}
          </p>
          <Link href="/warehouse/dashboard/stock-adjustment/create">
            <Button
              size="sm"
              className="gap-1.5 bg-amber-600 hover:bg-amber-700"
            >
              <PlusCircleIcon size={16} />
              Create Adjustment
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow
                  key={hg.id}
                  className="bg-gray-50 border-b border-gray-200"
                >
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto"
                      style={{ width: h.getSize() }}
                    >
                      {h.isPlaceholder
                        ? null
                        : flexRender(
                            h.column.columnDef.header,
                            h.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="transition-colors hover:bg-gray-50/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-500">
                Showing{" "}
                <span className="font-medium text-gray-900">
                  {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, totalCount)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-900">{totalCount}</span>
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="h-7 w-7 p-0 text-xs"
                >
                  «
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="h-7 w-7 p-0 text-xs"
                >
                  ‹
                </Button>
                <span className="text-xs font-medium text-gray-600 px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="h-7 w-7 p-0 text-xs"
                >
                  ›
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="h-7 w-7 p-0 text-xs"
                >
                  »
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
