"use client";

import type {
  OfferTemplate,
  OfferTemplateProduct,
} from "@bikalpo-project/db/schema";
import {
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  Gift,
  Layers3,
  Loader2,
  Package,
  Plus,
  Search,
  Settings2,
  ShoppingBasket,
  Store,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminProducts } from "@/hooks/use-admin-data";
import { cn } from "@/lib/utils";
import { client } from "@/utils/orpc";

type CatalogVariant = {
  id: number;
  sku: string | null;
  price: string | number;
  unitLabel: string;
  sellUnit: string | null;
  packType: string | null;
  weightKg: string | number;
  color: string | null;
  size: string | null;
  variantType: string | null;
  isActive: boolean;
  brand?: { id: number; name: string } | null;
};

type CatalogProduct = {
  id: number;
  name: string;
  price: string | number;
  categoryId: number;
  category?: { id: number; name: string } | null;
  brand?: { id: number; name: string } | null;
  variants?: CatalogVariant[];
  status?: string | null;
  creatorSource?: string | null;
  createdById?: string | null;
  createdByWarehouseId?: string | null;
};

function getActiveVariants(product: CatalogProduct) {
  return product.variants?.filter((variant) => variant.isActive) ?? [];
}

function getVariantName(variant: CatalogVariant) {
  return [
    variant.unitLabel || variant.sellUnit,
    variant.color,
    variant.size ? `Size ${variant.size}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

type OfferType = "discount" | "cashback" | "combo";
type BenefitType =
  | "free_product"
  | "percentage_discount"
  | "fixed_price"
  | "fixed_discount"
  | "cashback_amount";
type TemplateStatus = "active" | "draft" | "disabled";
type ApplyOn = "product" | "category" | "full_store";
type ApplyLocation =
  | "all_stores"
  | "selected_stores"
  | "warehouse"
  | "online_store";

type FormState = {
  name: string;
  description: string;
  type: OfferType;
  comboRule: "buy_x_get_y" | "fixed_discount";
  benefitType: BenefitType;
  benefitValue: string;
  applyOn: ApplyOn;
  targetKey: string;
  targetRetailers: boolean;
  targetWholesalers: boolean;
  applyLocation: ApplyLocation;
  minimumOrderAmount: string;
  maxUsePerCustomer: string;
  totalUsageLimit: string;
  startDate: string;
  endDate: string;
  status: TemplateStatus;
};

const EMPTY_STATE: FormState = {
  name: "",
  description: "",
  type: "combo",
  comboRule: "buy_x_get_y",
  benefitType: "free_product",
  benefitValue: "",
  applyOn: "product",
  targetKey: "",
  targetRetailers: true,
  targetWholesalers: true,
  applyLocation: "all_stores",
  minimumOrderAmount: "0",
  maxUsePerCustomer: "1",
  totalUsageLimit: "",
  startDate: "",
  endDate: "",
  status: "draft",
};

const offerTypes = [
  {
    value: "discount" as const,
    title: "Discount",
    icon: Tag,
  },
  {
    value: "cashback" as const,
    title: "Cashback",
    icon: Banknote,
  },
  {
    value: "combo" as const,
    title: "Combo",
    icon: Gift,
  },
];

const locations: Array<{ value: ApplyLocation; label: string }> = [
  { value: "all_stores", label: "All stores" },
  { value: "selected_stores", label: "Selected stores" },
  { value: "warehouse", label: "Warehouse" },
  { value: "online_store", label: "Online store" },
];

function toDateInput(value: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toIsoDate(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function toNumber(value: string, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function initialState(template: OfferTemplate | null): FormState {
  if (!template) return { ...EMPTY_STATE };
  const firstTarget = template.targetSelection[0];
  return {
    name: template.name,
    description: template.description ?? "",
    type: template.type as OfferType,
    comboRule:
      (template.comboRule as FormState["comboRule"] | null) ?? "buy_x_get_y",
    benefitType: template.benefitType as BenefitType,
    benefitValue:
      template.benefitValue == null ? "" : String(template.benefitValue),
    applyOn: template.applyOn as ApplyOn,
    targetKey: firstTarget ? `${firstTarget.kind}:${firstTarget.id}` : "",
    targetRetailers: template.targetRetailers,
    targetWholesalers: template.targetWholesalers,
    applyLocation:
      (template.applyLocations[0] as ApplyLocation | undefined) ?? "all_stores",
    minimumOrderAmount: String(template.minimumOrderAmount),
    maxUsePerCustomer: String(template.maxUsePerCustomer),
    totalUsageLimit: template.totalUsageLimit
      ? String(template.totalUsageLimit)
      : "",
    startDate: toDateInput(template.startDate),
    endDate: toDateInput(template.endDate),
    status:
      template.status === "active" || template.status === "disabled"
        ? template.status
        : "draft",
  };
}

interface OfferTemplateFormProps {
  template: OfferTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => unknown;
}

export function OfferTemplateForm({
  template,
  open,
  onOpenChange,
  onSaved,
}: OfferTemplateFormProps) {
  const productsQuery = useAdminProducts();
  const allProducts = (productsQuery.data ?? []) as CatalogProduct[];
  const products = useMemo(
    () =>
      allProducts.filter(
        (product) =>
          product.status !== "inactive" &&
          getActiveVariants(product).length > 0,
      ),
    [allProducts],
  );
  const [form, setForm] = useState<FormState>(() => initialState(template));
  const [buySlots, setBuySlots] = useState<Array<OfferTemplateProduct | null>>([
    null,
  ]);
  const [getSlots, setGetSlots] = useState<Array<OfferTemplateProduct | null>>([
    null,
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initialState(template));
    setBuySlots(
      template?.buyProducts.length ? [...template.buyProducts] : [null],
    );
    setGetSlots(
      template?.getProducts.length ? [...template.getProducts] : [null],
    );
  }, [open, template]);

  const categories = useMemo(() => {
    const map = new Map<number, string>();
    for (const product of products) {
      if (product.category) map.set(product.category.id, product.category.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [products]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const selectType = (type: OfferType) => {
    setForm((current) => ({
      ...current,
      type,
      benefitType:
        type === "cashback"
          ? "cashback_amount"
          : type === "discount"
            ? "percentage_discount"
            : "free_product",
      benefitValue: type === "combo" ? "" : current.benefitValue,
    }));
  };

  const submit = async (statusOverride?: TemplateStatus) => {
    const buyProducts = buySlots.filter((item): item is OfferTemplateProduct =>
      Boolean(item),
    );
    const getProducts = getSlots.filter((item): item is OfferTemplateProduct =>
      Boolean(item),
    );
    const status = statusOverride ?? form.status;

    if (form.name.trim().length < 3) {
      toast.error("Enter an offer name with at least 3 characters");
      return;
    }
    if (!form.targetRetailers && !form.targetWholesalers) {
      toast.error("Select at least one target user group");
      return;
    }
    if (
      form.type === "combo" &&
      form.comboRule === "buy_x_get_y" &&
      (buyProducts.length === 0 || getProducts.length === 0)
    ) {
      toast.error("Select at least one Buy product and one Get product");
      return;
    }
    if (
      form.type === "combo" &&
      form.comboRule === "buy_x_get_y" &&
      [...buyProducts, ...getProducts].some((item) => !item.variantId)
    ) {
      toast.error("Select a sellable variant for every Buy and Get product");
      return;
    }
    if (
      form.benefitType !== "free_product" &&
      toNumber(form.benefitValue) <= 0
    ) {
      toast.error("Enter a benefit value greater than zero");
      return;
    }
    if (
      form.startDate &&
      form.endDate &&
      new Date(form.endDate) <= new Date(form.startDate)
    ) {
      toast.error("End date must be after the start date");
      return;
    }
    let targetSelection: Array<{
      id: number;
      label: string;
      kind: "product" | "category";
    }> = [];
    if (form.type === "combo" && form.comboRule === "buy_x_get_y") {
      targetSelection = buyProducts.map((item) => ({
        id: item.productId,
        label: item.variantName
          ? `${item.name} — ${[item.brandName, item.variantName]
              .filter(Boolean)
              .join(" · ")}`
          : item.name,
        kind: "product" as const,
      }));
    } else if (form.targetKey) {
      const [kind, idText] = form.targetKey.split(":") as [
        "product" | "category",
        string,
      ];
      const id = Number(idText);
      const label =
        kind === "product"
          ? products.find((item) => item.id === id)?.name
          : categories.find((item) => item.id === id)?.name;
      if (label) targetSelection = [{ id, label, kind }];
    }

    const payload = {
      code: template?.code,
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      comboRule: form.type === "combo" ? form.comboRule : null,
      buyProducts,
      getProducts,
      benefitType: form.benefitType,
      benefitValue:
        form.benefitType === "free_product"
          ? null
          : toNumber(form.benefitValue),
      applyOn: form.applyOn,
      targetSelection,
      targetRetailers: form.targetRetailers,
      targetWholesalers: form.targetWholesalers,
      applyLocations: [form.applyLocation],
      minimumOrderAmount: toNumber(form.minimumOrderAmount),
      maxUsePerCustomer: Math.max(1, toNumber(form.maxUsePerCustomer, 1)),
      totalUsageLimit: form.totalUsageLimit
        ? Math.max(1, toNumber(form.totalUsageLimit, 1))
        : null,
      startDate: toIsoDate(form.startDate),
      endDate: toIsoDate(form.endDate),
      status,
    };

    try {
      setSaving(true);
      if (template) {
        await client.adminOfferTemplate.update({
          id: template.id,
          data: payload,
        });
        toast.success("Offer template updated");
      } else {
        await client.adminOfferTemplate.create(payload);
        toast.success(
          status === "active"
            ? "Offer template created and activated"
            : "Offer template saved",
        );
      }
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save template",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent
        showCloseButton={!saving}
        className="flex max-h-[94vh] grid-rows-none flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers3 className="size-5" />
            </span>
            <DialogTitle className="text-lg">
              {template ? "Edit offer structure" : "Create offer structure"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Configure a reusable offer template for retailers and wholesalers.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="thin-scrollbar flex-1 overflow-y-auto bg-background px-5 sm:px-7">
          <div className="mx-auto max-w-4xl">
            <FormSection icon={Tag} title="Basic information">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="template-name">Offer name *</Label>
                  <Input
                    id="template-name"
                    value={form.name}
                    onChange={(event) => setField("name", event.target.value)}
                    placeholder="e.g. Weekend Buy 2 Get 1"
                    maxLength={255}
                  />
                  <p className="text-xs text-muted-foreground">
                    A searchable offer code is generated automatically.
                  </p>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="template-description">
                    Offer description
                  </Label>
                  <Textarea
                    id="template-description"
                    value={form.description}
                    onChange={(event) =>
                      setField("description", event.target.value)
                    }
                    placeholder="Explain when and how store owners should use this template…"
                    rows={3}
                  />
                </div>
              </div>

              <div className="mt-5">
                <Label>Offer type</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {offerTypes.map((type) => {
                    const Icon = type.icon;
                    const selected = form.type === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => selectType(type.value)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors hover:border-zinc-400",
                          selected &&
                            "border-primary bg-primary/5 ring-1 ring-primary/20",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
                            selected && "bg-primary text-primary-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="flex items-center gap-1.5 text-sm font-semibold">
                          {type.title}
                          {selected ? (
                            <Check className="size-3.5 text-primary" />
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </FormSection>

            {form.type === "combo" ? (
              <FormSection icon={ShoppingBasket} title="Benefit logic">
                <div className="mb-5 grid gap-2 sm:grid-cols-2">
                  <ChoiceCard
                    selected={form.comboRule === "buy_x_get_y"}
                    title="Buy X Get Y"
                    onClick={() => {
                      setField("comboRule", "buy_x_get_y");
                      setField("benefitType", "free_product");
                    }}
                  />
                  <ChoiceCard
                    selected={form.comboRule === "fixed_discount"}
                    title="Fixed discount combo"
                    onClick={() => {
                      setField("comboRule", "fixed_discount");
                      setField("benefitType", "fixed_discount");
                    }}
                  />
                </div>

                {form.comboRule === "buy_x_get_y" ? (
                  <div className="space-y-5">
                    <ProductGroup
                      kind="buy"
                      title="Buy product"
                      slots={buySlots}
                      products={products}
                      loading={productsQuery.isLoading}
                      onChange={setBuySlots}
                    />

                    <div className="flex items-center gap-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      <ArrowRight className="size-4" /> Customer receives
                      <span className="h-px flex-1 bg-border" />
                    </div>

                    <ProductGroup
                      kind="get"
                      title="Get product"
                      slots={getSlots}
                      products={products}
                      loading={productsQuery.isLoading}
                      onChange={setGetSlots}
                    />

                    <div className="border-t pt-5">
                      <Label>Discount type</Label>
                      <RadioGroup
                        value={form.benefitType}
                        onValueChange={(value) =>
                          setField("benefitType", value as BenefitType)
                        }
                        className="mt-2 grid gap-2 sm:grid-cols-3"
                      >
                        <RadioChoice
                          value="free_product"
                          label="Free product"
                        />
                        <RadioChoice
                          value="percentage_discount"
                          label="Percentage discount"
                        />
                        <RadioChoice value="fixed_price" label="Fixed price" />
                      </RadioGroup>
                      {form.benefitType !== "free_product" ? (
                        <div className="mt-4 max-w-sm space-y-1.5">
                          <Label htmlFor="benefit-value">
                            {form.benefitType === "percentage_discount"
                              ? "Discount percentage"
                              : "Fixed Get price"}
                          </Label>
                          <div className="relative">
                            {form.benefitType === "fixed_price" ? (
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                ৳
                              </span>
                            ) : null}
                            <Input
                              id="benefit-value"
                              type="number"
                              min="0"
                              max={
                                form.benefitType === "percentage_discount"
                                  ? "100"
                                  : undefined
                              }
                              value={form.benefitValue}
                              onChange={(event) =>
                                setField("benefitValue", event.target.value)
                              }
                              className={
                                form.benefitType === "fixed_price" ? "pl-8" : ""
                              }
                              placeholder={
                                form.benefitType === "percentage_discount"
                                  ? "50"
                                  : "100"
                              }
                            />
                            {form.benefitType === "percentage_discount" ? (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                %
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <BenefitValueField
                    label="Fixed discount amount"
                    prefix="৳"
                    value={form.benefitValue}
                    onChange={(value) => setField("benefitValue", value)}
                    placeholder="50"
                  />
                )}
              </FormSection>
            ) : (
              <FormSection icon={Banknote} title="Benefit logic">
                {form.type === "discount" ? (
                  <>
                    <RadioGroup
                      value={form.benefitType}
                      onValueChange={(value) =>
                        setField("benefitType", value as BenefitType)
                      }
                      className="mb-4 grid gap-2 sm:grid-cols-2"
                    >
                      <RadioChoice
                        value="percentage_discount"
                        label="Percentage"
                      />
                      <RadioChoice
                        value="fixed_discount"
                        label="Fixed amount"
                      />
                    </RadioGroup>
                    <BenefitValueField
                      label={
                        form.benefitType === "percentage_discount"
                          ? "Discount percentage"
                          : "Discount amount"
                      }
                      prefix={
                        form.benefitType === "percentage_discount"
                          ? undefined
                          : "৳"
                      }
                      suffix={
                        form.benefitType === "percentage_discount"
                          ? "%"
                          : undefined
                      }
                      value={form.benefitValue}
                      onChange={(value) => setField("benefitValue", value)}
                      placeholder="10"
                    />
                  </>
                ) : (
                  <BenefitValueField
                    label="Cashback amount"
                    prefix="৳"
                    value={form.benefitValue}
                    onChange={(value) => setField("benefitValue", value)}
                    placeholder="100"
                  />
                )}
              </FormSection>
            )}

            <FormSection icon={Store} title="Applicable scope">
              <RadioGroup
                value={form.applyOn}
                onValueChange={(value) => {
                  setField("applyOn", value as ApplyOn);
                  setField("targetKey", "");
                }}
                className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
              >
                <RadioChoice value="product" label="Product" />
                <RadioChoice value="category" label="Category" />
                <RadioChoice value="full_store" label="Full store" />
              </RadioGroup>

              <div className="mt-4 space-y-1.5">
                <Label>Target selection</Label>
                {form.type === "combo" && form.comboRule === "buy_x_get_y" ? (
                  <div className="flex items-start gap-2 py-2 text-sm text-muted-foreground">
                    <ArrowRight className="mt-0.5 size-4 shrink-0" />
                    Target products are derived from the Buy product slots
                    above.
                  </div>
                ) : form.applyOn === "full_store" ? (
                  <div className="flex items-start gap-2 py-2 text-sm text-muted-foreground">
                    <ArrowRight className="mt-0.5 size-4 shrink-0" />
                    No target selection is required for a full-store template.
                  </div>
                ) : (
                  <Select
                    value={form.targetKey}
                    onValueChange={(value) => setField("targetKey", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={`Select ${form.applyOn}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {form.applyOn === "product"
                        ? products.map((product) => (
                            <SelectItem
                              key={product.id}
                              value={`product:${product.id}`}
                            >
                              {product.name}
                            </SelectItem>
                          ))
                        : categories.map((category) => (
                            <SelectItem
                              key={category.id}
                              value={`category:${category.id}`}
                            >
                              {category.name}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </FormSection>

            <FormSection icon={Users} title="Target users">
              <div className="grid gap-2 sm:grid-cols-2">
                <CheckboxCard
                  checked={form.targetRetailers}
                  title="Retailer"
                  onChange={(checked) => setField("targetRetailers", checked)}
                />
                <CheckboxCard
                  checked={form.targetWholesalers}
                  title="Wholesaler"
                  onChange={(checked) => setField("targetWholesalers", checked)}
                />
              </div>
            </FormSection>

            <FormSection icon={CalendarDays} title="Validity & location">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date">Start date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      setField("startDate", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end-date">End date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={form.endDate}
                    onChange={(event) =>
                      setField("endDate", event.target.value)
                    }
                  />
                </div>
              </div>
              <div className="mt-5">
                <Label>Apply location</Label>
                <RadioGroup
                  value={form.applyLocation}
                  onValueChange={(value) =>
                    setField("applyLocation", value as ApplyLocation)
                  }
                  className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                >
                  {locations.map((location) => (
                    <RadioChoice
                      key={location.value}
                      value={location.value}
                      label={location.label}
                    />
                  ))}
                </RadioGroup>
              </div>
            </FormSection>

            <FormSection icon={Settings2} title="Usage rules & limitations">
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField
                  label="Min order amount"
                  prefix="৳"
                  value={form.minimumOrderAmount}
                  onChange={(value) => setField("minimumOrderAmount", value)}
                  min="0"
                />
                <NumberField
                  label="Max usage per user"
                  value={form.maxUsePerCustomer}
                  onChange={(value) => setField("maxUsePerCustomer", value)}
                  min="1"
                />
                <NumberField
                  label="Total usage limit"
                  value={form.totalUsageLimit}
                  onChange={(value) => setField("totalUsageLimit", value)}
                  min="1"
                  placeholder="Optional"
                />
              </div>
            </FormSection>

            <FormSection icon={Check} title="Template status">
              <RadioGroup
                value={form.status}
                onValueChange={(value) =>
                  setField("status", value as TemplateStatus)
                }
                className="grid gap-2 sm:grid-cols-3"
              >
                <StatusChoice value="active" label="Active" tone="emerald" />
                <StatusChoice value="draft" label="Draft" tone="amber" />
                <StatusChoice value="disabled" label="Disabled" tone="zinc" />
              </RadioGroup>
            </FormSection>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t bg-background px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => submit("draft")}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}Save as
            draft
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={() => submit(form.status)}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {template
              ? "Save template"
              : form.status === "active"
                ? "Activate template"
                : form.status === "disabled"
                  ? "Save disabled"
                  : "Save template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Tag;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b py-6 first:pt-6 last:border-b-0 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
      <div className="flex items-start gap-3 lg:pt-0.5">
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ChoiceCard({
  selected,
  title,
  onClick,
}: {
  selected: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-background p-3 text-left text-sm font-semibold transition-colors hover:border-zinc-400",
        selected && "border-primary bg-primary/5 ring-1 ring-primary/20",
      )}
    >
      <span
        className={cn(
          "size-3.5 rounded-full border",
          selected && "border-[4px] border-primary",
        )}
      />
      {title}
    </button>
  );
}

function RadioChoice({ value, label }: { value: string; label: string }) {
  return (
    <Label
      htmlFor={`choice-${value}`}
      className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 font-normal transition-colors hover:border-zinc-400 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
    >
      <RadioGroupItem id={`choice-${value}`} value={value} />
      <span className="text-sm font-semibold">{label}</span>
    </Label>
  );
}

function CheckboxCard({
  checked,
  title,
  onChange,
}: {
  checked: boolean;
  title: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 font-normal transition-colors hover:border-zinc-400",
        checked && "border-primary bg-primary/5",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(Boolean(value))}
      />
      <span className="text-sm font-semibold">{title}</span>
    </Label>
  );
}

function StatusChoice({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "emerald" | "amber" | "zinc";
}) {
  const dot =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-zinc-400";
  return (
    <Label
      htmlFor={`status-${value}`}
      className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 font-normal transition-colors hover:border-zinc-400 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
    >
      <RadioGroupItem id={`status-${value}`} value={value} />
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className={`size-2 rounded-full ${dot}`} />
        {label}
      </span>
    </Label>
  );
}

function BenefitValueField({
  label,
  prefix,
  suffix,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="max-w-sm space-y-1.5">
      <Label htmlFor="benefit-amount">{label}</Label>
      <div className="relative">
        {prefix ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          id="benefit-amount"
          type="number"
          min="0"
          max={suffix === "%" ? "100" : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn(prefix && "pl-8", suffix && "pr-8")}
        />
        {suffix ? (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  min,
  placeholder = "0",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  min: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        {prefix ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          type="number"
          min={min}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn("font-mono tabular-nums", prefix && "pl-8")}
        />
      </div>
    </div>
  );
}

function ProductGroup({
  kind,
  title,
  slots,
  products,
  loading,
  onChange,
}: {
  kind: "buy" | "get";
  title: string;
  slots: Array<OfferTemplateProduct | null>;
  products: CatalogProduct[];
  loading: boolean;
  onChange: (slots: Array<OfferTemplateProduct | null>) => void;
}) {
  const update = (index: number, value: OfferTemplateProduct | null) =>
    onChange(
      slots.map((slot, slotIndex) => (slotIndex === index ? value : slot)),
    );
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-md",
              kind === "buy"
                ? "bg-blue-50 text-blue-700"
                : "bg-emerald-50 text-emerald-700",
            )}
          >
            {kind === "buy" ? (
              <ShoppingBasket className="size-4" />
            ) : (
              <Gift className="size-4" />
            )}
          </span>
          <h4 className="text-sm font-semibold">{title}</h4>
        </div>
        <Badge variant="outline" className="font-mono">
          {slots.length} slot{slots.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="divide-y border-y">
        {slots.map((slot, index) => (
          <ProductSlot
            key={`${kind}-${index}`}
            index={index}
            kind={kind}
            value={slot}
            products={products}
            loading={loading}
            onChange={(value) => update(index, value)}
            onRemove={
              slots.length > 1
                ? () =>
                    onChange(
                      slots.filter((_, slotIndex) => slotIndex !== index),
                    )
                : undefined
            }
          />
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 mt-2 text-muted-foreground hover:text-foreground"
        onClick={() => onChange([...slots, null])}
      >
        <Plus className="size-4" />
        Add another {kind} product
      </Button>
    </div>
  );
}

function ProductSlot({
  index,
  kind,
  value,
  products,
  loading,
  onChange,
  onRemove,
}: {
  index: number;
  kind: "buy" | "get";
  value: OfferTemplateProduct | null;
  products: CatalogProduct[];
  loading: boolean;
  onChange: (value: OfferTemplateProduct | null) => void;
  onRemove?: () => void;
}) {
  const [search, setSearch] = useState("");
  const [pendingProductId, setPendingProductId] = useState<number | null>(null);
  const pendingProduct = products.find(
    (product) => product.id === pendingProductId,
  );
  const pendingVariants = pendingProduct
    ? getActiveVariants(pendingProduct)
    : [];
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.category?.name.toLowerCase().includes(query) ||
          product.brand?.name.toLowerCase().includes(query) ||
          product.variants?.some((variant) =>
            [variant.brand?.name, variant.unitLabel, variant.sku].some(
              (label) => label?.toLowerCase().includes(query),
            ),
          ),
      )
      .slice(0, 6);
  }, [products, search]);
  const chooseProduct = (product: CatalogProduct) => {
    setPendingProductId(product.id);
    setSearch("");
  };
  const chooseVariant = (product: CatalogProduct, variant: CatalogVariant) => {
    const variantName = getVariantName(variant);
    onChange({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantName: variantName || `Variant ${variant.id}`,
      brandName: variant.brand?.name ?? product.brand?.name ?? undefined,
      sku: variant.sku,
      category: product.category?.name ?? "Uncategorized",
      regularPrice: String(variant.price),
      quantity: 1,
    });
    setPendingProductId(null);
  };
  return (
    <div className="py-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {kind} slot {String(index + 1).padStart(2, "0")}
        </span>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-10 text-muted-foreground hover:text-destructive sm:size-8"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
            <span className="sr-only">Remove product slot</span>
          </Button>
        ) : null}
      </div>
      {value ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {value.variantId ? "Selected variant" : "Variant required"}
            </p>
            <div className="flex items-center gap-3 py-1">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Package className="size-4 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {value.variantName
                    ? [value.brandName, value.variantName]
                        .filter(Boolean)
                        .join(" · ")
                    : value.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {value.variantName ? `${value.name} · ` : ""}
                  {value.category} · Regular price{" "}
                  <span className="font-mono">৳{value.regularPrice}</span>
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              min="1"
              value={value.quantity}
              onChange={(event) =>
                onChange({
                  ...value,
                  quantity: Math.max(1, Number(event.target.value) || 1),
                })
              }
              className="font-mono"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              setPendingProductId(value.variantId ? null : value.productId);
            }}
          >
            {value.variantId ? "Change" : "Select variant"}
          </Button>
        </div>
      ) : pendingProduct ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label>Select variant for {pendingProduct.name}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPendingProductId(null)}
            >
              Change product
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {pendingVariants.map((variant) => {
              const brandName =
                variant.brand?.name ?? pendingProduct.brand?.name;
              const variantName = getVariantName(variant);
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => chooseVariant(pendingProduct, variant)}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <span className="truncate text-sm font-semibold">
                    {[brandName, variantName || `Variant ${variant.id}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="shrink-0 font-mono text-xs">
                    ৳{variant.price}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="relative">
          <Label htmlFor={`${kind}-search-${index}`}>Product search</Label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`${kind}-search-${index}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                loading
                  ? "Loading products…"
                  : "Search product name or category"
              }
              disabled={loading}
              className="pl-9"
            />
          </div>
          {matches.length > 0 ? (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-popover">
              <div className="max-h-56 overflow-y-auto p-1">
                {matches.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => chooseProduct(product)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left hover:bg-muted"
                  >
                    <span>
                      <span className="block text-sm font-medium">
                        {product.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {product.category?.name ?? "Uncategorized"}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs">
                      {getActiveVariants(product).length} variant
                      {getActiveVariants(product).length === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
