"use client";

import type { ProductVariant } from "@bikalpo-project/db/schema";
import { useQuery } from "@tanstack/react-query";
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
import { client } from "@/utils/orpc";
import { VariantConversionPanel } from "./variant-conversion-panel";
import { VariantFormDialog } from "./variant-form-dialog";

function VariantListItem({
  variant,
  onEdit,
  onDelete,
}: {
  variant: ProductVariant;
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
            <span className="text-sm font-semibold text-primary">
              ৳{variant.price}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground capitalize">
              {variant.packagingType}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              Min {variant.orderMin} {variant.orderUnit}
              {variant.orderMax ? ` / Max ${variant.orderMax}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {variant.variantType && (
              <Badge
                variant={variant.variantType === "trade" ? "default" : "secondary"}
                className="text-[10px] h-5"
              >
                {variant.variantType === "trade" ? "Trade (B2B)" : "Retail (B2C)"}
              </Badge>
            )}
            {variant.packType && (
              <Badge variant="outline" className="text-[10px] h-5 capitalize">
                {variant.packType}
              </Badge>
            )}
            {variant.visibilityRole && variant.visibilityRole !== "all" && (
              <Badge variant="outline" className="text-[10px] h-5">
                {variant.visibilityRole === "shop_owner" ? "Shop Owners" : "Consumers"}
              </Badge>
            )}
            {!variant.isActive && (
              <Badge variant="destructive" className="text-[10px] h-5">
                Inactive
              </Badge>
            )}
            {variant.isOpenOrderAllowed && (
              <Badge variant="outline" className="text-[10px] h-5 text-blue-600 border-blue-300">
                Open Order
              </Badge>
            )}
            {variant.isPackReturnRequired && (
              <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-300">
                Pack Return
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onDelete}>
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

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
    queryFn: () => client.adminProductVariant.getByProductId({ productId }),
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
      await client.adminProductVariant.delete({ id: deleteId });
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
            <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/30">
              <Package className="size-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No variants yet. Add one to sell by unit (Sack, Carton, kg, etc.)
                with its own price and order rules.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {variants.map((v) => (
                <VariantListItem
                  key={v.id}
                  variant={v}
                  onEdit={() => handleEdit(v)}
                  onDelete={() => setDeleteId(v.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {variants.length >= 2 && (
        <VariantConversionPanel
          productId={productId}
          variants={variants}
        />
      )}

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
