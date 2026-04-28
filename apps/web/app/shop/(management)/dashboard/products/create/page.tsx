"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCreateProductOptions, useCreateShopProduct } from "@/hooks/use-shop-products-api";
import { StepClassification } from "@/components/products/step-classification";
import { StepBrandVariant } from "@/components/products/step-brand-variant";
import { StepPricing } from "@/components/products/step-pricing";
import { StepRules } from "@/components/products/step-rules";
import { StepStockVisibility } from "@/components/products/step-stock-visibility";

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
  trackingType: "none",
  openingStock: [],
  displayName: "",
  shortNote: "",
  status: "active",
};

const STEPS = [
  { title: "Classification", desc: "Type → Category → SubCategory → Core Identity" },
  { title: "Brand & Variants", desc: "Select brands and variant options" },
  { title: "Pricing", desc: "Set retail price per brand × variant" },
  { title: "Rules & Settings", desc: "Pack return, tracking, expiry" },
  { title: "Stock & Visibility", desc: "Opening stock, display name, status" },
];

export default function CreateProductPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CreateProductFormState>(INITIAL_STATE);

  const { data: options, isLoading: optionsLoading } = useCreateProductOptions({
    typeId: form.typeId,
    categoryId: form.categoryId,
    subCategoryId: form.subCategoryId,
  });

  const createMutation = useCreateShopProduct();

  const update = (patch: Partial<CreateProductFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const canNext = (): boolean => {
    switch (step) {
      case 0: return !!(form.typeId && form.categoryId && form.coreProductId);
      case 1: return form.brandIds.length > 0 && form.variantSelections.length > 0;
      case 2: return form.pricing.length > 0;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
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
        trackingType: form.trackingType,
        openingStock: form.openingStock,
        displayName: form.displayName || undefined,
        shortNote: form.shortNote || undefined,
        status: form.status,
      });
      router.push("/dashboard/products");
    } catch { /* error handled by mutation hook */ }
  };

  const handleSaveDraft = async () => {
    update({ status: "draft" });
    await handleSubmit();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/products">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Create Product</h1>
            <p className="text-sm text-muted-foreground">Configure a new product for your store</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={createMutation.isPending}>
          <Save className="h-4 w-4 mr-1" /> Save Draft
        </Button>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center flex-1">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors w-full ${
                i === step ? "bg-primary text-primary-foreground" :
                i < step ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
              }`}
              onClick={() => i < step && setStep(i)}
              style={{ cursor: i < step ? "pointer" : "default" }}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-current shrink-0">
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="hidden md:inline truncate">{s.title}</span>
            </div>
            {i < STEPS.length - 1 && <div className="w-2 h-px bg-gray-300 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-1">{STEPS[step].title}</h2>
          <p className="text-sm text-muted-foreground mb-6">{STEPS[step].desc}</p>

          {step === 0 && (
            <StepClassification form={form} update={update} options={options} loading={optionsLoading} />
          )}
          {step === 1 && (
            <StepBrandVariant form={form} update={update} options={options} />
          )}
          {step === 2 && (
            <StepPricing form={form} update={update} options={options} />
          )}
          {step === 3 && (
            <StepRules form={form} update={update} />
          )}
          {step === 4 && (
            <StepStockVisibility form={form} update={update} options={options} />
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={createMutation.isPending || !canNext()}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Create Product
          </Button>
        )}
      </div>
    </div>
  );
}
