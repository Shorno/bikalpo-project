"use client";

import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertCircle,
  ClipboardList,
  Inbox,
  Search,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
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
import { AssignRiderModal } from "../assignments/_components/assign-rider-modal";
import { getRiderAssignmentColumns } from "./_components/assignment-rider-columns";
import { RiderAssignmentDrawer } from "./_components/rider-assignment-drawer";
import {
  type PendingGroupOption,
  type RiderOverviewRow,
  type RiderStatusFilter,
} from "./_components/rider-assignment-utils";

const WH = "/warehouse/dashboard";

type RiderKpiKey = "all" | "active" | "unassigned";

const kpiConfig: {
  key: RiderKpiKey;
  statusFilter: RiderStatusFilter | null;
  label: string;
  emoji: string;
  icon: ElementType;
  tone: DashboardKpiTone;
  description: string;
  href?: string;
}[] = [
  {
    key: "all",
    statusFilter: "all",
    label: "Total Riders",
    emoji: "👥",
    icon: Users,
    tone: "slate",
    description: "Active delivery riders on your team",
  },
  {
    key: "active",
    statusFilter: "active",
    label: "Riders Assigned",
    emoji: "🚚",
    icon: UserCheck,
    tone: "violet",
    description: "Riders with an active delivery group",
  },
  {
    key: "unassigned",
    statusFilter: null,
    label: "Unassigned Groups",
    emoji: "🟡",
    icon: ClipboardList,
    tone: "amber",
    description: "Groups waiting for a rider",
    href: `${WH}/delivery-team/assignments`,
  },
];

const statusTabs: { value: RiderStatusFilter; label: string }[] = [
  { value: "all", label: "All Riders" },
  { value: "active", label: "Active" },
  { value: "idle", label: "Idle" },
];

export default function DeliveryTeamRiderAssignmentPage() {
  const [status, setStatus] = useState<RiderStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [area, setArea] = useState("all");
  const [viewRider, setViewRider] = useState<RiderOverviewRow | null>(null);
  const [assignRider, setAssignRider] = useState<RiderOverviewRow | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [search]);

  const listQuery = useQuery({
    ...orpc.warehouse.getDeliveryTeamRidersOverview.queryOptions({
      input: {
        search: debouncedSearch || undefined,
        status,
        area: area === "all" ? undefined : area,
      },
    }),
  });

  const riders = (listQuery.data?.riders ?? []) as RiderOverviewRow[];
  const kpis = listQuery.data?.kpis ?? {
    totalRiders: 0,
    ridersAssigned: 0,
    unassignedGroups: 0,
  };
  const areaOptions = listQuery.data?.areaOptions ?? [];
  const pendingGroups = (listQuery.data?.pendingGroups ??
    []) as PendingGroupOption[];

  const openAssign = useCallback((rider: RiderOverviewRow) => {
    setAssignRider(rider);
    setViewRider(null);
  }, []);

  const columns = useMemo(
    () =>
      getRiderAssignmentColumns({
        onView: setViewRider,
        onAssign: openAssign,
      }),
    [openAssign],
  );

  const table = useReactTable({
    data: riders,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const kpiCounts: Record<RiderKpiKey, number> = {
    all: kpis.totalRiders,
    active: kpis.ridersAssigned,
    unassigned: kpis.unassignedGroups,
  };

  const handleKpiClick = (key: RiderKpiKey) => {
    const cfg = kpiConfig.find((item) => item.key === key);
    if (cfg?.href) {
      window.location.href = cfg.href;
      return;
    }
    if (cfg?.statusFilter) {
      setStatus(cfg.statusFilter);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Rider Assignment
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            See rider workload, idle capacity, and assign pending groups
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${WH}/delivery-team/assignments`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ClipboardList className="h-4 w-4" />
            Assign Orders
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

      <DashboardKpiGrid className="sm:grid-cols-2 xl:grid-cols-3">
        {kpiConfig.map((cfg) => {
          const Icon = cfg.icon;
          const active =
            cfg.key === "unassigned"
              ? false
              : status === cfg.statusFilter;
          return (
            <DashboardKpiCard
              key={cfg.key}
              active={active}
              description={cfg.description}
              footer={{
                label: cfg.key === "unassigned" ? "Groups" : "Riders",
                value: kpiCounts[cfg.key].toLocaleString(),
              }}
              icon={<Icon className="h-6 w-6" />}
              label={cfg.label}
              onClick={() => handleKpiClick(cfg.key)}
              tone={cfg.tone}
              value={kpiCounts[cfg.key].toLocaleString()}
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
              placeholder="Rider / Phone / Area..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <Select value={area} onValueChange={setArea}>
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
        </div>

        <div className="flex items-center gap-1 border-b px-4 py-2">
          {statusTabs.map((tab) => {
            const active = status === tab.value;
            const count =
              tab.value === "all"
                ? kpis.totalRiders
                : tab.value === "active"
                  ? kpis.ridersAssigned
                  : Math.max(0, kpis.totalRiders - kpis.ridersAssigned);
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
                <Badge
                  variant={active ? "secondary" : "outline"}
                  className="h-5 min-w-5 justify-center px-1.5 text-[10px]"
                >
                  {count}
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
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : listQuery.isError ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <p className="mt-3 text-sm font-medium">Failed to load riders</p>
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
        ) : riders.length === 0 ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No riders match filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add delivery riders on the Delivery Team page first.
              </p>
              <Link
                href={`${WH}/delivery-team`}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-2"
              >
                <Truck className="h-3.5 w-3.5" />
                Go to Delivery Team
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

        <div className="border-t px-4 py-3 text-sm text-muted-foreground">
          Showing {riders.length} rider{riders.length === 1 ? "" : "s"}
        </div>
      </div>

      <RiderAssignmentDrawer
        rider={viewRider}
        open={viewRider !== null}
        onOpenChange={(open) => {
          if (!open) setViewRider(null);
        }}
        onAssign={(rider) => {
          setViewRider(null);
          setAssignRider(rider);
        }}
      />

      <AssignRiderModal
        open={assignRider !== null}
        onOpenChange={(open) => {
          if (!open) setAssignRider(null);
        }}
        preselectedRiderId={assignRider?.id}
        preselectedRiderName={assignRider?.name}
        pendingGroups={pendingGroups}
        onSuccess={() => {
          setAssignRider(null);
          void listQuery.refetch();
        }}
      />
    </div>
  );
}
