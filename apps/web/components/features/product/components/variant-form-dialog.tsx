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
import {
  ORDER_UNITS,
  PACK_TYPES,
  variantFormSchema,
} from "@/schema/variant.schema";
import { useBrands } from "@/hooks/use-brands";
import { client } from "@/utils/orpc";

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
  /** If set, locks the variant type selector to this value (product already has variants of this type) */
  lockedVariantType?: "trade" | "retail" | null;
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

function BrandField({ form }: { form: any }) {
  const { data: brands = [] } = useBrands();
  return (
    <form.Field name="brandId">
      {(field: any) => (
        <Field>
          <FieldLabel>Brand</FieldLabel>
          <Select
            value={field.state.value?.toString() || "none"}
            onValueChange={(v: string) =>
              field.handleChange(
                v === "none" ? undefined : parseInt(v, 10),
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No brand</SelectItem>
              {brands.map((brand: any) => (
                <SelectItem key={brand.id} value={brand.id.toString()}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </form.Field>
  );
}

/** Get measurement unit based on pack type */
function getMeasurementUnit(packType?: string): { label: string; short: string } {
  const liquidTypes = ["bottle", "can", "jar"];
  if (packType && liquidTypes.includes(packType)) {
    return { label: "Volume (L)", short: "L" };
  }
  return { label: "Weight (kg)", short: "kg" };
}

/** Auto-generate unit label from pack type and weight */
function generateUnitLabel(packType: string | undefined, weightKg: string): string {
  if (!weightKg || !packType) return "";
  const packLabel = PACK_TYPES.find((p) => p.value === packType)?.label ?? packType;
  const unit = getMeasurementUnit(packType).short;
  return `${packLabel} (${weightKg} ${unit})`;
}

/** Auto-generate SKU: e.g. CTN-50KG-T-A7X3 */
function generateSku(packType: string | undefined, weightKg: string, variantType: string | undefined): string {
  const packCode: Record<string, string> = {
    sack: "SCK", carton: "CTN", packet: "PKT", loose: "LSE",
    bottle: "BTL", can: "CAN", jar: "JAR", pouch: "PCH", box: "BOX",
  };
  const pt = packCode[packType || ""] || "VAR";
  const wt = weightKg ? `${weightKg}KG` : "0KG";
  const vt = variantType === "trade" ? "T" : variantType === "retail" ? "R" : "X";
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${pt}-${wt}-${vt}-${rand}`;
}

export function VariantFormDialog({
  productId = null,
  variant = null,
  draftInitial = null,
  lockedVariantType = null,
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
      brandId: source?.brandId ?? (undefined as number | undefined),
      variantType:
        (source?.variantType as "trade" | "retail" | undefined) ?? lockedVariantType ?? undefined,
      packType: (source?.packType as string | undefined) ?? undefined,
      weightKg: source?.weightKg ?? "",
      innerPackSizeKg: source?.innerPackSizeKg ?? "",
      pricingType: source?.pricingType ?? "per_unit",
      price: source?.price ?? "",
      orderMin: source?.orderMin ?? "1",
      orderMax: source?.orderMax ?? "",
      orderIncrement: source?.orderIncrement ?? "1",
      orderUnit: source?.orderUnit ?? "piece",
      isActive: source?.isActive ?? true,
      isOpenOrderAllowed: source?.isOpenOrderAllowed ?? false,
      negotiationTimeoutSec: source?.negotiationTimeoutSec ?? 100,
      minMarginPercent: source?.minMarginPercent ?? "",
      minMarginAmount: source?.minMarginAmount ?? "",
      isPackReturnRequired: source?.isPackReturnRequired ?? false,
      packDepositAmount: source?.packDepositAmount ?? "",
      origin: source?.origin ?? "",
      shelfLife: source?.shelfLife ?? "",
      note: source?.note ?? "",
      sortOrder: source?.sortOrder ?? 0,
    },
    validators: {
      // @ts-expect-error
      onSubmit: variantFormSchema,
    },
    onSubmit: async ({ value }) => {
      // Auto-calculate derived fields
      const isLoose = value.packType === "loose";
      const effectiveWeightKg = isLoose ? "0" : value.weightKg;
      const autoUnitLabel = value.unitLabel || (isLoose ? "Loose" : generateUnitLabel(value.packType, effectiveWeightKg));
      const totalW = Number(effectiveWeightKg) || 0;
      const innerW = Number(value.innerPackSizeKg) || 0;
      const autoPiecesPerUnit = innerW > 0 ? Math.floor(totalW / innerW) : undefined;

      const draftData = {
        sku: value.sku || generateSku(value.packType, effectiveWeightKg, value.variantType),
        unitLabel: autoUnitLabel,
        quantitySelectorLabel: autoUnitLabel,
        brandId: value.brandId || undefined,
        variantType: value.variantType || undefined,
        packType: value.packType || undefined,
        // Keep packagingType for DB compat — derive from packType
        packagingType: value.packType || "loose",
        weightKg: effectiveWeightKg,
        pieceWeightKg: isLoose ? undefined : (value.innerPackSizeKg || undefined),
        piecesPerUnit: autoPiecesPerUnit,
        // Fill redundant DB fields automatically
        sellUnit: value.packType
          ? PACK_TYPES.find((p) => p.value === value.packType)?.label
          : undefined,
        packWeightKg: isLoose ? undefined : (effectiveWeightKg || undefined),
        innerPackSizeKg: isLoose ? undefined : (value.innerPackSizeKg || undefined),
        packCountInside: autoPiecesPerUnit,
        pricingType: value.pricingType,
        price: value.variantType === "trade" ? "0" : value.price,
        orderMin: value.orderMin || "1",
        orderMax: value.orderMax || undefined,
        orderIncrement: value.orderIncrement || "1",
        orderUnit: value.orderUnit || "piece",
        // Stock managed by warehouse, default to 0
        stockQuantity: 0,
        reorderLevel: 0,
        // Derive visibility from variant type
        orderType: value.variantType === "trade" ? "b2b" : value.variantType === "retail" ? "b2c" : undefined,
        visibilityRole: value.variantType === "trade" ? "shop_owner" : value.variantType === "retail" ? "consumer" : "all",
        isActive: value.isActive ?? true,
        isOpenOrderAllowed: value.isOpenOrderAllowed ?? false,
        negotiationTimeoutSec: value.negotiationTimeoutSec ?? 100,
        minMarginPercent: value.minMarginPercent || undefined,
        minMarginAmount: value.minMarginAmount || undefined,
        isPackReturnRequired: value.isPackReturnRequired ?? false,
        packDepositAmount: value.packDepositAmount || undefined,
        origin: value.origin || undefined,
        shelfLife: value.shelfLife || undefined,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl p-8">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEdit ? "Edit Variant" : "Add Variant"}
          </DialogTitle>
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
                    placeholder="Auto-generated"
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="unitLabel">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Unit Label</FieldLabel>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Sack (50 kg)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to auto-generate from pack info
                  </p>
                </Field>
              )}
            </form.Field>
            <BrandField form={form} />
          </div>

          <Separator />

          {/* ─── Type & Pack ─── */}
          <SectionHeading>Type & Pack</SectionHeading>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="variantType">
              {(field) => (
                <Field>
                  <FieldLabel>Variant Type</FieldLabel>
                  <Select
                    value={field.state.value ?? "none"}
                    onValueChange={(v) =>
                      field.handleChange(
                        v === "none" ? undefined : (v as "trade" | "retail"),
                      )
                    }
                    disabled={!!lockedVariantType}
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
                  {lockedVariantType && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Locked — this product already has {lockedVariantType === "trade" ? "Trade (B2B)" : "Retail (B2C)"} variants
                    </p>
                  )}
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <form.Subscribe selector={(state) => state.values.packType}>
              {(packType) => {
                const isLoose = packType === "loose";
                if (isLoose) return null;
                const mu = getMeasurementUnit(packType ?? undefined);
                return (
                  <form.Field name="weightKg">
                    {(field) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Total {mu.label} *</FieldLabel>
                          <Input
                            id={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder={mu.short === "L" ? "5" : "50"}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>
                );
              }}
            </form.Subscribe>
            <form.Subscribe selector={(state) => state.values.packType}>
              {(packType) => {
                const isLoose = packType === "loose";
                if (isLoose) return null;
                const mu = getMeasurementUnit(packType ?? undefined);
                return (
                  <form.Field name="innerPackSizeKg">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>
                          Inner Pack Size ({mu.short})
                        </FieldLabel>
                        <Input
                          id={field.name}
                          value={field.state.value ?? ""}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder={mu.short === "L" ? "e.g. 1" : "e.g. 5"}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Size of each inner pack (e.g. {mu.short === "L" ? "1L per bottle" : "5kg per pack"} inside a carton)
                        </p>
                      </Field>
                    )}
                  </form.Field>
                );
              }}
            </form.Subscribe>
          </div>

          {/* Auto-calculated pack info preview */}
          <form.Subscribe selector={(state) => ({
            w: state.values.weightKg,
            i: state.values.innerPackSizeKg,
            p: state.values.packType,
          })}>
            {({ w, i, p }) => {
              const isLoose = p === "loose";

              if (isLoose) {
                return (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-200">
                    <strong>Type:</strong> Loose — sold by unit (no weight required)
                  </div>
                );
              }

              const totalW = Number(w) || 0;
              if (totalW <= 0) return null;

              const packLabel = PACK_TYPES.find(pt => pt.value === p)?.label || "Unit";
              const mu = getMeasurementUnit(p ?? undefined);
              const unit = mu.short;

              const innerW = Number(i) || 0;
              const pieces = innerW > 0 ? Math.floor(totalW / innerW) : 0;
              if (pieces <= 0) {
                return (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-200">
                    <strong>Pack:</strong> {w}{unit} — {packLabel}
                  </div>
                );
              }
              return (
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-200">
                  <strong>Pack:</strong> {w}{unit} ({i}{unit} × {pieces} pcs) — {packLabel}
                </div>
              );
            }}
          </form.Subscribe>

          <Separator />

          {/* ─── Pricing ─── */}
          <SectionHeading>Pricing</SectionHeading>
          <form.Field name="variantType">
            {(variantTypeField) => {
              const isTrade = variantTypeField.state.value === "trade";
              return (
                <>
                  {isTrade && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span>
                        <strong>Trade (B2B) variant</strong> — Price is set by shop owners via their inventory. Admin cannot set the selling price for store products.
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <form.Field name="pricingType">
                      {(field) => (
                        <Field>
                          <FieldLabel>Pricing Type</FieldLabel>
                          <Select
                            value={field.state.value}
                            onValueChange={field.handleChange}
                            disabled={isTrade}
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
                        const isInvalid =
                          !isTrade && field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              Price (৳) {!isTrade && "*"}
                            </FieldLabel>
                            <Input
                              id={field.name}
                              value={isTrade ? "" : field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder={isTrade ? "Set by shop owner" : "0.00"}
                              disabled={isTrade}
                              className={isTrade ? "bg-muted cursor-not-allowed" : ""}
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                            {isTrade && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Shop owners set their own retail price
                              </p>
                            )}
                          </Field>
                        );
                      }}
                    </form.Field>
                  </div>
                </>
              );
            }}
          </form.Field>

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

          {/* ─── Status ─── */}
          <form.Field name="isActive">
            {(field) => (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <FieldLabel
                    htmlFor={field.name}
                    className="text-sm font-medium"
                  >
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

          {/* ─── Trade-Only Sections ─── */}
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
                          <FieldLabel
                            htmlFor={field.name}
                            className="text-sm font-medium"
                          >
                            Allow Open Orders
                          </FieldLabel>
                          <p className="text-xs text-muted-foreground">
                            Broadcast this variant to eligible sellers for
                            competitive pricing
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
                          <FieldLabel htmlFor={field.name}>
                            Min Margin (%)
                          </FieldLabel>
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
                          <FieldLabel htmlFor={field.name}>
                            Min Margin (৳)
                          </FieldLabel>
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
                          <FieldLabel
                            htmlFor={field.name}
                            className="text-sm font-medium"
                          >
                            Pack Return Required
                          </FieldLabel>
                          <p className="text-xs text-muted-foreground">
                            Customer must return empty pack (e.g. gas cylinder,
                            reusable sack)
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
                                  onChange={(e) =>
                                    field.handleChange(e.target.value)
                                  }
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

          <Separator />

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
