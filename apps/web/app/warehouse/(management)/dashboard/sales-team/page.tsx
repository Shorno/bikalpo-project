"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Ban,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  KeyRound,
  Loader2,
  type LucideIcon,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CreateWarehouseEmployeeModal } from "@/components/features/warehouse/create-warehouse-employee-modal";
import TableSkeleton from "@/components/table-skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

interface AssignedArea {
  id: number;
  name: string;
  status: "active" | "inactive" | string;
}

type CustomerType = "retailer" | "warehouse";

interface Salesman {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  createdAt: Date;
  banned: boolean;
  estimatesCount: number;
  assignedCustomersCount: number;
  assignedArea: AssignedArea | null;
}

interface AssignedCustomer {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  shopName: string | null;
  warehouseName: string | null;
  customerType: CustomerType;
  displayName: string;
  assignedAt: Date;
}

interface SalesmanDetail extends Salesman {
  assignedCustomers: AssignedCustomer[];
}

interface AssignableCustomer {
  id: string;
  customerType: CustomerType;
  connectionId: number;
  displayName: string;
  contactName: string;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  connectedAt: Date | null;
  assignedSalesmanId: string | null;
  assignedSalesmanName: string | null;
  isAssigned: boolean;
  isAssignedToThisSalesman: boolean;
  isAssignable: boolean;
}

interface DeliveryAreaOption {
  id: number;
  name: string;
  status: "active" | "inactive" | string;
}

interface SalesmenStats {
  total: number;
  totalEstimates: number;
  activeCount: number;
  assignedSalesmen: number;
  assignedCustomers: number;
}

function getStatusBadge(banned: boolean) {
  if (banned) {
    return (
      <Badge variant="destructive" className="text-xs">
        Inactive
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-green-600 text-xs text-green-600"
    >
      Active
    </Badge>
  );
}

function getAreaBadge(area: AssignedArea | null) {
  if (!area) {
    return (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        Not Assigned
      </Badge>
    );
  }

  return (
    <Badge
      variant={area.status === "active" ? "secondary" : "outline"}
      className="max-w-36 truncate text-xs"
      title={area.name}
    >
      <MapPin className="mr-1 h-3 w-3 shrink-0" />
      {area.name}
    </Badge>
  );
}

function CustomerTypeBadge({ type }: { type: CustomerType }) {
  const isWarehouse = type === "warehouse";
  const Icon = isWarehouse ? Building2 : Store;

  return (
    <Badge variant="outline" className="gap-1 text-[11px]">
      <Icon className="h-3 w-3" />
      {isWarehouse ? "Warehouse" : "Retailer"}
    </Badge>
  );
}

function generatePassword(length = 10): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <Card className="p-0">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function SalesmanDetailsSheet({
  salesman,
  open,
  onOpenChange,
  areas,
  areasLoading,
}: {
  salesman: Salesman | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: DeliveryAreaOption[];
  areasLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const [selectedAreaId, setSelectedAreaId] = useState<string | undefined>();
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    ...orpc.warehouseEmployee.getSalesmanById.queryOptions({
      input: { id: salesman?.id ?? "" },
    }),
    enabled: open && !!salesman?.id,
  });

  const {
    data: assignableCustomersData,
    isLoading: assignableCustomersLoading,
    isFetching: assignableCustomersFetching,
  } = useQuery({
    ...orpc.warehouseEmployee.getAssignableSalesmanCustomers.queryOptions({
      input: {
        salesmanId: salesman?.id ?? "",
        search: debouncedCustomerSearch || undefined,
      },
    }),
    enabled: open && !!salesman?.id,
  });

  const detail = (data?.salesman ?? salesman) as SalesmanDetail | null;
  const assignedCustomers = detail?.assignedCustomers ?? [];
  const assignableCustomers = (assignableCustomersData?.customers ??
    []) as AssignableCustomer[];
  const currentAreaId = detail?.assignedArea?.id;
  const selectedCustomerIdSet = useMemo(
    () => new Set(selectedCustomerIds),
    [selectedCustomerIds],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedAreaId(currentAreaId ? String(currentAreaId) : undefined);
  }, [currentAreaId, open]);

  useEffect(() => {
    if (!open) {
      setCustomerSearch("");
      setDebouncedCustomerSearch("");
      setSelectedCustomerIds([]);
    }
  }, [open]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [customerSearch]);

  const assignAreaMutation = useMutation({
    ...orpc.warehouseEmployee.assignSalesmanArea.mutationOptions(),
    onSuccess: (result) => {
      toast.success(result.message);
      setSelectedAreaId(String(result.assignedArea.id));
      queryClient.invalidateQueries({ queryKey: orpc.warehouseEmployee.key() });
    },
    onError: (error) =>
      toast.error(error.message || "Failed to assign delivery area"),
  });

  const assignCustomersMutation = useMutation({
    ...orpc.warehouseEmployee.assignSalesmanCustomers.mutationOptions(),
    onSuccess: (result) => {
      toast.success(result.message);
      setSelectedCustomerIds([]);
      queryClient.invalidateQueries({ queryKey: orpc.warehouseEmployee.key() });
    },
    onError: (error) =>
      toast.error(error.message || "Failed to assign customers"),
  });

  const canSaveArea =
    !!salesman?.id &&
    !!selectedAreaId &&
    Number(selectedAreaId) !== currentAreaId &&
    !areasLoading &&
    !assignAreaMutation.isPending;

  const saveArea = () => {
    if (!salesman?.id || !selectedAreaId) return;
    assignAreaMutation.mutate({
      salesmanId: salesman.id,
      areaId: Number(selectedAreaId),
    });
  };

  const toggleCustomerSelection = (customer: AssignableCustomer) => {
    if (!customer.isAssignable || assignCustomersMutation.isPending) return;

    setSelectedCustomerIds((current) =>
      current.includes(customer.id)
        ? current.filter((customerId) => customerId !== customer.id)
        : [...current, customer.id],
    );
  };

  const saveCustomers = () => {
    if (!salesman?.id || selectedCustomerIds.length === 0) return;
    assignCustomersMutation.mutate({
      salesmanId: salesman.id,
      customerIds: selectedCustomerIds,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <SheetTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            {salesman?.name ?? "Salesman details"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {salesman?.phoneNumber ?? salesman?.email ?? "Assignment overview"}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !detail ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading details...
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <section className="rounded-lg border bg-muted/20 px-4 py-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  {getStatusBadge(detail.banned)}
                  {getAreaBadge(detail.assignedArea)}
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="mt-0.5 flex items-center gap-1 font-medium tabular-nums">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {detail.phoneNumber ?? "No phone"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="mt-0.5 flex min-w-0 items-center gap-1 font-medium">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{detail.email}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assigned area</p>
                    <p className="mt-0.5 flex items-center gap-1 font-medium">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {detail.assignedArea?.name ?? "Not Assigned"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Joined</p>
                    <p className="mt-0.5 font-medium">
                      {format(new Date(detail.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold">
                  Performance Snapshot
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xl font-bold tabular-nums">
                      {detail.assignedCustomersCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Assigned customers
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xl font-bold tabular-nums">
                      {detail.estimatesCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Estimates</p>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border bg-background">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Assign Area</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Select one delivery area for this salesman.
                  </p>
                </div>
                <div className="space-y-3 p-4">
                  <Select
                    value={selectedAreaId}
                    onValueChange={setSelectedAreaId}
                    disabled={areasLoading || assignAreaMutation.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          areasLoading ? "Loading areas..." : "Select area"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((area) => (
                        <SelectItem
                          key={area.id}
                          value={String(area.id)}
                          disabled={area.status !== "active"}
                        >
                          {area.name}
                          {area.status !== "active" ? " (Inactive)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {areas.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No delivery areas found. Create areas from Delivery
                      Management first.
                    </p>
                  ) : null}
                  <Button
                    className="w-full"
                    onClick={saveArea}
                    disabled={!canSaveArea}
                  >
                    {assignAreaMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="mr-2 h-4 w-4" />
                    )}
                    Save Assignment
                  </Button>
                </div>
              </section>

              <section className="rounded-lg border bg-background">
                <div className="border-b px-4 py-3">
                  <h3 className="text-sm font-semibold">Assign Customers</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Select active retailers or buyer warehouses connected to
                    this warehouse.
                  </p>
                </div>
                <div className="space-y-3 p-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={customerSearch}
                      onChange={(event) =>
                        setCustomerSearch(event.target.value)
                      }
                      placeholder="Search customers..."
                      className="pl-9"
                    />
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {assignableCustomersLoading ? (
                      <div className="flex items-center justify-center rounded-lg border bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading customers...
                      </div>
                    ) : assignableCustomers.length === 0 ? (
                      <div className="rounded-lg border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                        No connected customers found
                      </div>
                    ) : (
                      assignableCustomers.map((customer) => {
                        const checkboxId = `assign-customer-${customer.id}`;
                        const checked = selectedCustomerIdSet.has(customer.id);
                        const disabled =
                          !customer.isAssignable ||
                          assignCustomersMutation.isPending;
                        const assignmentLabel =
                          customer.isAssignedToThisSalesman
                            ? "Already assigned here"
                            : customer.assignedSalesmanName
                              ? `Assigned to ${customer.assignedSalesmanName}`
                              : null;

                        return (
                          <label
                            key={`${customer.customerType}-${customer.id}`}
                            htmlFor={checkboxId}
                            className={`flex cursor-pointer gap-3 rounded-lg border bg-background px-3 py-2.5 transition-colors ${
                              disabled
                                ? "cursor-not-allowed opacity-65"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <Checkbox
                              id={checkboxId}
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={() =>
                                toggleCustomerSelection(customer)
                              }
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="min-w-0 truncate text-sm font-medium">
                                  {customer.displayName}
                                </p>
                                <CustomerTypeBadge
                                  type={customer.customerType}
                                />
                              </div>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {customer.contactName}
                                {customer.phoneNumber
                                  ? ` - ${customer.phoneNumber}`
                                  : ""}
                              </p>
                              {customer.address ? (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {customer.address}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-start pt-0.5">
                              {assignmentLabel ? (
                                <Badge
                                  variant="outline"
                                  className="max-w-36 truncate text-[11px]"
                                  title={assignmentLabel}
                                >
                                  {assignmentLabel}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 text-[11px]"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Available
                                </Badge>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={saveCustomers}
                    disabled={
                      selectedCustomerIds.length === 0 ||
                      assignCustomersMutation.isPending
                    }
                  >
                    {assignCustomersMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Users className="mr-2 h-4 w-4" />
                    )}
                    Assign Selected Customers
                    {selectedCustomerIds.length > 0
                      ? ` (${selectedCustomerIds.length})`
                      : ""}
                  </Button>
                  {assignableCustomersFetching &&
                  !assignableCustomersLoading ? (
                    <p className="text-xs text-muted-foreground">
                      Refreshing customer results...
                    </p>
                  ) : null}
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Assigned Customers</h3>
                  <Badge variant="outline" className="text-xs">
                    {assignedCustomers.length}
                  </Badge>
                </div>
                {assignedCustomers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/20 px-4 py-10 text-center">
                    <Users className="mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No customers assigned yet
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignedCustomers.map((customer) => {
                      const CustomerIcon =
                        customer.customerType === "warehouse"
                          ? Building2
                          : Store;

                      return (
                        <div
                          key={customer.id}
                          className="rounded-lg border bg-background px-3 py-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                <p className="truncate text-sm font-medium">
                                  {customer.displayName ||
                                    customer.warehouseName ||
                                    customer.shopName ||
                                    customer.name}
                                </p>
                                <CustomerTypeBadge
                                  type={customer.customerType}
                                />
                              </div>
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <CustomerIcon className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {customer.name}
                                </span>
                              </p>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {format(
                                new Date(customer.assignedAt),
                                "MMM d, yyyy",
                              )}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {customer.phoneNumber ?? "No phone"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SalesTeamClient({
  salesmen,
  stats,
}: {
  salesmen: Salesman[];
  stats: SalesmenStats;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string | null>(
    null,
  );
  const queryClient = useQueryClient();
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const selectedSalesman = useMemo(
    () => salesmen.find((s) => s.id === selectedSalesmanId) ?? null,
    [salesmen, selectedSalesmanId],
  );

  const { data: areasData, isLoading: areasLoading } = useQuery(
    orpc.warehouseDelivery.getAreas.queryOptions({ input: {} }),
  );

  const deliveryAreas = useMemo(
    () => (areasData?.areas ?? []) as DeliveryAreaOption[],
    [areasData?.areas],
  );

  const openDetails = useCallback((salesmanId: string) => {
    setSelectedSalesmanId(salesmanId);
  }, []);

  const banMutation = useMutation({
    ...orpc.warehouseEmployee.toggleBan.mutationOptions(),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: orpc.warehouseEmployee.key() });
    },
    onError: (error) => toast.error(error.message || "Failed to update status"),
  });

  const deleteMutation = useMutation({
    ...orpc.warehouseEmployee.delete.mutationOptions(),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: orpc.warehouseEmployee.key() });
      if (selectedSalesmanId) setSelectedSalesmanId(null);
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

  const columns: ColumnDef<Salesman>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Salesman Name",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.email}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "phoneNumber",
        header: "Phone",
        cell: ({ row }) => row.original.phoneNumber || "-",
      },
      {
        accessorKey: "assignedArea",
        header: "Assigned Area",
        cell: ({ row }) => getAreaBadge(row.original.assignedArea),
      },
      {
        accessorKey: "assignedCustomersCount",
        header: "Total Customers",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            <Users className="mr-1 h-3 w-3" />
            {row.original.assignedCustomersCount}
          </Badge>
        ),
      },
      {
        accessorKey: "banned",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.banned),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const s = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openDetails(s.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setNewPassword(generatePassword());
                    setResetPasswordDialog({ userId: s.id, name: s.name });
                  }}
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  Reset Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    banMutation.mutate({
                      userId: s.id,
                      banned: !s.banned,
                    })
                  }
                >
                  {s.banned ? (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Unban
                    </>
                  ) : (
                    <>
                      <Ban className="mr-2 h-4 w-4" />
                      Ban
                    </>
                  )}
                </DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {s.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this salesman. This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate({ id: s.id })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [banMutation, deleteMutation, openDetails],
  );

  const filteredData = useMemo(() => {
    if (!globalFilter) return salesmen;
    const search = globalFilter.toLowerCase();
    return salesmen.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.email.toLowerCase().includes(search) ||
        (s.phoneNumber?.toLowerCase().includes(search) ?? false) ||
        (s.assignedArea?.name.toLowerCase().includes(search) ?? false),
    );
  }, [salesmen, globalFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  return (
    <div className="space-y-4">
      <SalesmanDetailsSheet
        salesman={selectedSalesman}
        open={!!selectedSalesmanId}
        onOpenChange={(open) => {
          if (!open) setSelectedSalesmanId(null);
        }}
        areas={deliveryAreas}
        areasLoading={areasLoading}
      />

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
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetPasswordDialog(null);
                setNewPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
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
              {resetPasswordMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total Staff" value={stats.total} icon={Users} />
        <MetricCard
          label="Assigned Salesmen"
          value={stats.assignedSalesmen}
          icon={MapPin}
        />
        <MetricCard
          label="Active Salesmen"
          value={stats.activeCount}
          icon={UserCheck}
        />
        <MetricCard
          label="Assigned Customers"
          value={stats.assignedCustomers}
          icon={Store}
        />
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by salesman, email, phone, area..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <CreateWarehouseEmployeeModal defaultRole="salesman" />
      </div>

      {filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 py-12 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No salesmen found</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {table.getRowModel().rows.map((row) => {
              const s = row.original;
              return (
                <Card key={s.id} className="p-0">
                  <CardContent className="p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {s.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {s.email}
                        </p>
                      </div>
                      {getStatusBadge(s.banned)}
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-muted-foreground">
                        {s.phoneNumber || "No phone"}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        <Users className="mr-1 h-3 w-3" />
                        {s.assignedCustomersCount}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 border-t pt-2 text-xs text-muted-foreground">
                      {getAreaBadge(s.assignedArea)}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openDetails(s.id)}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View details</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="hidden rounded-md border sm:block">
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
          </div>

          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-xs text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SalesTeamPage() {
  const { data, isLoading, error } = useQuery(
    orpc.warehouseEmployee.getSalesmen.queryOptions({ input: {} }),
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Sales Team
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage sales personnel for your warehouse
          </p>
        </div>
        <TableSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Sales Team
          </h1>
        </div>
        <div className="flex h-40 items-center justify-center">
          <p className="text-muted-foreground">Failed to load sales team</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Sales Team
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage sales areas and customers for your warehouse sales team
        </p>
      </div>
      <SalesTeamClient salesmen={data.salesmen} stats={data.stats} />
    </div>
  );
}
