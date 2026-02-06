"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type CreateVariantInput,
  createVariant,
} from "@/actions/product-variant/create-variant";
import {
  type UpdateVariantInput,
  updateVariant,
} from "@/actions/product-variant/update-variant";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProductVariant } from "@/db/schema/product-variant";

/** Draft variant (no productId) for "add while creating product" */
export type DraftVariant = Omit<CreateVariantInput, "productId">;

type VariantFormDialogProps = {
  productId?: number | null;
  variant?: ProductVariant | null;
  /** Prefill when adding/editing a draft variant (create product flow) */
  draftInitial?: DraftVariant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, dialog works in draft mode: submit calls this instead of createVariant */
  onSubmitDraft?: (data: DraftVariant) => void;
};

export function VariantFormDialog({
  productId = null,
  variant = null,
  draftInitial = null,
  open,
  onOpenChange,
  onSubmitDraft,
}: VariantFormDialogProps) {
  const queryClient = useQueryClient();
  const isDraftMode = (productId == null || productId === 0) && !!onSubmitDraft;
  const isEdit = !!variant || !!draftInitial;
  const source = variant ?? draftInitial;

  const createMutation = useMutation({
    mutationFn: (input: CreateVariantInput) => createVariant(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product-variants", productId],
      });
      toast.success("Variant added");
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to add variant"),
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateVariantInput) => updateVariant(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product-variants", productId],
      });
      toast.success("Variant updated");
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update variant"),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const unitLabel = (fd.get("unitLabel") as string)?.trim();
    const packagingType = (fd.get("packagingType") as string) || "loose";
    const weightKg = (fd.get("weightKg") as string)?.trim();
    const price = (fd.get("price") as string)?.trim();
    if (!unitLabel || !weightKg || !price) {
      toast.error("Unit label, weight, and price are required");
      return;
    }

    const draftData: DraftVariant = {
      sku: (fd.get("sku") as string)?.trim() || undefined,
      unitLabel: unitLabel!,
      quantitySelectorLabel:
        (fd.get("quantitySelectorLabel") as string)?.trim() || undefined,
      packagingType,
      weightKg: weightKg!,
      pieceWeightKg: (fd.get("pieceWeightKg") as string)?.trim() || undefined,
      piecesPerUnit: fd.get("piecesPerUnit")
        ? Number(fd.get("piecesPerUnit"))
        : undefined,
      pricingType: (fd.get("pricingType") as string) || "per_unit",
      price: price!,
      orderMin: (fd.get("orderMin") as string)?.trim() || "1",
      orderMax: (fd.get("orderMax") as string)?.trim() || undefined,
      orderIncrement: (fd.get("orderIncrement") as string)?.trim() || "1",
      orderUnit: (fd.get("orderUnit") as string) || "piece",
      stockQuantity: fd.get("stockQuantity")
        ? Number(fd.get("stockQuantity"))
        : 0,
      reorderLevel: fd.get("reorderLevel") ? Number(fd.get("reorderLevel")) : 0,
      care: (fd.get("care") as string)?.trim() || undefined,
      note: (fd.get("note") as string)?.trim() || undefined,
    };

    if (isDraftMode && onSubmitDraft) {
      onSubmitDraft(draftData);
      onOpenChange(false);
      return;
    }

    if (isEdit && variant && productId) {
      updateMutation.mutate({ id: variant.id, ...draftData });
      return;
    }
    if (productId) {
      createMutation.mutate({
        productId,
        sku: (fd.get("sku") as string)?.trim() || undefined,
        unitLabel,
        quantitySelectorLabel:
          (fd.get("quantitySelectorLabel") as string)?.trim() || undefined,
        packagingType,
        weightKg,
        pieceWeightKg: (fd.get("pieceWeightKg") as string)?.trim() || undefined,
        piecesPerUnit: fd.get("piecesPerUnit")
          ? Number(fd.get("piecesPerUnit"))
          : undefined,
        pricingType: (fd.get("pricingType") as string) || "per_unit",
        price,
        orderMin: (fd.get("orderMin") as string)?.trim() || "1",
        orderMax: (fd.get("orderMax") as string)?.trim() || undefined,
        orderIncrement: (fd.get("orderIncrement") as string)?.trim() || "1",
        orderUnit: (fd.get("orderUnit") as string) || "piece",
        stockQuantity: fd.get("stockQuantity")
          ? Number(fd.get("stockQuantity"))
          : 0,
        reorderLevel: fd.get("reorderLevel")
          ? Number(fd.get("reorderLevel"))
          : 0,
        care: (fd.get("care") as string)?.trim() || undefined,
        note: (fd.get("note") as string)?.trim() || undefined,
      });
    }
  };

  const pending =
    !isDraftMode && (createMutation.isPending || updateMutation.isPending);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit variant" : "Add variant"}</DialogTitle>
        </DialogHeader>
        <form id="variant-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>SKU</FieldLabel>
              <Input
                name="sku"
                defaultValue={source?.sku ?? ""}
                placeholder="e.g. AT-IF-L-1020"
              />
            </Field>
            <Field>
              <FieldLabel>Unit label *</FieldLabel>
              <Input
                name="unitLabel"
                required
                defaultValue={source?.unitLabel ?? ""}
                placeholder="Sack, Carton, kg"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>Quantity selector label</FieldLabel>
            <Input
              name="quantitySelectorLabel"
              defaultValue={source?.quantitySelectorLabel ?? ""}
              placeholder="e.g. Sack (50 kg)"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Packaging type</FieldLabel>
              <select
                name="packagingType"
                defaultValue={source?.packagingType ?? "loose"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="loose">Loose</option>
                <option value="carton">Carton</option>
              </select>
            </Field>
            <Field>
              <FieldLabel>Weight (kg) *</FieldLabel>
              <Input
                name="weightKg"
                type="text"
                required
                defaultValue={source?.weightKg ?? ""}
                placeholder="50"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Piece weight (kg)</FieldLabel>
              <Input
                name="pieceWeightKg"
                type="text"
                defaultValue={source?.pieceWeightKg ?? ""}
                placeholder="For carton"
              />
            </Field>
            <Field>
              <FieldLabel>Pieces per unit</FieldLabel>
              <Input
                name="piecesPerUnit"
                type="number"
                defaultValue={source?.piecesPerUnit ?? ""}
                placeholder="10"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Pricing type</FieldLabel>
              <select
                name="pricingType"
                defaultValue={source?.pricingType ?? "per_unit"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="per_unit">Per unit</option>
                <option value="bulk_rate">Bulk rate</option>
              </select>
            </Field>
            <Field>
              <FieldLabel>Price *</FieldLabel>
              <Input
                name="price"
                type="text"
                required
                defaultValue={source?.price ?? ""}
                placeholder="0.00"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Order min</FieldLabel>
              <Input
                name="orderMin"
                defaultValue={source?.orderMin ?? "1"}
                placeholder="1"
              />
            </Field>
            <Field>
              <FieldLabel>Order max</FieldLabel>
              <Input
                name="orderMax"
                defaultValue={source?.orderMax ?? ""}
                placeholder="Leave empty for no max"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Order increment</FieldLabel>
              <Input
                name="orderIncrement"
                defaultValue={source?.orderIncrement ?? "1"}
                placeholder="1"
              />
            </Field>
            <Field>
              <FieldLabel>Order unit</FieldLabel>
              <select
                name="orderUnit"
                defaultValue={source?.orderUnit ?? "piece"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="piece">piece</option>
                <option value="kg">kg</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Stock quantity</FieldLabel>
              <Input
                name="stockQuantity"
                type="number"
                defaultValue={source?.stockQuantity ?? 0}
              />
            </Field>
            <Field>
              <FieldLabel>Reorder level</FieldLabel>
              <Input
                name="reorderLevel"
                type="number"
                defaultValue={source?.reorderLevel ?? 0}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>Care</FieldLabel>
            <Input
              name="care"
              defaultValue={source?.care ?? ""}
              placeholder="e.g. No Care"
            />
          </Field>
          <Field>
            <FieldLabel>Note</FieldLabel>
            <Textarea
              name="note"
              defaultValue={source?.note ?? ""}
              placeholder="e.g. Delivery charges calculated at checkout"
              rows={2}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" form="variant-form" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Update variant" : "Add variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
