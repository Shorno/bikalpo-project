"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
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
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";
import type { UserRow } from "./user-columns";
import { retailerColumns, wholesalerColumns } from "./user-columns";
import {
  type UsersKpiKey,
  UsersPerformancePanel,
} from "./users-performance-panel";

type StatusFilter = "all" | "active" | "pending" | "suspended";
type KycFilter = "all" | "verified" | "unverified" | "pending" | "failed";
type BusinessNatureFilter =
  | "all"
  | "unspecified"
  | (typeof BUSINESS_NATURES)[number]["id"];

const PAGE_SIZE = 20;
const TREND_DAYS = 30;

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

function deriveActiveKpis(status: StatusFilter, kyc: KycFilter): UsersKpiKey[] {
  const active: UsersKpiKey[] = [];
  if (status === "all") active.push("total");
  if (status === "active") active.push("active");
  if (status === "suspended") active.push("suspended");
  if (kyc === "verified") active.push("verifiedKyc");
  return active;
}

function formatBusinessNature(value: string) {
  if (value === "unspecified") return "Unspecified (legacy)";
  return BUSINESS_NATURES.find((nature) => nature.id === value)?.label ?? value;
}

interface UsersListClientProps {
  portalRole: "warehouse" | "shop_owner";
  title: string;
  description: string;
  columns: ColumnDef<UserRow>[];
  emptyLabel: string;
}

export function UsersListClient({
  portalRole,
  title,
  description,
  columns,
  emptyLabel,
}: UsersListClientProps) {
  const role = portalRole;
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kyc, setKyc] = useState<KycFilter>("all");
  const [businessNature, setBusinessNature] =
    useState<BusinessNatureFilter>("all");
  const [district, setDistrict] = useState("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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

  const overviewFilters = useMemo(
    () => ({
      role,
      status,
      kyc,
      businessNature,
      district: district !== "all" ? district : undefined,
      search: debouncedSearch || undefined,
    }),
    [role, status, kyc, businessNature, district, debouncedSearch],
  );

  const { data: statsData } = useQuery({
    ...orpc.adminUserManagement.getStats.queryOptions({
      input: overviewFilters,
    }),
  });

  const { data: trendData, isLoading: isTrendLoading } = useQuery({
    ...orpc.adminUserManagement.getGrowthTrend.queryOptions({
      input: { ...overviewFilters, days: TREND_DAYS },
    }),
  });

  const applicationType = role === "shop_owner" ? "seller" : "warehouse";
  const { data: applicationOverview } = useQuery({
    ...orpc.adminApplication.getOverview.queryOptions({
      input: {
        type: applicationType,
        businessNature: "all",
        referral: "all",
      },
    }),
  });

  const { data: filterOptions } = useQuery({
    ...orpc.adminUserManagement.getFilterOptions.queryOptions({
      input: { role },
    }),
  });

  const listInput = useMemo(
    () => ({
      ...overviewFilters,
      page,
      pageSize: PAGE_SIZE,
    }),
    [overviewFilters, page],
  );

  const {
    data: listData,
    isLoading,
    isError,
  } = useQuery({
    ...orpc.adminUserManagement.list.queryOptions({ input: listInput }),
  });

  const items = (listData?.users ?? []) as UserRow[];
  const totalCount = listData?.pagination?.totalCount ?? 0;
  const totalPages = Math.max(1, listData?.pagination?.totalPages ?? 1);
  const showFrom = totalCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(page * PAGE_SIZE, totalCount);

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });

  const stats = statsData?.stats;
  const activeKpis = deriveActiveKpis(status, kyc);
  const pendingApplications = applicationOverview?.pending ?? 0;
  const pendingApplicationsHref = `${ADMIN_BASE}/user-overview/approval?status=pending&type=${applicationType}`;

  const selectKpi = (key: UsersKpiKey) => {
    setPage(1);
    switch (key) {
      case "active":
        setStatus("active");
        break;
      case "suspended":
        setStatus("suspended");
        break;
      case "verifiedKyc":
        setKyc("verified");
        break;
      default:
        setStatus("all");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {pendingApplications > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {pendingApplications} pending review
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>

      <UsersPerformancePanel
        stats={stats}
        trend={trendData}
        isTrendLoading={isTrendLoading}
        activeKpis={activeKpis}
        pendingApplications={pendingApplications}
        pendingApplicationsHref={pendingApplicationsHref}
        onSelectKpi={selectKpi}
      />

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
          <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name / ID / Phone..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as StatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={businessNature}
            onValueChange={(v) => {
              setBusinessNature(v as BusinessNatureFilter);
              setPage(1);
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
              setDistrict(v);
              setPage(1);
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
            value={kyc}
            onValueChange={(v) => {
              setKyc(v as KycFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="KYC" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All KYC</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="unverified">Unverified</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
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
              <h2 className="mt-3 font-semibold">Failed to load users</h2>
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
              <h2 className="mt-3 font-semibold">No users found</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {emptyLabel}
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
              Showing {showFrom}–{showTo} of {totalCount} users
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
                    …
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
    </div>
  );
}

export { retailerColumns, wholesalerColumns };
