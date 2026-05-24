"use client";

import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CreateProductFormState } from "@/app/shop/(management)/dashboard/products/create/page";

type Props = {
  form: CreateProductFormState;
  update: (patch: Partial<CreateProductFormState>) => void;
  options: any;
};

export function StepPricing({ form, update, options }: Props) {
  const brands = options?.brands ?? [];
  const variantOptions = options?.variantOptions ?? [];

  useEffect(() => {
    const nextPricing = [...form.pricing];
    let changed = false;
    form.variantSelections.forEach((sel) => {
      const exists = nextPricing.some(
        (p) => p.variantOptionId === sel.variantOptionId && p.brandId === sel.brandId,
      );
      if (!exists) {
        nextPricing.push({ variantOptionId: sel.variantOptionId, brandId: sel.brandId, retailPrice: "" });
        changed = true;
      }
    });
    if (changed) update({ pricing: nextPricing });
  }, [form.variantSelections, form.pricing, update]);

  const handlePriceChange = (voId: number, bId: number, value: string) => {
    update({
      pricing: form.pricing.map((p) =>
        p.variantOptionId === voId && p.brandId === bId ? { ...p, retailPrice: value } : p,
      ),
    });
  };

  if (form.variantSelections.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl bg-gray-50 border-dashed">
        Please select brands and variants in the previous step first.
      </div>
    );
  }

  const groupedByBrand = form.brandIds
    .map((brandId) => ({
      brandId,
      brandName: brands.find((b: any) => b.id === brandId)?.name ?? "Unknown",
      selections: form.variantSelections.filter((s) => s.brandId === brandId),
    }))
    .filter((g) => g.selections.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-2 border-b">
        <span className="text-lg">💰</span>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">Selling Price</h3>
          <p className="text-xs text-muted-foreground">👉 Set your own price (Brand + Variant ভিত্তিক)</p>
        </div>
      </div>

      <div className="space-y-4">
        {groupedByBrand.map(({ brandId, brandName, selections }) => (
          <div key={brandId} className="border rounded-xl p-4 bg-gray-50/50">
            <h4 className="text-sm font-semibold mb-4 text-gray-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              {brandName}
            </h4>
            <div className="space-y-3">
              {selections.map((sel) => {
                const vo = variantOptions.find((v: any) => v.id === sel.variantOptionId);
                const voName = vo ? `${vo.name}${vo.size && vo.unit !== "pcs" ? ` (${vo.size} ${vo.unit})` : ""}` : "Unknown";
                const currentPrice = form.pricing.find(
                  (p) => p.variantOptionId === sel.variantOptionId && p.brandId === sel.brandId,
                )?.retailPrice ?? "";

                return (
                  <div key={`${sel.brandId}-${sel.variantOptionId}`} className="flex items-center gap-3 bg-white rounded-lg border p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{voName}</p>
                      {vo?.variantType === "loose" && <span className="text-xs text-amber-600">Loose</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-sm font-medium text-muted-foreground">৳</span>
                      <Input type="number" min="0" step="0.01" placeholder="0.00" value={currentPrice}
                        onChange={(e) => handlePriceChange(sel.variantOptionId, sel.brandId, e.target.value)}
                        className="w-28 text-right font-mono h-9" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
        <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
        <p className="text-sm text-blue-700">Override admin reference price</p>
      </div>
    </div>
  );
}
