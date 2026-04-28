"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeftIcon,
  CalendarIcon,
  PlusCircleIcon,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useShopAdjustments } from "@/hooks/use-shop-owner-api";

// ─── Helpers ───────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  increase: "Increase",
  decrease: "Decrease",
  damage: "Damage",
  loss: "Loss",
  correction: "Correction",
};

const TYPE_COLORS: Record<string, string> = {
  increase: "bg-emerald-50 text-emerald-700 border-emerald-200",
  decrease: "bg-amber-50 text-amber-700 border-amber-200",
  damage: "bg-red-50 text-red-700 border-red-200",
  loss: "bg-rose-50 text-rose-700 border-rose-200",
  correction: "bg-blue-50 text-blue-700 border-blue-200",
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

// ─── Main Page ─────────────────────────────────────────────────

export default function ShopAdjustmentListPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useShopAdjustments({
    search: debouncedSearch || undefined,
    adjustmentType: typeFilter === "all" ? undefined : typeFilter,
    page,
  });

  const items: any[] = (data as any)?.items ?? [];
  const totalCount = (data as any)?.totalCount ?? 0;
  const totalPages = (data as any)?.totalPages ?? 1;

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
        <Link href="/dashboard/stock-adjustment/create">
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
            {debouncedSearch || typeFilter !== "all"
              ? "Try adjusting your filters"
              : "Create your first stock adjustment to get started"}
          </p>
          <Link href="/dashboard/stock-adjustment/create">
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
              <TableRow className="bg-gray-50 border-b border-gray-200">
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto w-10">
                  #
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto">
                  Adj ID
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto">
                  Type
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto">
                  Reason
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto">
                  Items
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto">
                  Qty Change
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any, idx: number) => {
                const qty = parseFloat(item.totalQtyChange);
                const isPositive = qty >= 0;
                return (
                  <TableRow
                    key={item.id}
                    className="transition-colors hover:bg-gray-50/50"
                  >
                    <TableCell className="py-2.5">
                      <span className="text-xs text-gray-400 tabular-nums">
                        {(page - 1) * 20 + idx + 1}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="text-sm font-mono font-semibold text-gray-900">
                        {item.adjustmentNo}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <TypeBadge type={item.adjustmentType} />
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="text-xs text-gray-600">
                        {REASON_LABELS[item.reason] || item.reason}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="text-sm text-gray-700 tabular-nums">
                        {item.totalItems} SKU
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span
                        className={`text-sm font-bold tabular-nums ${isPositive ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {isPositive ? "+" : ""}
                        {qty}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5">
                      <span className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
                        <CalendarIcon size={11} />
                        {new Date(item.adjustmentDate).toLocaleDateString(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-500">
                Showing{" "}
                <span className="font-medium text-gray-900">
                  {(page - 1) * 20 + 1}–{Math.min(page * 20, totalCount)}
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
