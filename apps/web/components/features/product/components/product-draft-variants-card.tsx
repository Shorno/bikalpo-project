"use client";

import { Package, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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

function DraftVariantItem({
  variant,
  onEdit,
  onDelete,
}: {
  variant: DraftVariant;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between rounded-lg border p-3 text-sm gap-3">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="flex items-center justify-center size-9 rounded-md bg-muted shrink-0 mt-0.5">
          <Package className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">
              {variant.quantitySelectorLabel || variant.unitLabel}
            </span>
            <span className="text-muted-foreground">{variant.weightKg} kg</span>
            {variant.sku && (
              <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                {variant.sku}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`text-sm font-semibold ${variant.variantType === "trade" ? "text-amber-600" : "text-primary"}`}>
              {variant.variantType === "trade" ? "Price set by shop owner" : `৳${variant.price}`}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground capitalize">
              {variant.packagingType}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              Min {variant.orderMin ?? "1"} {variant.orderUnit ?? "piece"}
              {variant.orderMax ? ` / Max ${variant.orderMax}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {variant.variantType && (
              <Badge
                variant={
                  variant.variantType === "trade" ? "default" : "secondary"
                }
                className="text-[10px] h-5"
              >
                {variant.variantType === "trade"
                  ? "Trade (B2B)"
                  : "Retail (B2C)"}
              </Badge>
            )}
            {variant.packType && (
              <Badge variant="outline" className="text-[10px] h-5 capitalize">
                {variant.packType}
              </Badge>
            )}
            {variant.visibilityRole && variant.visibilityRole !== "all" && (
              <Badge variant="outline" className="text-[10px] h-5">
                {variant.visibilityRole === "shop_owner"
                  ? "Shop Owners"
                  : "Consumers"}
              </Badge>
            )}
            {variant.isOpenOrderAllowed && (
              <Badge
                variant="outline"
                className="text-[10px] h-5 text-blue-600 border-blue-300"
              >
                Open Order
              </Badge>
            )}
            {variant.isPackReturnRequired && (
              <Badge
                variant="outline"
                className="text-[10px] h-5 text-amber-600 border-amber-300"
              >
                Pack Return
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

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
            <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/30">
              <Package className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No variants yet. Add one to sell by unit (Sack, Carton, kg,
                etc.) with its own price and order rules.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {draftVariants.map((v, i) => (
                <DraftVariantItem
                  key={i}
                  variant={v}
                  onEdit={() => handleEdit(i)}
                  onDelete={() => setDeleteIndex(i)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <VariantFormDialog
        productId={null}
        variant={null}
        draftInitial={editingDraft}
        lockedVariantType={
          draftVariants.length > 0
            ? (draftVariants.find((v) => v.variantType)?.variantType as "trade" | "retail" | undefined) ?? null
            : null
        }
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
