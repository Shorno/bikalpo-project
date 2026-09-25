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
  RotateCcw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { BUSINESS_NATURES } from "@/constants/seller-registration";
import { ADMIN_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";
import type { UserRow } from "./user-columns";
import { retailerColumns, wholesalerColumns } from "./user-columns";
import {
  type UsersKpiKey,
  UsersPerformancePanel,
} from "./users-performance-panel";
import { WholesalerPerformancePanel } from "./wholesaler-performance-panel";

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
  const isWholesaler = role === "warehouse";
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

  const statsQuery = useQuery({
    ...orpc.adminUserManagement.getStats.queryOptions({
      input: overviewFilters,
    }),
  });

  const { data: trendData, isLoading: isTrendLoading } = useQuery({
    ...orpc.adminUserManagement.getGrowthTrend.queryOptions({
      input: { ...overviewFilters, days: TREND_DAYS },
    }),
    enabled: !isWholesaler,
  });

  const registrationQuery = useQuery({
    ...orpc.adminUserManagement.getRegistrationTrend.queryOptions({
      input: overviewFilters,
    }),
    enabled: isWholesaler,
  });

  const applicationType = role === "shop_owner" ? "seller" : "warehouse";
  const applicationsQuery = useQuery({
    ...orpc.adminApplication.getOverview.queryOptions({
      input: {
        type: applicationType,
        businessNature: isWholesaler ? businessNature : "all",
        district: isWholesaler ? overviewFilters.district : undefined,
        search: isWholesaler ? overviewFilters.search : undefined,
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

  const stats = statsQuery.data?.stats;
  const activeKpis = deriveActiveKpis(status, kyc);
  const pendingApplications = applicationsQuery.data?.pending ?? 0;
  const applicationParams = new URLSearchParams({
    status: "pending",
    type: applicationType,
  });
  if (isWholesaler) {
    if (businessNature !== "all")
      applicationParams.set("nature", businessNature);
    if (overviewFilters.district)
      applicationParams.set("district", overviewFilters.district);
    if (overviewFilters.search)
      applicationParams.set("q", overviewFilters.search);
  }
  const pendingApplicationsHref = `${ADMIN_BASE}/user-overview/approval?${applicationParams}`;

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

  const filters = (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 px-4 py-3",
        isWholesaler
          ? "gap-3 rounded-xl border bg-card p-4 sm:p-6"
          : "border-b bg-muted/30",
      )}
    >
      <div
        className={cn(
          "relative",
          isWholesaler ? "w-full" : "min-w-[200px] flex-1 sm:max-w-sm",
        )}
      >
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Search users by name, ID or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ID or phone..."
          className="h-9 w-full bg-background pl-9"
        />
      </div>
      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as StatusFilter);
          setPage(1);
        }}
      >
        <SelectTrigger
          aria-label="Account status"
          className={cn("h-9", isWholesaler ? "w-full sm:w-36" : "w-[130px]")}
        >
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
        <SelectTrigger
          aria-label={isWholesaler ? "Business type" : "Business nature"}
          className={cn("h-9", isWholesaler ? "w-full sm:w-48" : "w-[180px]")}
        >
          <SelectValue
            placeholder={isWholesaler ? "Business Type" : "Business Nature"}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            {isWholesaler ? "All Business Types" : "All Business Natures"}
          </SelectItem>
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
        <SelectTrigger
          aria-label="Location"
          className={cn("h-9", isWholesaler ? "w-full sm:w-40" : "w-[140px]")}
        >
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
      {!isWholesaler && (
        <Select
          value={kyc}
          onValueChange={(v) => {
            setKyc(v as KycFilter);
            setPage(1);
          }}
        >
          <SelectTrigger aria-label="KYC status" className="h-9 w-[130px]">
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
      )}
      {isWholesaler && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-full gap-2 sm:ml-auto sm:w-auto"
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setSearch("");
            setDebouncedSearch("");
            setStatus("all");
            setKyc("all");
            setBusinessNature("all");
            setDistrict("all");
            setPage(1);
          }}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Reset Filter
        </Button>
      )}
    </div>
  );

  const performanceError =
    statsQuery.isError ||
    registrationQuery.isError ||
    applicationsQuery.isError;
  const performanceFetching =
    statsQuery.isFetching ||
    registrationQuery.isFetching ||
    applicationsQuery.isFetching;

  return (
    <div className="min-w-0 space-y-6">
      {isWholesaler ? (
        <>
          <h1 className="sr-only">{title}</h1>
          {filters}
          <section
            aria-labelledby="wholesaler-summary-heading"
            className="space-y-3"
          >
            <h2
              id="wholesaler-summary-heading"
              className="text-sm font-semibold tracking-tight"
            >
              Quick Summary
            </h2>
            {performanceError && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
              >
                <p>
                  Could not load all performance data. Previously loaded values
                  may be out of date.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={performanceFetching}
                  onClick={() => {
                    void statsQuery.refetch();
                    void registrationQuery.refetch();
                    void applicationsQuery.refetch();
                  }}
                >
                  Retry
                </Button>
              </div>
            )}
            <WholesalerPerformancePanel
              stats={stats}
              trend={registrationQuery.data}
              loading={
                statsQuery.isLoading ||
                registrationQuery.isLoading ||
                applicationsQuery.isLoading
              }
              activeKpis={activeKpis}
              pendingApplications={applicationsQuery.data?.pending}
              pendingApplicationsHref={pendingApplicationsHref}
              onSelectKpi={selectKpi}
            />
          </section>
        </>
      ) : (
        <>
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
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
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
        </>
      )}

      <section
        aria-label={isWholesaler ? "Wholesaler User List" : title}
        className="space-y-3"
      >
        {isWholesaler && (
          <h2 className="text-sm font-semibold tracking-tight">
            Wholesaler User List
          </h2>
        )}
        <div className="overflow-hidden rounded-xl border bg-background">
          {!isWholesaler && filters}

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
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  aria-label="First page"
                  onClick={() => setPage(1)}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  aria-label="Previous page"
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
                      aria-label={`Page ${p}`}
                      aria-current={p === page ? "page" : undefined}
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
                  aria-label="Next page"
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages}
                  aria-label="Last page"
                  onClick={() => setPage(totalPages)}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export { retailerColumns, wholesalerColumns };
