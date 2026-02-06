"use client";

import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteVariant } from "@/actions/product-variant/delete-variant";
import { getVariantsByProductId } from "@/actions/product-variant/get-variants-by-product-id";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProductVariant } from "@/db/schema/product-variant";
import { VariantFormDialog } from "./variant-form-dialog";

export function ProductVariantsCard({
  productId,
  initialVariants = [],
}: {
  productId: number;
  initialVariants?: ProductVariant[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(
    null,
  );
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: variants = initialVariants } = useQuery({
    queryKey: ["product-variants", productId],
    queryFn: () => getVariantsByProductId(productId),
    initialData: initialVariants,
  });

  const handleAdd = () => {
    setEditingVariant(null);
    setDialogOpen(true);
  };

  const handleEdit = (v: ProductVariant) => {
    setEditingVariant(v);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingVariant(null);
  };

  const handleDeleteConfirm = async () => {
    if (deleteId == null) return;
    try {
      await deleteVariant(deleteId);
      toast.success("Variant removed");
      setDeleteId(null);
    } catch {
      toast.error("Failed to remove variant");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Variants</CardTitle>
              <CardDescription>
                Sell this product in different units (e.g. Sack, Carton). Order
                rules and quantity selector live here.
              </CardDescription>
            </div>
            <Button type="button" size="sm" onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add variant
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No variants yet. Add one to sell by unit (Sack, Carton, kg, etc.)
              with its own price and order rules.
            </p>
          ) : (
            <ul className="space-y-2">
              {variants.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">
                      {v.quantitySelectorLabel || v.unitLabel} {v.weightKg} kg
                    </span>
                    {v.sku && (
                      <span className="ml-2 text-muted-foreground">
                        ({v.sku})
                      </span>
                    )}
                    <div className="text-muted-foreground mt-0.5">
                      {v.packagingType} · {v.pricingType} · ৳{v.price}
                      {v.orderMax != null
                        ? ` · Min ${v.orderMin} ${v.orderUnit} / Max ${v.orderMax}`
                        : ` · Min ${v.orderMin} ${v.orderUnit}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(v)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(v.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <VariantFormDialog
        productId={productId}
        variant={editingVariant}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
      />

      <AlertDialog
        open={deleteId != null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove variant?</AlertDialogTitle>
            <AlertDialogDescription>
              This variant will be removed. Cart items using it may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
