"use client";

import { useQuery } from "@tanstack/react-query";
import {
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
  ClipboardList,
  Clock,
  Inbox,
  Search,
  Truck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ElementType, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getAssignmentColumns } from "./_components/assignment-columns";
import {
  type AssignmentGroupRow,
  type AssignmentKpiFilter,
  buildAssignmentGroupRowFromDetail,
} from "./_components/assignment-utils";
import { AssignRiderModal } from "./_components/assign-rider-modal";
import { GroupDetailDrawer } from "./_components/group-detail-drawer";

const PER_PAGE = 20;
const WH = "/warehouse/dashboard";

type DateFilter = "all" | "today" | "this_month";

const kpiConfig: {
  key: AssignmentKpiFilter;
  label: string;
  emoji: string;
  icon: ElementType;
  tone: DashboardKpiTone;
  description: string;
}[] = [
  {
    key: "all",
    label: "Total Groups",
    emoji: "📋",
    icon: ClipboardList,
    tone: "slate",
    description: "All internal delivery groups",
  },
  {
    key: "pending_assignment",
    label: "Pending Assignment",
    emoji: "🟡",
    icon: Clock,
    tone: "amber",
    description: "Groups waiting for a rider",
  },
  {
    key: "assigned",
    label: "Assigned",
    emoji: "🚚",
    icon: Truck,
    tone: "violet",
    description: "Rider assigned or on route",
  },
  {
    key: "completed",
    label: "Completed",
    emoji: "✅",
    icon: CheckCircle2,
    tone: "emerald",
    description: "Finished delivery groups",
  },
];

const dateOptions = [
  { value: "all", label: "All Dates" },
  { value: "today", label: "Today" },
  { value: "this_month", label: "This Month" },
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

export default function DeliveryTeamAssignmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupIdParam = searchParams.get("group");
  const deepLinkGroupId = groupIdParam
    ? Number.parseInt(groupIdParam, 10)
    : null;
  const openedDeepLinkRef = useRef<number | null>(null);

  const [kpi, setKpi] = useState<AssignmentKpiFilter>("pending_assignment");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [area, setArea] = useState("all");
  const [dateRange, setDateRange] = useState<DateFilter>("all");
  const [viewGroup, setViewGroup] = useState<AssignmentGroupRow | null>(null);
  const [assignGroup, setAssignGroup] = useState<AssignmentGroupRow | null>(null);

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
    ...orpc.warehouse.getDeliveryTeamAssignments.queryOptions({
      input: {
        search: debouncedSearch || undefined,
        kpi,
        area: area === "all" ? undefined : area,
        dateRange,
        page,
        limit: PER_PAGE,
      },
    }),
  });

  const deepLinkQuery = useQuery({
    ...orpc.deliveryman.getGroupById.queryOptions({
      input: { id: deepLinkGroupId ?? 0 },
    }),
    enabled: !!deepLinkGroupId && !Number.isNaN(deepLinkGroupId),
  });

  const clearGroupDeepLink = useCallback(() => {
    if (!searchParams.get("group")) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("group");
    const query = next.toString();
    router.replace(
      query
        ? `${WH}/delivery-team/assignments?${query}`
        : `${WH}/delivery-team/assignments`,
      { scroll: false },
    );
  }, [router, searchParams]);

  useEffect(() => {
    if (!groupIdParam) {
      openedDeepLinkRef.current = null;
    }
  }, [groupIdParam]);

  useEffect(() => {
    const group = deepLinkQuery.data?.group;
    if (!group || !deepLinkGroupId || Number.isNaN(deepLinkGroupId)) return;
    if (openedDeepLinkRef.current === group.id) return;

    openedDeepLinkRef.current = group.id;
    const row = buildAssignmentGroupRowFromDetail(group);
    setViewGroup(row);
    if (row.kpiBucket !== "all") {
      setKpi(row.kpiBucket as AssignmentKpiFilter);
    }
  }, [deepLinkQuery.data, deepLinkGroupId]);

  const groups = (listQuery.data?.groups ?? []) as AssignmentGroupRow[];
  const kpis = listQuery.data?.kpis ?? {
    total: 0,
    pendingAssignment: 0,
    assigned: 0,
    completed: 0,
  };
  const areaOptions = listQuery.data?.areaOptions ?? [];
  const pagination = listQuery.data?.pagination ?? {
    page: 1,
    limit: PER_PAGE,
    total: 0,
    totalPages: 1,
  };

  const selectKpi = (next: AssignmentKpiFilter) => {
    setKpi(next);
    setPage(1);
  };

  const openAssign = useCallback((group: AssignmentGroupRow) => {
    setAssignGroup(group);
    setViewGroup(null);
  }, []);

  const columns = useMemo(
    () =>
      getAssignmentColumns({
        onView: setViewGroup,
        onAssign: openAssign,
      }),
    [openAssign],
  );

  const table = useReactTable({
    data: groups,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    manualPagination: true,
    pageCount: pagination.totalPages,
  });

  const counts: Record<AssignmentKpiFilter, number> = {
    all: kpis.total,
    pending_assignment: kpis.pendingAssignment,
    assigned: kpis.assigned,
    completed: kpis.completed,
  };

  const showFrom =
    pagination.total > 0 ? (pagination.page - 1) * PER_PAGE + 1 : 0;
  const showTo = Math.min(pagination.page * PER_PAGE, pagination.total);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assign Orders</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Assign riders to internal delivery groups from Delivery Management
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${WH}/delivery-team/assignment`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Users className="h-4 w-4" />
            Rider Assignment
          </Link>
          <Link
            href={`${WH}/delivery-management`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ClipboardList className="h-4 w-4" />
            Delivery Management
          </Link>
          <Link
            href={`${WH}/delivery-team`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Users className="h-4 w-4" />
            Delivery Team
          </Link>
        </div>
      </div>

      <DashboardKpiGrid className="sm:grid-cols-2 xl:grid-cols-4">
        {kpiConfig.map((cfg) => {
          const Icon = cfg.icon;
          return (
            <DashboardKpiCard
              key={cfg.key}
              active={kpi === cfg.key}
              description={cfg.description}
              footer={{ label: "Groups", value: counts[cfg.key].toLocaleString() }}
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
              placeholder="Group / Rider / Area..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <Select
            value={area}
            onValueChange={(value) => {
              setArea(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="All areas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Areas</SelectItem>
              {areaOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
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

        {listQuery.isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3.5">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
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
              <p className="mt-3 text-sm font-medium">Failed to load groups</p>
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
        ) : groups.length === 0 ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No delivery groups</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an internal group in Delivery Management first.
              </p>
              <Link
                href={`${WH}/delivery-management`}
                className="mt-3 inline-flex text-sm font-medium underline underline-offset-2"
              >
                Go to Delivery Management
              </Link>
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

      <GroupDetailDrawer
        group={viewGroup}
        open={viewGroup !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewGroup(null);
            clearGroupDeepLink();
          }
        }}
        onAssign={(group) => {
          setViewGroup(null);
          setAssignGroup(group);
        }}
      />

      <AssignRiderModal
        open={assignGroup !== null}
        onOpenChange={(open) => {
          if (!open) setAssignGroup(null);
        }}
        groupId={assignGroup?.id ?? 0}
        groupName={assignGroup?.groupName}
        orderShippingArea={assignGroup?.areaLabel !== "—" ? assignGroup?.areaLabel : undefined}
        onSuccess={() => {
          setAssignGroup(null);
          void listQuery.refetch();
        }}
      />
    </div>
  );
}
