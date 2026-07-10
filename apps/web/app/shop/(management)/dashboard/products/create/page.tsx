"use client";

import { ArrowLeft, ChevronDown, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StepBrandVariant } from "@/components/products/step-brand-variant";
import { StepClassification } from "@/components/products/step-classification";
import { StepPricing } from "@/components/products/step-pricing";
import { StepRules } from "@/components/products/step-rules";
import { StepStockVisibility } from "@/components/products/step-stock-visibility";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateProductOptions, useCreateShopProduct } from "@/hooks/use-shop-products-api";

// ── Form State ──
export type CreateProductFormState = {
  // Step 1-2
  typeId?: number;
  categoryId?: number;
  subCategoryId?: number;
  coreProductId?: number;
  // Step 3
  brandIds: number[];
  variantSelections: Array<{ variantOptionId: number; brandId: number }>;
  // Step 4
  pricing: Array<{ variantOptionId: number; brandId: number; retailPrice: string }>;
  // Step 5
  isReturnablePack: boolean;
  expiryEnabled: boolean;
  damageControlEnabled: boolean;
  stockTrackingEnabled: boolean;
  trackingType: "none" | "batch" | "serial";
  // Step 6
  openingStock: Array<{ variantOptionId: number; brandId: number; quantity: number }>;
  // Step 7-8
  displayName: string;
  shortNote: string;
  status: "active" | "inactive" | "draft";
};

const INITIAL_STATE: CreateProductFormState = {
  brandIds: [],
  variantSelections: [],
  pricing: [],
  isReturnablePack: false,
  expiryEnabled: false,
  damageControlEnabled: false,
  stockTrackingEnabled: true,
  trackingType: "none",
  openingStock: [],
  displayName: "",
  shortNote: "",
  status: "active",
};

export default function CreateProductPage() {
  const router = useRouter();
  const [form, setForm] = useState<CreateProductFormState>(INITIAL_STATE);

  const { data: options, isLoading: optionsLoading } = useCreateProductOptions({
    typeId: form.typeId,
    categoryId: form.categoryId,
    subCategoryId: form.subCategoryId,
  });

  const createMutation = useCreateShopProduct();

  const update = (patch: Partial<CreateProductFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const canSubmit = !!(
    form.typeId &&
    form.categoryId &&
    form.coreProductId &&
    form.brandIds.length > 0 &&
    form.variantSelections.length > 0 &&
    form.pricing.length > 0
  );

  const handleSubmit = async (asDraft = false) => {
    if (!form.coreProductId || !form.categoryId) {
      toast.error("Missing required fields");
      return;
    }
    try {
      await createMutation.mutateAsync({
        coreProductId: form.coreProductId,
        categoryId: form.categoryId,
        subCategoryId: form.subCategoryId,
        brandIds: form.brandIds,
        variantSelections: form.variantSelections,
        pricing: form.pricing,
        isReturnablePack: form.isReturnablePack,
        expiryEnabled: form.expiryEnabled,
        damageControlEnabled: form.damageControlEnabled,
        stockTrackingEnabled: form.stockTrackingEnabled,
        trackingType: form.trackingType,
        openingStock: form.openingStock,
        displayName: form.displayName || undefined,
        shortNote: form.shortNote || undefined,
        status: asDraft ? "draft" : form.status,
      });
      router.push("/dashboard/products");
    } catch { /* error handled by mutation hook */ }
  };

  return (
    <div className="w-full pb-12">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8 sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-4 -mx-2 px-2 border-b">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/products">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add new product</h1>
            <p className="text-sm text-muted-foreground">Configure a new product for your store</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Action
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleSubmit(false)} disabled={!canSubmit}>
              ✅ Create Product
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSubmit(true)}>
              <Save className="h-4 w-4 mr-2" /> Save Draft
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── All Sections on One Page ── */}
      <div className="space-y-8">
        {/* Section 1+2: Classification & Core Identity */}
        <section className="border rounded-xl p-6 bg-card">
          <StepClassification form={form} update={update} options={options} loading={optionsLoading} />
        </section>

        {/* Section 3: Brand & Variants */}
        <section className="border rounded-xl p-6 bg-card">
          <StepBrandVariant form={form} update={update} options={options} />
        </section>

        {/* Section 4: Pricing */}
        {form.variantSelections.length > 0 && (
          <section className="border rounded-xl p-6 bg-card">
            <StepPricing form={form} update={update} options={options} />
          </section>
        )}

        {/* Section 5: Rules */}
        <section className="border rounded-xl p-6 bg-card">
          <StepRules form={form} update={update} />
        </section>

        {/* Section 6+7+8: Stock, Customization & Visibility */}
        <section className="border rounded-xl p-6 bg-card">
          <StepStockVisibility form={form} update={update} options={options} />
        </section>

        {/* ── Bottom Actions ── */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Link href="/dashboard/products">
            <Button variant="outline">❌ Cancel</Button>
          </Link>
          <Button variant="outline" onClick={() => handleSubmit(true)} disabled={createMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Save Draft
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={createMutation.isPending || !canSubmit}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            ✅ Create Product
          </Button>
        </div>
      </div>
    </div>
  );
}
