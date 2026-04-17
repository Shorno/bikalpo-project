"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Eye,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CreateWarehouseEmployeeModal } from "@/components/features/warehouse/create-warehouse-employee-modal";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TableSkeleton from "@/components/table-skeleton";
import { orpc } from "@/utils/orpc";

const WH = "/warehouse/dashboard";

interface Salesman {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  createdAt: Date;
  banned: boolean;
  estimatesCount: number;
  assignedCustomersCount: number;
}

interface SalesmenStats {
  total: number;
  totalEstimates: number;
  activeCount: number;
}

function getStatusBadge(banned: boolean) {
  if (banned) {
    return (
      <Badge variant="destructive" className="text-xs">
        Banned
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-xs text-green-600 border-green-600"
    >
      Active
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

function SalesTeamClient({
  salesmen,
  stats,
}: {
  salesmen: Salesman[];
  stats: SalesmenStats;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const queryClient = useQueryClient();
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");

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
        header: "Name",
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
        accessorKey: "assignedCustomersCount",
        header: "Customers",
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {row.original.assignedCustomersCount}
          </Badge>
        ),
      },
      {
        accessorKey: "estimatesCount",
        header: "Estimates",
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-xs">
            {row.original.estimatesCount}
          </Badge>
        ),
      },
      {
        accessorKey: "banned",
        header: "Status",
        cell: ({ row }) => getStatusBadge(row.original.banned),
      },
      {
        accessorKey: "createdAt",
        header: "Joined",
        cell: ({ row }) =>
          format(new Date(row.original.createdAt), "MMM d, yyyy"),
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
                <DropdownMenuItem asChild>
                  <Link href={`${WH}/sales-team/${s.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setNewPassword(generatePassword());
                    setResetPasswordDialog({ userId: s.id, name: s.name });
                  }}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
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
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Unban
                    </>
                  ) : (
                    <>
                      <Ban className="h-4 w-4 mr-2" />
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
                      <Trash2 className="h-4 w-4 mr-2" />
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
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
    [banMutation, deleteMutation],
  );

  const filteredData = useMemo(() => {
    if (!globalFilter) return salesmen;
    const search = globalFilter.toLowerCase();
    return salesmen.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.email.toLowerCase().includes(search) ||
        (s.phoneNumber?.toLowerCase().includes(search) ?? false),
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
      {/* Reset Password Dialog */}
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
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.totalEstimates}</p>
            <p className="text-xs text-muted-foreground">Estimates</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Add Button */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <CreateWarehouseEmployeeModal defaultRole="salesman" />
      </div>

      {filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No salesmen found</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card View */}
          <div className="sm:hidden space-y-3">
            {table.getRowModel().rows.map((row) => {
              const s = row.original;
              return (
                <Card key={s.id} className="p-0">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {s.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.email}
                        </p>
                      </div>
                      {getStatusBadge(s.banned)}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {s.phoneNumber || "No phone"}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          <Users className="h-3 w-3 mr-1" />
                          {s.assignedCustomersCount}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {s.estimatesCount} est.
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                      <span>
                        Joined {format(new Date(s.createdAt), "MMM d, yyyy")}
                      </span>
                      <Link href={`${WH}/sales-team/${s.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop: Table View */}
          <div className="hidden sm:block rounded-md border">
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

          {/* Pagination */}
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
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
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Sales Team
          </h1>
        </div>
        <div className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">Failed to load sales team</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          Sales Team
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage sales personnel for your warehouse
        </p>
      </div>
      <SalesTeamClient salesmen={data.salesmen} stats={data.stats} />
    </div>
  );
}
