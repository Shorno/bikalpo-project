"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    <div className="space-y-5">
      {/* Type */}
      <div className="space-y-2">
        <Label>Product Type <span className="text-red-500">*</span></Label>
        <Select
          value={form.typeId?.toString() ?? ""}
          onValueChange={(v) => update({ typeId: Number(v), categoryId: undefined, subCategoryId: undefined, coreProductId: undefined })}
        >
          <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
          <SelectContent>
            {types.map((t: any) => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Category <span className="text-red-500">*</span></Label>
        <Select
          value={form.categoryId?.toString() ?? ""}
          onValueChange={(v) => update({ categoryId: Number(v), subCategoryId: undefined, coreProductId: undefined })}
          disabled={!form.typeId}
        >
          <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
          <SelectContent>
            {categories.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Sub Category */}
      <div className="space-y-2">
        <Label>Sub Category</Label>
        <Select
          value={form.subCategoryId?.toString() ?? ""}
          onValueChange={(v) => update({ subCategoryId: Number(v), coreProductId: undefined })}
          disabled={!form.categoryId}
        >
          <SelectTrigger><SelectValue placeholder="Select sub category..." /></SelectTrigger>
          <SelectContent>
            {subCategories.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Core Product */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Core Product Identity <span className="text-red-500">*</span></Label>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        {coreProducts.length === 0 && form.categoryId && !loading ? (
          <p className="text-sm text-muted-foreground p-3 bg-gray-50 rounded-lg border">
            No core products found for this category. Try a different category or request a new product setup.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {coreProducts.map((cp: any) => (
              <div
                key={cp.id}
                onClick={() => update({ coreProductId: cp.id })}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-sm ${
                  form.coreProductId === cp.id ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {cp.image && (
                  <div className="w-full h-16 rounded-md overflow-hidden bg-gray-100 mb-2">
                    <Image src={cp.image} alt={cp.name} width={120} height={64} className="object-cover w-full h-full" />
                  </div>
                )}
                <p className="text-sm font-medium truncate">{cp.name}</p>
                <p className="text-xs text-muted-foreground">{cp.sku}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
