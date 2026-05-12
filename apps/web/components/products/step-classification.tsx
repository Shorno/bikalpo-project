"use client";

import Image from "next/image";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequestSetupModal } from "./request-setup-modal";
import type { CreateProductFormState } from "@/app/shop/(management)/dashboard/products/create/page";

type Props = {
  form: CreateProductFormState;
  update: (patch: Partial<CreateProductFormState>) => void;
  options: any;
  loading: boolean;
};

export function StepClassification({ form, update, options, loading }: Props) {
  // Never unmount — just derive data from whatever options we have (previous or new).
  // The `loading` flag is now only used for a subtle spinner, not a full skeleton swap.
  const types = options?.types ?? [];
  const categories = options?.categories ?? [];
  const subCategories = options?.subCategories ?? [];
  const coreProducts = options?.coreProducts ?? [];

  return (
    <div className="space-y-8">
      {/* ── STEP 1: Product Classification ── */}
      <div className="space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b">
          <span className="text-lg">🧱</span>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Product Classification
            </h3>
            <p className="text-xs text-muted-foreground">Select type, category, and sub-category</p>
          </div>
        </div>

        {/* Type */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Product Type <span className="text-red-500">*</span>
          </Label>
          <Select
            value={form.typeId?.toString() ?? ""}
            onValueChange={(v) =>
              update({ typeId: Number(v), categoryId: undefined, subCategoryId: undefined, coreProductId: undefined })
            }
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {types.map((t: any) => (
                <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Category <span className="text-red-500">*</span>
          </Label>
          <Select
            value={form.categoryId?.toString() ?? ""}
            onValueChange={(v) =>
              update({ categoryId: Number(v), subCategoryId: undefined, coreProductId: undefined })
            }
            disabled={!form.typeId}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sub Category */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Sub Category</Label>
          <Select
            value={form.subCategoryId?.toString() ?? ""}
            onValueChange={(v) => update({ subCategoryId: Number(v), coreProductId: undefined })}
            disabled={!form.categoryId}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select sub category..." />
            </SelectTrigger>
            <SelectContent>
              {subCategories.map((s: any) => (
                <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Not found? Request Setup */}
        <div className="flex items-center gap-2 pt-1">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span className="text-sm text-muted-foreground">Not found?</span>
          <RequestSetupModal
            allowedTypes={["category", "sub_category"]}
            triggerLabel="+ Request Setup"
          />
        </div>
      </div>

      {/* ── STEP 2: Core Identity ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <span className="text-lg">⭐</span>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Core Product Identity
            </h3>
            <p className="text-xs text-muted-foreground">Select the core product you want to sell</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">
            Core Product <span className="text-red-500">*</span>
          </Label>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        {coreProducts.length === 0 && form.categoryId && !loading ? (
          <div className="text-sm text-muted-foreground p-4 bg-gray-50 rounded-lg border border-dashed text-center">
            No core products found for this category. Try a different category or request a new product setup.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {coreProducts.map((cp: any) => {
              const isSelected = form.coreProductId === cp.id;
              return (
                <div
                  key={cp.id}
                  onClick={() => update({ coreProductId: cp.id })}
                  className={`group relative p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  {cp.image && (
                    <div className="w-full h-20 rounded-lg overflow-hidden bg-gray-100 mb-2">
                      <Image
                        src={cp.image}
                        alt={cp.name}
                        width={160}
                        height={80}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  )}
                  <p className="text-sm font-medium truncate">{cp.name}</p>
                  <p className="text-xs text-muted-foreground">{cp.sku}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Info badges */}
        {form.coreProductId && (
          <div className="flex flex-wrap gap-3 pt-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" /> Auto-linked with category
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
              <CheckCircle2 className="h-3.5 w-3.5" /> Cannot modify structure
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
