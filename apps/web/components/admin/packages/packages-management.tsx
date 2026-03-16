"use client";

import type { LandingPricingPlan } from "@bikalpo-project/db/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  CheckCircle2,
  Edit,
  Package,
  PauseCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createPackageColumns } from "@/components/admin/packages/package-columns";
import { PackageForm } from "@/components/admin/packages/package-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { client } from "@/utils/orpc";

export function PackagesManagement() {
  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Something went wrong";
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<LandingPricingPlan | null>(
    null,
  );
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["pricing-plans"],
    queryFn: () => client.adminLanding.getAllPlans(),
  });

  const activeCount = plans.filter((p) => p.active).length;

  const handleEdit = (plan: LandingPricingPlan) => {
    setEditingPlan(plan);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingPlan(null);
      queryClient.invalidateQueries({ queryKey: ["pricing-plans"] });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await client.adminLanding.deletePlan({ id: deleteId });
      toast.success("Package deleted");
      queryClient.invalidateQueries({ queryKey: ["pricing-plans"] });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Failed to delete package");
    }
    setDeleteId(null);
  };

  const handleToggle = async (id: number, currentActive: boolean) => {
    try {
      const result = await client.adminLanding.togglePlanActive({
        id,
        active: !currentActive,
      });
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["pricing-plans"] });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Failed to update package status");
    }
  };

  const columns = createPackageColumns({
    onEdit: handleEdit,
    onDelete: setDeleteId,
  });

  const table = useReactTable({
    data: plans,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const paginatedMobileData = useMemo(() => {
    return table.getRowModel().rows.map((row) => row.original);
  }, [table.getRowModel]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Subscription Packages
          </h1>
          <p className="text-muted-foreground">
            Manage pricing plans displayed on the landing page.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Package
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                plans.length
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {isLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                activeCount
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <PauseCircle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">
              {isLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                plans.length - activeCount
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : paginatedMobileData.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-muted-foreground">No packages yet.</p>
            </CardContent>
          </Card>
        ) : (
          paginatedMobileData.map((plan) => (
            <Card key={plan.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{plan.name}</h3>
                      {plan.isPopular && (
                        <Badge className="bg-primary/10 text-primary border-0 text-xs">
                          Popular
                        </Badge>
                      )}
                    </div>
                    <p className="text-lg font-bold font-mono">
                      ৳{plan.priceMonthly.toLocaleString()}
                      <span className="text-sm font-normal text-muted-foreground">
                        /mo
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        className={
                          plan.active
                            ? "bg-emerald-100 text-emerald-700 border-0 text-xs"
                            : "bg-gray-100 text-gray-600 border-0 text-xs"
                        }
                      >
                        {plan.active ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {((plan.features as string[]) || []).length} features
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(plan)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleToggle(plan.id, plan.active ?? true)}
                    >
                      {plan.active ? (
                        <PauseCircle className="h-4 w-4 text-gray-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => setDeleteId(plan.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="font-semibold">
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
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columns.length}>
                    <div className="h-6 bg-muted animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-muted/50 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="h-8 w-8" />
                    <span>No packages yet. Create one to get started.</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {plans.length > 0 && (
        <div className="flex items-center justify-between py-2">
          <div className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()} ({plans.length} packages)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      <PackageForm
        plan={editingPlan}
        open={formOpen}
        onOpenChange={handleFormClose}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this package? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
