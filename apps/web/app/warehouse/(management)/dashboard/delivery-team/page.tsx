"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Inbox,
  Loader2,
  Search,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { type ElementType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CreateWarehouseEmployeeModal } from "@/components/features/warehouse/create-warehouse-employee-modal";
import {
  DashboardKpiCard,
  DashboardKpiGrid,
  type DashboardKpiTone,
} from "@/components/dashboard/dashboard-kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { getDeliveryTeamColumns } from "./_components/delivery-team-columns";
import {
  type DeliverymanRow,
  type DeliverymanStatusFilter,
  filterDeliverymen,
  generatePassword,
  getStatusTabCounts,
} from "./_components/delivery-team-utils";

const WH = "/warehouse/dashboard";
const PER_PAGE = 20;

type TeamKpiKey = "all" | "active" | "deliveries";

const kpiConfig: {
  key: TeamKpiKey;
  statusFilter: DeliverymanStatusFilter | null;
  label: string;
  icon: ElementType;
  tone: DashboardKpiTone;
  description: string;
}[] = [
  {
    key: "all",
    statusFilter: "all",
    label: "Total Riders",
    icon: Users,
    tone: "slate",
    description: "All delivery riders on your team",
  },
  {
    key: "active",
    statusFilter: "active",
    label: "Active",
    icon: UserCheck,
    tone: "emerald",
    description: "Riders with active accounts",
  },
  {
    key: "deliveries",
    statusFilter: null,
    label: "Total Deliveries",
    icon: Truck,
    tone: "violet",
    description: "Completed delivery groups across the team",
  },
];

const statusTabs: { value: DeliverymanStatusFilter; label: string }[] = [
  { value: "all", label: "All Riders" },
  { value: "active", label: "Active" },
  { value: "banned", label: "Banned" },
];

export default function DeliveryTeamPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<DeliverymanStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [search]);

  const listQuery = useQuery(
    orpc.warehouseEmployee.getDeliverymen.queryOptions({ input: {} }),
  );

  const deliverymen = (listQuery.data?.deliverymen ?? []) as DeliverymanRow[];
  const stats = listQuery.data?.stats ?? {
    total: 0,
    activeCount: 0,
    totalDeliveries: 0,
  };

  const banMutation = useMutation({
    ...orpc.warehouseEmployee.toggleBan.mutationOptions(),
    onSuccess: (result) => {
      toast.success(result.message);
      void queryClient.invalidateQueries({
        queryKey: orpc.warehouseEmployee.key(),
      });
    },
    onError: (error) => toast.error(error.message || "Failed to update status"),
  });

  const deleteMutation = useMutation({
    ...orpc.warehouseEmployee.delete.mutationOptions(),
    onSuccess: (result) => {
      toast.success(result.message);
      void queryClient.invalidateQueries({
        queryKey: orpc.warehouseEmployee.key(),
      });
    },
    onError: (error) => toast.error(error.message || "Failed to delete"),
  });

  const resetPasswordMutation = useMutation({
    ...orpc.warehouseEmployee.resetPassword.mutationOptions(),
    onSuccess: (result) => {
      toast.success(result.message);
      setResetPasswordDialog(null);
      setNewPassword("");
    },
    onError: (error) =>
      toast.error(error.message || "Failed to reset password"),
  });

  const openResetPassword = useCallback((rider: DeliverymanRow) => {
    setNewPassword(generatePassword());
    setResetPasswordDialog({ userId: rider.id, name: rider.name });
  }, []);

  const columns = useMemo(
    () =>
      getDeliveryTeamColumns({
        onResetPassword: openResetPassword,
        onToggleBan: (rider) =>
          banMutation.mutate({ userId: rider.id, banned: !rider.banned }),
        onDelete: (id) => deleteMutation.mutate({ id }),
        isDeleting: deleteMutation.isPending,
      }),
    [banMutation, deleteMutation, openResetPassword],
  );

  const filteredRiders = useMemo(
    () =>
      filterDeliverymen(deliverymen, {
        search: debouncedSearch,
        status,
      }),
    [deliverymen, debouncedSearch, status],
  );

  const tabCounts = useMemo(
    () => getStatusTabCounts(deliverymen),
    [deliverymen],
  );

  const table = useReactTable({
    data: filteredRiders,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: {
      pagination: { pageSize: PER_PAGE },
    },
  });

  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const showFrom =
    filteredRiders.length > 0 ? pageIndex * PER_PAGE + 1 : 0;
  const showTo = Math.min((pageIndex + 1) * PER_PAGE, filteredRiders.length);

  const kpiCounts: Record<TeamKpiKey, number> = {
    all: stats.total,
    active: stats.activeCount,
    deliveries: stats.totalDeliveries,
  };

  const handleKpiClick = (key: TeamKpiKey) => {
    const cfg = kpiConfig.find((item) => item.key === key);
    if (cfg?.statusFilter) {
      setStatus(cfg.statusFilter);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Delivery Team</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage delivery riders and employee accounts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${WH}/delivery-team/assignment`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <UserCheck className="h-4 w-4" />
            Rider Assignment
          </Link>
          <Link
            href={`${WH}/delivery-team/assignments`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <ClipboardList className="h-4 w-4" />
            Assign Orders
          </Link>
        </div>
      </div>

      <DashboardKpiGrid className="sm:grid-cols-2 xl:grid-cols-3">
        {kpiConfig.map((cfg) => {
          const Icon = cfg.icon;
          const active =
            cfg.key === "deliveries" ? false : status === cfg.statusFilter;
          return (
            <DashboardKpiCard
              key={cfg.key}
              active={active}
              description={cfg.description}
              footer={{
                label: cfg.key === "deliveries" ? "Deliveries" : "Riders",
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
              placeholder="Name / email / phone..."
              className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <CreateWarehouseEmployeeModal defaultRole="deliveryman" />
        </div>

        <div className="flex items-center gap-1 border-b px-4 py-2">
          {statusTabs.map((tab) => {
            const active = status === tab.value;
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
                  {tabCounts[tab.value]}
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
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
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
              <p className="mt-3 text-sm font-medium">Failed to load delivery team</p>
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
        ) : filteredRiders.length === 0 ? (
          <div className="grid min-h-[320px] place-items-center text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-medium">No riders found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {deliverymen.length === 0
                  ? "Add your first delivery rider to get started."
                  : "Try adjusting your search or status filter."}
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

        {!listQuery.isLoading && !listQuery.isError && filteredRiders.length > 0 ? (
          <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {showFrom}–{showTo} of {filteredRiders.length}
            </p>
            {pageCount > 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {pageIndex + 1} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog
        open={!!resetPasswordDialog}
        onOpenChange={(open) => {
          if (!open) {
            setResetPasswordDialog(null);
            setNewPassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetPasswordDialog?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResetPasswordDialog(null);
                setNewPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (resetPasswordDialog && newPassword.length >= 8) {
                  resetPasswordMutation.mutate({
                    userId: resetPasswordDialog.userId,
                    newPassword,
                  });
                } else {
                  toast.error("Password must be at least 8 characters");
                }
              }}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
