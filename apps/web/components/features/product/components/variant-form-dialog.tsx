"use client";

import type { ProductVariant } from "@bikalpo-project/db/schema";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { client } from "@/utils/orpc";
import {
  PACK_TYPES,
  PACKAGING_TYPES,
  ORDER_UNITS,
  variantFormSchema,
} from "@/schema/variant.schema";

type CreateVariantInput = Parameters<
  typeof client.adminProductVariant.create
>[0];
type UpdateVariantInput = Parameters<
  typeof client.adminProductVariant.update
>[0] & { id: number };

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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-sm font-semibold text-foreground tracking-wide uppercase pb-1 border-b">
      {children}
    </h4>
  );
}

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
    mutationFn: (input: CreateVariantInput) =>
      client.adminProductVariant.create(input),
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
    mutationFn: (input: UpdateVariantInput) =>
      client.adminProductVariant.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product-variants", productId],
      });
      toast.success("Variant updated");
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update variant"),
  });

  const pending =
    !isDraftMode && (createMutation.isPending || updateMutation.isPending);

  const form = useForm({
    defaultValues: {
      sku: source?.sku ?? "",
      unitLabel: source?.unitLabel ?? "",
      quantitySelectorLabel: source?.quantitySelectorLabel ?? "",
      variantType: (source?.variantType as "trade" | "retail" | undefined) ?? undefined,
      packType: (source?.packType as string | undefined) ?? undefined,
      packagingType: source?.packagingType ?? "loose",
      weightKg: source?.weightKg ?? "",
      pieceWeightKg: source?.pieceWeightKg ?? "",
      piecesPerUnit: source?.piecesPerUnit ?? (undefined as number | undefined),
      sellUnit: source?.sellUnit ?? "",
      packWeightKg: source?.packWeightKg ?? "",
      innerPackSizeKg: source?.innerPackSizeKg ?? "",
      packCountInside: source?.packCountInside ?? (undefined as number | undefined),
      pricingType: source?.pricingType ?? "per_unit",
      price: source?.price ?? "",
      orderMin: source?.orderMin ?? "1",
      orderMax: source?.orderMax ?? "",
      orderIncrement: source?.orderIncrement ?? "1",
      orderUnit: source?.orderUnit ?? "piece",
      stockQuantity: source?.stockQuantity ?? 0,
      reorderLevel: source?.reorderLevel ?? 0,
      orderType: (source?.orderType as "b2b" | "b2c" | undefined) ?? undefined,
      visibilityRole: (source?.visibilityRole as "shop_owner" | "consumer" | "all" | undefined) ?? "all",
      isActive: source?.isActive ?? true,
      isOpenOrderAllowed: source?.isOpenOrderAllowed ?? false,
      negotiationTimeoutSec: source?.negotiationTimeoutSec ?? 100,
      minMarginPercent: source?.minMarginPercent ?? "",
      minMarginAmount: source?.minMarginAmount ?? "",
      isPackReturnRequired: source?.isPackReturnRequired ?? false,
      packDepositAmount: source?.packDepositAmount ?? "",
      origin: source?.origin ?? "",
      shelfLife: source?.shelfLife ?? "",
      packagingNote: source?.packagingNote ?? "",
      care: source?.care ?? "",
      note: source?.note ?? "",
      sortOrder: source?.sortOrder ?? 0,
    },
    validators: {
      // @ts-ignore
      onSubmit: variantFormSchema,
    },
    onSubmit: async ({ value }) => {
      const draftData = {
        sku: value.sku || undefined,
        unitLabel: value.unitLabel,
        quantitySelectorLabel: value.quantitySelectorLabel || undefined,
        variantType: value.variantType || undefined,
        packType: value.packType || undefined,
        packagingType: value.packagingType,
        weightKg: value.weightKg,
        pieceWeightKg: value.pieceWeightKg || undefined,
        piecesPerUnit: value.piecesPerUnit || undefined,
        sellUnit: value.sellUnit || undefined,
        packWeightKg: value.packWeightKg || undefined,
        innerPackSizeKg: value.innerPackSizeKg || undefined,
        packCountInside: value.packCountInside || undefined,
        pricingType: value.pricingType,
        price: value.price,
        orderMin: value.orderMin || "1",
        orderMax: value.orderMax || undefined,
        orderIncrement: value.orderIncrement || "1",
        orderUnit: value.orderUnit || "piece",
        stockQuantity: value.stockQuantity ?? 0,
        reorderLevel: value.reorderLevel ?? 0,
        orderType: value.orderType || undefined,
        visibilityRole: value.visibilityRole || undefined,
        isActive: value.isActive ?? true,
        isOpenOrderAllowed: value.isOpenOrderAllowed ?? false,
        negotiationTimeoutSec: value.negotiationTimeoutSec ?? 100,
        minMarginPercent: value.minMarginPercent || undefined,
        minMarginAmount: value.minMarginAmount || undefined,
        isPackReturnRequired: value.isPackReturnRequired ?? false,
        packDepositAmount: value.packDepositAmount || undefined,
        origin: value.origin || undefined,
        shelfLife: value.shelfLife || undefined,
        packagingNote: value.packagingNote || undefined,
        care: value.care || undefined,
        note: value.note || undefined,
        sortOrder: value.sortOrder ?? 0,
      } as DraftVariant;

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
        createMutation.mutate({ productId, ...draftData });
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl p-8">
        <DialogHeader>
          <DialogTitle className="text-xl">{isEdit ? "Edit Variant" : "Add Variant"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure this variant's packaging, pricing, and order rules.
          </p>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          {/* ─── Identity ─── */}
          <SectionHeading>Identity</SectionHeading>
          <div className="grid grid-cols-3 gap-4">
            <form.Field name="sku">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>SKU</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g. AT-IF-L-1020"
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="unitLabel">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Unit Label *</FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Sack, Carton, kg"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>
            <form.Field name="quantitySelectorLabel">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Qty Selector Label</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Sack (50 kg)"
                  />
                </Field>
              )}
            </form.Field>
          </div>

          <Separator />

          {/* ─── Type & Packaging ─── */}
          <SectionHeading>Type & Packaging</SectionHeading>
          <div className="grid grid-cols-3 gap-4">
            <form.Field name="variantType">
              {(field) => (
                <Field>
                  <FieldLabel>Variant Type</FieldLabel>
                  <Select
                    value={field.state.value ?? "none"}
                    onValueChange={(v) =>
                      field.handleChange(v === "none" ? undefined : (v as "trade" | "retail"))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="trade">Trade (B2B)</SelectItem>
                      <SelectItem value="retail">Retail (B2C)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
            <form.Field name="packType">
              {(field) => (
                <Field>
                  <FieldLabel>Pack Type</FieldLabel>
                  <Select
                    value={field.state.value ?? "none"}
                    onValueChange={(v) =>
                      field.handleChange(v === "none" ? undefined : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      {PACK_TYPES.map((pt) => (
                        <SelectItem key={pt.value} value={pt.value}>
                          {pt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
            <form.Field name="packagingType">
              {(field) => (
                <Field>
                  <FieldLabel>Packaging Type *</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {PACKAGING_TYPES.map((pt) => (
                        <SelectItem key={pt.value} value={pt.value}>
                          {pt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <form.Field name="weightKg">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Weight (kg) *</FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="50"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>
            <form.Field name="pieceWeightKg">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Piece Weight (kg)</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="For carton"
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="piecesPerUnit">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Pieces / Unit</FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(
                        e.target.value ? parseInt(e.target.value, 10) : undefined,
                      )
                    }
                    placeholder="10"
                  />
                </Field>
              )}
            </form.Field>
          </div>

          <form.Field name="packType">
            {(packTypeField) =>
              packTypeField.state.value === "carton" ||
                packTypeField.state.value === "box" ? (
                <>
                  <Separator />

                  {/* ─── Pack Structure (carton/box only) ─── */}
                  <SectionHeading>Pack Structure</SectionHeading>
                  <div className="grid grid-cols-4 gap-4">
                    <form.Field name="sellUnit">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>Sell Unit</FieldLabel>
                          <Input
                            id={field.name}
                            value={field.state.value ?? ""}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="Sack, KG"
                          />
                        </Field>
                      )}
                    </form.Field>
                    <form.Field name="packWeightKg">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>Pack Weight (kg)</FieldLabel>
                          <Input
                            id={field.name}
                            value={field.state.value ?? ""}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="50"
                          />
                        </Field>
                      )}
                    </form.Field>
                    <form.Field name="innerPackSizeKg">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>Inner Pack (kg)</FieldLabel>
                          <Input
                            id={field.name}
                            value={field.state.value ?? ""}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="5"
                          />
                        </Field>
                      )}
                    </form.Field>
                    <form.Field name="packCountInside">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>Count Inside</FieldLabel>
                          <Input
                            id={field.name}
                            type="number"
                            value={field.state.value ?? ""}
                            onBlur={field.handleBlur}
                            onChange={(e) =>
                              field.handleChange(
                                e.target.value ? parseInt(e.target.value, 10) : undefined,
                              )
                            }
                            placeholder="10"
                          />
                        </Field>
                      )}
                    </form.Field>
                  </div>
                </>
              ) : null
            }
          </form.Field>

          <Separator />

          {/* ─── Pricing ─── */}
          <SectionHeading>Pricing</SectionHeading>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="pricingType">
              {(field) => (
                <Field>
                  <FieldLabel>Pricing Type</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_unit">Per Unit</SelectItem>
                      <SelectItem value="bulk_rate">Bulk Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
            <form.Field name="price">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Price (৳) *</FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="0.00"
                    />
                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                  </Field>
                );
              }}
            </form.Field>
          </div>

          <Separator />

          {/* ─── Order Rules ─── */}
          <SectionHeading>Order Rules</SectionHeading>
          <div className="grid grid-cols-4 gap-4">
            <form.Field name="orderMin">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Min</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="1"
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="orderMax">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Max</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="No limit"
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="orderIncrement">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Increment</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="1"
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="orderUnit">
              {(field) => (
                <Field>
                  <FieldLabel>Order Unit</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={field.handleChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
          </div>

          <Separator />

          {/* ─── Inventory ─── */}
          <SectionHeading>Inventory</SectionHeading>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="stockQuantity">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Stock Quantity</FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(parseInt(e.target.value, 10) || 0)
                    }
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="reorderLevel">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Reorder Level</FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(parseInt(e.target.value, 10) || 0)
                    }
                  />
                </Field>
              )}
            </form.Field>
          </div>

          <Separator />

          {/* ─── Visibility & Access ─── */}
          <SectionHeading>Visibility & Access</SectionHeading>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="orderType">
              {(field) => (
                <Field>
                  <FieldLabel>Order Type</FieldLabel>
                  <Select
                    value={field.state.value ?? "none"}
                    onValueChange={(v) =>
                      field.handleChange(v === "none" ? undefined : (v as "b2b" | "b2c"))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not set</SelectItem>
                      <SelectItem value="b2b">B2B (Wholesale)</SelectItem>
                      <SelectItem value="b2c">B2C (Consumer)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
            <form.Field name="visibilityRole">
              {(field) => (
                <Field>
                  <FieldLabel>Visible To</FieldLabel>
                  <Select
                    value={field.state.value ?? "all"}
                    onValueChange={(v) =>
                      field.handleChange(v as "shop_owner" | "consumer" | "all")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="shop_owner">Shop Owners Only</SelectItem>
                      <SelectItem value="consumer">Consumers Only</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
          </div>
          <form.Field name="isActive">
            {(field) => (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <FieldLabel htmlFor={field.name} className="text-sm font-medium">
                    Active
                  </FieldLabel>
                  <p className="text-xs text-muted-foreground">
                    Inactive variants are hidden from customers
                  </p>
                </div>
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="variantType">
            {(varTypeField) =>
              varTypeField.state.value === "trade" ? (
                <>
                  <Separator />

                  {/* ─── Open Order & Negotiation (Trade only) ─── */}
                  <SectionHeading>Open Order & Negotiation</SectionHeading>
                  <form.Field name="isOpenOrderAllowed">
                    {(field) => (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <FieldLabel htmlFor={field.name} className="text-sm font-medium">
                            Allow Open Orders
                          </FieldLabel>
                          <p className="text-xs text-muted-foreground">
                            Broadcast this variant to eligible sellers for competitive pricing
                          </p>
                        </div>
                        <Switch
                          id={field.name}
                          checked={field.state.value}
                          onCheckedChange={field.handleChange}
                        />
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="isOpenOrderAllowed">
                    {(openOrderField) =>
                      openOrderField.state.value ? (
                        <form.Field name="negotiationTimeoutSec">
                          {(field) => (
                            <div className="grid grid-cols-2 gap-4">
                              <Field>
                                <FieldLabel htmlFor={field.name}>
                                  Negotiation Timeout (seconds)
                                </FieldLabel>
                                <Input
                                  id={field.name}
                                  type="number"
                                  value={field.state.value}
                                  onBlur={field.handleBlur}
                                  onChange={(e) =>
                                    field.handleChange(
                                      parseInt(e.target.value, 10) || 100,
                                    )
                                  }
                                  placeholder="100"
                                />
                              </Field>
                            </div>
                          )}
                        </form.Field>
                      ) : null
                    }
                  </form.Field>

                  <Separator />

                  {/* ─── Margin Rules (Trade only) ─── */}
                  <SectionHeading>Margin Rules</SectionHeading>
                  <div className="grid grid-cols-2 gap-4">
                    <form.Field name="minMarginPercent">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>Min Margin (%)</FieldLabel>
                          <Input
                            id={field.name}
                            value={field.state.value ?? ""}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="e.g. 5"
                          />
                        </Field>
                      )}
                    </form.Field>
                    <form.Field name="minMarginAmount">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>Min Margin (৳)</FieldLabel>
                          <Input
                            id={field.name}
                            value={field.state.value ?? ""}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder="e.g. 50"
                          />
                        </Field>
                      )}
                    </form.Field>
                  </div>

                  <Separator />

                  {/* ─── Pack Return & Deposit (Trade only) ─── */}
                  <SectionHeading>Pack Return & Deposit</SectionHeading>
                  <form.Field name="isPackReturnRequired">
                    {(field) => (
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <FieldLabel htmlFor={field.name} className="text-sm font-medium">
                            Pack Return Required
                          </FieldLabel>
                          <p className="text-xs text-muted-foreground">
                            Customer must return empty pack (e.g. gas cylinder, reusable sack)
                          </p>
                        </div>
                        <Switch
                          id={field.name}
                          checked={field.state.value}
                          onCheckedChange={field.handleChange}
                        />
                      </div>
                    )}
                  </form.Field>
                  <form.Field name="isPackReturnRequired">
                    {(packReturnField) =>
                      packReturnField.state.value ? (
                        <form.Field name="packDepositAmount">
                          {(field) => (
                            <div className="grid grid-cols-2 gap-4">
                              <Field>
                                <FieldLabel htmlFor={field.name}>
                                  Pack Deposit Amount (৳)
                                </FieldLabel>
                                <Input
                                  id={field.name}
                                  value={field.state.value ?? ""}
                                  onBlur={field.handleBlur}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  placeholder="e.g. 200"
                                />
                              </Field>
                            </div>
                          )}
                        </form.Field>
                      ) : null
                    }
                  </form.Field>
                </>
              ) : null
            }
          </form.Field>

          {/* ─── Additional Details ─── */}
          <SectionHeading>Additional Details</SectionHeading>
          <div className="grid grid-cols-3 gap-4">
            <form.Field name="origin">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Origin</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Bangladesh"
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="shelfLife">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Shelf Life</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="6 months"
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="sortOrder">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Sort Order</FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(parseInt(e.target.value, 10) || 0)
                    }
                    placeholder="0"
                  />
                </Field>
              )}
            </form.Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="care">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Care</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Store in cool place"
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="packagingNote">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Packaging Note</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Sealed packaging"
                  />
                </Field>
              )}
            </form.Field>
          </div>
          <form.Field name="note">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Note</FieldLabel>
                <Textarea
                  id={field.name}
                  value={field.state.value ?? ""}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </Field>
            )}
          </form.Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Update Variant" : "Add Variant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
