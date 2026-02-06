"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  CheckCircle2,
  Edit,
  MoreHorizontal,
  PauseCircle,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { deleteBrandUpdate } from "@/actions/brand-update/delete-brand-update";
import { getAllBrandUpdates } from "@/actions/brand-update/get-all-brand-updates";
import { toggleBrandUpdateActive } from "@/actions/brand-update/update-brand-update";
import { BrandUpdateForm } from "@/components/admin/brand-updates/brand-update-form";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BrandUpdate } from "@/db/schema/brand-update";
import { cn } from "@/lib/utils";

const typeColors: Record<string, { bg: string; text: string; dot: string }> = {
  info: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  warning: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  new: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  offer: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
};

export function BrandUpdateManagement() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<BrandUpdate | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: result, isLoading } = useQuery({
    queryKey: ["brand-updates"],
    queryFn: getAllBrandUpdates,
  });

  const brandUpdates = result?.success ? result.data : [];
  const activeCount = brandUpdates.filter((a) => a.active).length;
  const inactiveCount = brandUpdates.length - activeCount;

  const handleEdit = (update: BrandUpdate) => {
    setEditingUpdate(update);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingUpdate(null);
      queryClient.invalidateQueries({ queryKey: ["brand-updates"] });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteBrandUpdate(deleteId);
    if (result.success) {
      toast.success("Brand update deleted");
      queryClient.invalidateQueries({ queryKey: ["brand-updates"] });
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  };

  const handleToggle = async (id: number, currentActive: boolean) => {
    const result = await toggleBrandUpdateActive(id, !currentActive);
    if (result.success) {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["brand-updates"] });
    } else {
      toast.error(result.error);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: issues
  const columns: ColumnDef<BrandUpdate>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => {
          const update = row.original;
          const colors = typeColors[update.type || "info"];
          return (
            <div className="flex items-center gap-2 max-w-[250px]">
              <div
                className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)}
              />
              <span className="font-medium truncate">{update.title}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-muted-foreground max-w-[200px] truncate block">
            {row.original.description || "—"}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
          const type = row.original.type || "info";
          const colors = typeColors[type];
          return (
            <Badge
              className={cn(colors.bg, colors.text, "border-0 capitalize")}
            >
              {type}
            </Badge>
          );
        },
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ row }) => {
          const active = row.original.active;
          return (
            <Badge
              className={
                active
                  ? "bg-emerald-100 text-emerald-700 border-0"
                  : "bg-gray-100 text-gray-600 border-0"
              }
            >
              {active ? "Active" : "Inactive"}
            </Badge>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) =>
          row.original.createdAt
            ? format(new Date(row.original.createdAt), "MMM d, yyyy")
            : "—",
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const update = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="size-8 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleEdit(update)}>
                  <Edit className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleToggle(update.id, update.active ?? true)}
                >
                  {update.active ? (
                    <>
                      <PauseCircle className="mr-2 size-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 size-4" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteId(update.id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: brandUpdates,
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
            <Tag className="h-6 w-6 text-primary" />
            Brand Updates
          </h1>
          <p className="text-muted-foreground">
            Manage brand updates displayed to customers.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Brand Update
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                brandUpdates.length
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
                inactiveCount
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
                  <div className="flex gap-2">
                    <div className="h-5 bg-muted rounded w-16" />
                    <div className="h-5 bg-muted rounded w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : paginatedMobileData.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Tag className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-muted-foreground">No brand updates yet.</p>
            </CardContent>
          </Card>
        ) : (
          paginatedMobileData.map((update) => {
            const colors = typeColors[update.type || "info"];
            return (
              <Card key={update.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            colors.dot,
                          )}
                        />
                        <h3 className="font-medium truncate">{update.title}</h3>
                      </div>
                      {update.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {update.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={cn(
                            colors.bg,
                            colors.text,
                            "border-0 capitalize text-xs",
                          )}
                        >
                          {update.type || "info"}
                        </Badge>
                        <Badge
                          className={
                            update.active
                              ? "bg-emerald-100 text-emerald-700 border-0 text-xs"
                              : "bg-gray-100 text-gray-600 border-0 text-xs"
                          }
                        >
                          {update.active ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {update.createdAt
                            ? format(new Date(update.createdAt), "MMM d, yyyy")
                            : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(update)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          handleToggle(update.id, update.active ?? true)
                        }
                      >
                        {update.active ? (
                          <PauseCircle className="h-4 w-4 text-gray-500" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={() => setDeleteId(update.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
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
              [...Array(5)].map((_, i) => (
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
                    <Tag className="h-8 w-8" />
                    <span>
                      No brand updates yet. Create one to get started.
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {brandUpdates.length > 0 && (
        <div className="flex items-center justify-between py-2">
          <div className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()} ({brandUpdates.length} updates)
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
      <BrandUpdateForm
        brandUpdate={editingUpdate}
        open={formOpen}
        onOpenChange={handleFormClose}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Brand Update</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this brand update? This action
              cannot be undone.
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
