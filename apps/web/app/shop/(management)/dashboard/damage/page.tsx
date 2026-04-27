"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarIcon,
  DollarSign,
  Package,
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
import { useDamageEntries, useDamageSummary } from "@/hooks/use-shop-owner-api";

// ─── Helpers ───────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  physical: "Physical Damage",
  expired: "Expired",
  lost: "Lost / Missing",
};

const TYPE_COLORS: Record<string, string> = {
  physical: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-amber-50 text-amber-700 border-amber-200",
  lost: "bg-rose-50 text-rose-700 border-rose-200",
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

function KPICard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  const colors: Record<string, { bg: string; icon: string; val: string; lbl: string }> = {
    red: {
      bg: "bg-red-50/50 border-red-200",
      icon: "bg-red-100 text-red-600",
      val: "text-red-700",
      lbl: "text-red-500",
    },
    amber: {
      bg: "bg-amber-50/50 border-amber-200",
      icon: "bg-amber-100 text-amber-600",
      val: "text-amber-700",
      lbl: "text-amber-500",
    },
    blue: {
      bg: "bg-blue-50/50 border-blue-200",
      icon: "bg-blue-100 text-blue-600",
      val: "text-blue-700",
      lbl: "text-blue-500",
    },
  };
  const c = colors[color] ?? colors.blue!;

  return (
    <div className={`border rounded-xl p-4 transition-shadow hover:shadow-sm ${c.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${c.icon}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <div className={`text-2xl font-bold ${c.val} tabular-nums`}>{value}</div>
          <div className={`text-xs font-medium ${c.lbl}`}>{label}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function DamageListPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data: summaryData } = useDamageSummary();
  const summary = summaryData as any;

  const { data, isLoading } = useDamageEntries({
    search: debouncedSearch || undefined,
    damageType: typeFilter === "all" ? undefined : typeFilter,
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
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Damage Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track product damage, expiry, and loss
          </p>
        </div>
        <Link href="/dashboard/damage/create">
          <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700">
            <PlusCircleIcon size={16} />
            Add Damage Entry
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPICard
          label="Total Damage"
          value={`${summary?.totalDamageQty ?? 0} Items`}
          icon={Package}
          color="red"
        />
        <KPICard
          label="Loss Value"
          value={`৳ ${(summary?.totalLossValue ?? 0).toLocaleString("en-IN")}`}
          icon={DollarSign}
          color="amber"
        />
        <KPICard
          label="Total Entries"
          value={`${summary?.totalEntries ?? 0} Entries`}
          icon={AlertTriangle}
          color="blue"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white border rounded-lg p-3">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="Search Entry ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              clearTimeout((window as any).__dmgSearchTimer);
              (window as any).__dmgSearchTimer = setTimeout(() => {
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
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="physical">💥 Physical Damage</SelectItem>
            <SelectItem value="expired">⏰ Expired</SelectItem>
            <SelectItem value="lost">📦 Lost / Missing</SelectItem>
          </SelectContent>
        </Select>

        <p className="text-xs text-muted-foreground ml-auto">
          <span className="font-semibold text-foreground">{totalCount}</span>{" "}
          entries
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg bg-gray-50/50">
          <div className="w-8 h-8 border-3 border-red-200 border-t-red-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading damage records…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed rounded-lg bg-gray-50/50">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500 text-lg font-medium">
            No damage records found
          </p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            {debouncedSearch || typeFilter !== "all"
              ? "Try adjusting your filters"
              : "Add your first damage entry to get started"}
          </p>
          <Link href="/dashboard/damage/create">
            <Button size="sm" className="gap-1.5 bg-red-600 hover:bg-red-700">
              <PlusCircleIcon size={16} />
              Add First Entry
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
                  Entry ID
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto">
                  Type
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto">
                  Qty
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto">
                  Loss Value
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto">
                  Entry By
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto">
                  Date
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2.5 h-auto text-center">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any, idx: number) => (
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
                      {item.entryNo}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <TypeBadge type={item.damageType} />
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="text-sm font-bold text-gray-700 tabular-nums">
                      {item.totalQty}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="text-sm font-bold text-red-600 tabular-nums">
                      ৳ {parseFloat(item.totalLossValue).toLocaleString("en-IN")}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="text-xs text-gray-600">
                      {item.enteredByName || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
                      <CalendarIcon size={11} />
                      {new Date(item.entryDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 text-center">
                    <Link href={`/dashboard/damage/${item.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
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
                <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1} className="h-7 w-7 p-0 text-xs">«</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1} className="h-7 w-7 p-0 text-xs">‹</Button>
                <span className="text-xs font-medium text-gray-600 px-2">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages} className="h-7 w-7 p-0 text-xs">›</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="h-7 w-7 p-0 text-xs">»</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
