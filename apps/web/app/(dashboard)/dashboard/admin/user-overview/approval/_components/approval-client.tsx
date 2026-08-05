"use client";

import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  Search,
} from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
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
import { BUSINESS_NATURES } from "@/constants/seller-registration";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import { type ApplicationRow, applicationColumns } from "./application-columns";

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type TypeFilter = "all" | "seller" | "warehouse";
type ReferralFilter = "all" | "direct" | "invited";
type BusinessNatureFilter =
  | "all"
  | "unspecified"
  | (typeof BUSINESS_NATURES)[number]["id"];

const PAGE_SIZE = 20;

const KPI_BLOCKS: {
  key: StatusFilter;
  label: string;
}[] = [
  {
    key: "all",
    label: "Total Requests",
  },
  {
    key: "pending",
    label: "Pending",
  },
  {
    key: "approved",
    label: "Approved",
  },
  {
    key: "rejected",
    label: "Rejected",
  },
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

function formatBusinessNature(value: string) {
  if (value === "unspecified") return "Unspecified (legacy)";
  return BUSINESS_NATURES.find((nature) => nature.id === value)?.label ?? value;
}

export function ApprovalClient() {
  const [statusValue, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("pending").withOptions({ clearOnDefault: true }),
  );
  const [typeValue, setType] = useQueryState(
    "type",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const [businessNatureValue, setBusinessNature] = useQueryState(
    "nature",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const [district, setDistrict] = useQueryState(
    "district",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const [referralValue, setReferral] = useQueryState(
    "referral",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  );
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
  );
  const status = statusValue as StatusFilter;
  const type = typeValue as TypeFilter;
  const businessNature = businessNatureValue as BusinessNatureFilter;
  const referral = referralValue as ReferralFilter;

  const overviewInput = useMemo(
    () => ({
      search: search.trim() || undefined,
      type,
      businessNature,
      referral,
      district: district !== "all" ? district : undefined,
    }),
    [search, type, businessNature, referral, district],
  );

  const { data: overview } = useQuery({
    ...orpc.adminApplication.getOverview.queryOptions({
      input: overviewInput,
    }),
  });

  const { data: filterOptions } = useQuery({
    ...orpc.adminApplication.getFilterOptions.queryOptions(),
  });

  const listInput = useMemo(
    () => ({
      ...overviewInput,
      status,
      page,
      limit: PAGE_SIZE,
    }),
    [overviewInput, status, page],
  );

  const {
    data: listData,
    isLoading,
    isError,
  } = useQuery({
    ...orpc.adminApplication.list.queryOptions({ input: listInput }),
  });

  const items = (listData?.items ?? []) as ApplicationRow[];
  const totalCount = listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const showFrom = totalCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(page * PAGE_SIZE, totalCount);

  const table = useReactTable({
    data: items,
    columns: applicationColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  const selectStatus = (next: StatusFilter) => {
    void setStatus(next);
    void setPage(1);
  };

  const counts: Record<StatusFilter, number> = {
    all: overview?.total ?? 0,
    pending: overview?.pending ?? 0,
    approved: overview?.approved ?? 0,
    rejected: overview?.rejected ?? 0,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Approval &amp; Verification
            </h1>
            {(overview?.pending ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {overview?.pending} awaiting review
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Onboarding and verification workflow for Shop Owner and Warehouse
            Owner requests
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <header className="border-b bg-muted/30 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            Application Performance
          </h2>
        </header>
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {KPI_BLOCKS.map((block) => {
            const isActive = status === block.key;

            return (
              <button
                key={block.key}
                type="button"
                onClick={() => selectStatus(block.key)}
                className={cn(
                  "flex min-h-[76px] flex-col items-start justify-center bg-background px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  isActive && "bg-primary/5 hover:bg-primary/5",
                )}
              >
                <span className="text-xs text-muted-foreground">
                  {block.label}
                </span>
                <span
                  className={cn(
                    "mt-0.5 font-mono text-xl font-semibold tabular-nums text-foreground",
                    isActive && "text-primary",
                  )}
                >
                  {counts[block.key].toLocaleString()}
                </span>
                {block.key === "pending" && overview && (
                  <span className="mt-0.5 text-[11px] text-muted-foreground">
                    Shop Owner {overview.pendingShopOwner} · Warehouse Owner{" "}
                    {overview.pendingWarehouseOwner}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                void setSearch(e.target.value);
                void setPage(1);
              }}
              placeholder="Name / Phone / Request ID..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => selectStatus(v as StatusFilter)}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={type}
            onValueChange={(v) => {
              void setType(v);
              void setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="seller">Shop Owner</SelectItem>
              <SelectItem value="warehouse">Warehouse Owner</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={businessNature}
            onValueChange={(v) => {
              void setBusinessNature(v);
              void setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Business Nature" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Business Natures</SelectItem>
              {(filterOptions?.businessNatures ?? []).map((nature) => (
                <SelectItem key={nature} value={nature}>
                  {formatBusinessNature(nature)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={district}
            onValueChange={(v) => {
              void setDistrict(v);
              void setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {(filterOptions?.districts ?? []).map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={referral}
            onValueChange={(v) => {
              void setReferral(v);
              void setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Referral" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Referral</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="invited">Invited</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-5 w-20 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <h2 className="mt-3 font-semibold">Failed to load requests</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try refreshing or adjusting your filters.
              </p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <h2 className="mt-3 font-semibold">No requests found</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Requests matching your current filters will appear here.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="bg-muted/30 hover:bg-muted/30"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="px-4 text-xs font-semibold uppercase tracking-wider"
                    >
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
                    <TableCell key={cell.id} className="px-4 py-3">
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

        {!isLoading && !isError && totalCount > 0 && (
          <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {showFrom}–{showTo} of {totalCount} requests
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => void setPage(1)}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => void setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {generatePageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span
                    key={`dot-${i}`}
                    className="px-1 text-xs text-muted-foreground"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => void setPage(p as number)}
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
                onClick={() => void setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => void setPage(totalPages)}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
