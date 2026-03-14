"use client";

import type { Offer } from "@bikalpo-project/db/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Percent } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createOfferColumns } from "@/components/admin/offers/offer-columns";
import { OfferForm } from "@/components/admin/offers/offer-form";
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

export function OfferManagement() {
  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : "Something went wrong";

  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Fetch offers
  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["offers"],
    queryFn: () => client.adminOffer.getAll(),
  });

  const activeCount = offers.filter((o) => o.active).length;
  const inactiveCount = offers.length - activeCount;

  const columns = useMemo(
    () =>
      createOfferColumns({
        onEdit: (offer) => {
          setEditingOffer(offer);
          setFormOpen(true);
        },
        onDelete: (id) => setDeleteId(id),
        onToggleActive: async (id, active) => {
          try {
            await client.adminOffer.toggleActive({ id, active });
            toast.success(`Offer ${active ? "activated" : "deactivated"}`);
            queryClient.invalidateQueries({ queryKey: ["offers"] });
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        },
      }),
    [queryClient],
  );

  const table = useReactTable({
    data: offers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleEdit = (offer: Offer) => {
    setEditingOffer(offer);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingOffer(null);
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await client.adminOffer.delete({ id: deleteId });
      toast.success("Offer deleted");
      queryClient.invalidateQueries({ queryKey: ["offers"] });
    } catch (error) {
      toast.error(getErrorMessage(error) || "Failed to delete offer");
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Offers</h1>
          <p className="text-gray-600 mt-1">
            Manage homepage offers and promotions
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingOffer(null);
            setFormOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          New Offer
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Offers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{offers.length}</div>
            <p className="text-xs text-gray-600 mt-1">
              {activeCount} active, {inactiveCount} inactive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Avg. Discount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {offers.length > 0
                ? Math.round(
                    offers.reduce((sum, o) => sum + o.discountPercentage, 0) /
                      offers.length,
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-gray-600 mt-1">Across all offers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Offers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {activeCount}
            </div>
            <p className="text-xs text-gray-600 mt-1">Currently displayed</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Offers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Loading offers...</div>
            </div>
          ) : offers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Percent className="w-12 h-12 mb-2 opacity-20" />
              <p>No offers yet. Create one to get started!</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
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
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  Showing {table.getState().pagination.pageIndex + 1} of{" "}
                  {table.getPageCount()} page(s)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <OfferForm
        offer={editingOffer || undefined}
        open={formOpen}
        onOpenChange={handleFormClose}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Offer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this offer? This action cannot be
              undone.
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
