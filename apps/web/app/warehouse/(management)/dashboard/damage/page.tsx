"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  PackageX,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { orpc } from "@/utils/orpc";

const TYPE_LABELS: Record<string, string> = {
  physical: "Physical Damage",
  expired: "Expired",
  lost: "Lost / Missing",
};

const MODE_LABELS: Record<string, string> = {
  loose: "Loose",
  pack: "Pack",
  carton: "Carton",
  direct: "Direct Unit",
};

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function TypeBadge({ type }: { type: string }) {
  const tone =
    type === "physical"
      ? "border-red-200 bg-red-50 text-red-700"
      : type === "expired"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-300 bg-slate-100 text-slate-700";
  return (
    <Badge variant="outline" className={tone}>
      {TYPE_LABELS[type] ?? type}
    </Badge>
  );
}

function KpiCard({
  eyebrow,
  value,
  helper,
  icon: Icon,
  tone,
}: {
  eyebrow: string;
  value: string;
  helper: string;
  icon: typeof PackageX;
  tone: "red" | "amber" | "slate";
}) {
  const styles = {
    red: "border-red-200 bg-[linear-gradient(135deg,#fff_0%,#fff5f5_100%)] text-red-700",
    amber:
      "border-amber-200 bg-[linear-gradient(135deg,#fff_0%,#fffbeb_100%)] text-amber-700",
    slate:
      "border-slate-200 bg-[linear-gradient(135deg,#fff_0%,#f8fafc_100%)] text-slate-700",
  }[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${styles}`}
    >
      <div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-current opacity-[0.045]" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">
            {eyebrow}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-xs font-medium opacity-70">{helper}</p>
        </div>
        <span className="rounded-xl border border-current/10 bg-white/70 p-2.5 shadow-sm">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export default function WarehouseDamagePage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState("all");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState("posted");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      damageType:
        type === "all" ? undefined : (type as "physical" | "expired" | "lost"),
      damageMode:
        mode === "all"
          ? undefined
          : (mode as "loose" | "pack" | "carton" | "direct"),
      status:
        status === "all"
          ? undefined
          : (status as "draft" | "posted" | "reversed"),
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [debouncedSearch, type, mode, status, dateFrom, dateTo],
  );

  const listQuery = useQuery(
    orpc.warehouseDamage.list.queryOptions({
      input: { ...filters, page, pageSize: 20 },
    }),
  );
  const summaryQuery = useQuery(
    orpc.warehouseDamage.summary.queryOptions({ input: filters }),
  );

  const data = listQuery.data;
  const summary = summaryQuery.data;
  const quantitySummary =
    [
      summary?.cartonCount
        ? `${formatNumber(summary.cartonCount)} ${summary.cartonCount === 1 ? "carton" : "cartons"}`
        : null,
      ...(summary?.quantityGroups.map(
        (item) => `${formatNumber(item.quantity)} ${item.unit}`,
      ) ?? []),
    ]
      .filter(Boolean)
      .join(" · ") || "0 recorded";
  const hasFilters = Boolean(
    debouncedSearch ||
      type !== "all" ||
      mode !== "all" ||
      status !== "posted" ||
      dateFrom ||
      dateTo,
  );

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setType("all");
    setMode("all");
    setStatus("posted");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-200/70">
        <div className="absolute inset-y-0 right-0 w-2/5 bg-[radial-gradient(circle_at_center,rgba(248,113,113,.22),transparent_65%)]" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Stock Control
            </p>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Damage Management
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Record physical damage, expiry, and missing stock with proof,
              source identity, and acquisition-cost loss.
            </p>
          </div>
          <Button
            asChild
            className="gap-2 bg-red-500 font-bold text-white hover:bg-red-400"
          >
            <Link href="/warehouse/dashboard/damage/create">
              <Plus className="h-4 w-4" /> Add Damage Entry
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <KpiCard
          eyebrow="Damaged stock"
          value={quantitySummary}
          helper="Grouped by operational unit"
          icon={PackageX}
          tone="red"
        />
        <KpiCard
          eyebrow="Acquisition loss"
          value={`৳ ${(summary?.totalLossValue ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
          helper="Posted cost snapshots"
          icon={CircleDollarSign}
          tone="amber"
        />
        <KpiCard
          eyebrow="Damage entries"
          value={(summary?.totalEntries ?? 0).toLocaleString()}
          helper="Records matching current filters"
          icon={AlertTriangle}
          tone="slate"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            <SlidersHorizontal className="h-4 w-4" /> Search & filter
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_repeat(3,minmax(145px,.7fr))_repeat(2,minmax(145px,.8fr))]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="SKU, Entry ID, product, carton or batch"
                className="pl-9"
              />
            </div>
            <Select
              value={mode}
              onValueChange={(value) => {
                setMode(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All modes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modes</SelectItem>
                <SelectItem value="loose">Loose</SelectItem>
                <SelectItem value="pack">Pack</SelectItem>
                <SelectItem value="carton">Carton</SelectItem>
                <SelectItem value="direct">Direct unit</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="physical">Physical damage</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="lost">Lost / missing</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="reversed">Reversed</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              aria-label="From date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
            />
            <Input
              type="date"
              aria-label="To date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {listQuery.isLoading ? (
          <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
            Loading damage records…
          </div>
        ) : listQuery.isError ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <p className="font-semibold text-slate-900">
              Could not load damage records
            </p>
            <Button variant="outline" onClick={() => listQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : !data?.items.length ? (
          <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <PackageX className="h-8 w-8 text-slate-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              No damage records found
            </h2>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {hasFilters
                ? "No entries match the current search and filters."
                : "Create the first auditable warehouse damage entry."}
            </p>
            <div className="mt-5 flex gap-2">
              {hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button asChild className="bg-red-600 hover:bg-red-700">
                  <Link href="/warehouse/dashboard/damage/create">
                    <Plus className="mr-2 h-4 w-4" /> Add first entry
                  </Link>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead>Entry ID</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-right">Loss value</TableHead>
                    <TableHead>Entry by</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((entry) => (
                    <TableRow key={entry.id} className="group">
                      <TableCell>
                        <div className="font-mono text-sm font-bold text-slate-950">
                          {entry.entryNo}
                        </div>
                        {entry.status !== "posted" && (
                          <Badge
                            variant="outline"
                            className={`mt-1 text-[10px] ${
                              entry.status === "draft"
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-300 text-slate-500"
                            }`}
                          >
                            {entry.status === "draft" ? "Draft" : "Reversed"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="max-w-52 truncate text-sm font-semibold text-slate-800">
                          {entry.productNames.slice(0, 2).join(", ") ||
                            "Unposted draft"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {entry.status === "draft"
                            ? `${entry.draftSourceCount} selected source${entry.draftSourceCount === 1 ? "" : "s"}`
                            : `${entry.productCount} product${entry.productCount === 1 ? "" : "s"}`}
                        </p>
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={entry.damageType} />
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-700">
                        {MODE_LABELS[entry.damageMode] ?? entry.damageMode}
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-56 flex-wrap gap-1">
                          {entry.cartonCount > 0 && (
                            <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                              {entry.cartonCount}{" "}
                              {entry.cartonCount === 1 ? "carton" : "cartons"}
                            </span>
                          )}
                          {entry.quantityGroups.map((item) => (
                            <span
                              key={item.unit}
                              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700"
                            >
                              {formatNumber(item.quantity)} {item.unit}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-red-700">
                        ৳{" "}
                        {entry.totalLossValue.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {entry.createdByName}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-600">
                          <CalendarDays className="h-3.5 w-3.5" />{" "}
                          {formatDate(entry.entryDate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="font-bold text-red-700 hover:bg-red-50 hover:text-red-800"
                        >
                          <Link
                            href={`/warehouse/dashboard/damage/${entry.id}`}
                          >
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                Showing {Math.min((page - 1) * 20 + 1, data.totalCount)}–
                {Math.min(page * 20, data.totalCount)} of {data.totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-20 text-center text-xs font-bold text-slate-600">
                  Page {page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
