"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import type { DraftVariant } from "./variant-form-dialog";
import { VariantFormDialog } from "./variant-form-dialog";

export function ProductDraftVariantsCard({
  draftVariants,
  setDraftVariants,
}: {
  draftVariants: DraftVariant[];
  setDraftVariants: React.Dispatch<React.SetStateAction<DraftVariant[]>>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const handleAdd = () => {
    setEditingIndex(null);
    setDialogOpen(true);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingIndex(null);
  };

  const handleSubmitDraft = (data: DraftVariant) => {
    if (editingIndex !== null) {
      setDraftVariants((prev) =>
        prev.map((v, i) => (i === editingIndex ? data : v)),
      );
      toast.success("Variant updated");
    } else {
      setDraftVariants((prev) => [...prev, data]);
      toast.success("Variant added");
    }
    setDialogOpen(false);
    setEditingIndex(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteIndex == null) return;
    setDraftVariants((prev) => prev.filter((_, i) => i !== deleteIndex));
    toast.success("Variant removed");
    setDeleteIndex(null);
  };

  const editingDraft =
    editingIndex !== null ? (draftVariants[editingIndex] ?? null) : null;

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Variants</CardTitle>
              <CardDescription>
                Add variants now (e.g. Sack, Carton). They will be saved when
                you create the product.
              </CardDescription>
            </div>
            <Button type="button" size="sm" onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add variant
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {draftVariants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No variants yet. Add one to sell by unit (Sack, Carton, kg, etc.)
              with its own price and order rules.
            </p>
          ) : (
            <ul className="space-y-2">
              {draftVariants.map((v, i) => (
                <li
                  key={i}
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
                      {v.packagingType} · {v.pricingType ?? "per_unit"} · ৳
                      {v.price}
                      {v.orderMax != null
                        ? ` · Min ${v.orderMin ?? "1"} ${v.orderUnit ?? "piece"} / Max ${v.orderMax}`
                        : ` · Min ${v.orderMin ?? "1"} ${v.orderUnit ?? "piece"}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(i)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteIndex(i)}
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
        productId={null}
        variant={null}
        draftInitial={editingDraft}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSubmitDraft={handleSubmitDraft}
      />

      <AlertDialog
        open={deleteIndex != null}
        onOpenChange={(o) => !o && setDeleteIndex(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove variant?</AlertDialogTitle>
            <AlertDialogDescription>
              This variant will be removed from the list. You can add it again
              before creating the product.
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
