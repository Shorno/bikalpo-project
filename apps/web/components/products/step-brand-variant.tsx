"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CreateProductFormState } from "@/app/shop/(management)/dashboard/products/create/page";

type Props = {
  form: CreateProductFormState;
  update: (patch: Partial<CreateProductFormState>) => void;
  options: any;
};

export function StepBrandVariant({ form, update, options }: Props) {
  const brands = options?.brands ?? [];
  const variantOptions = options?.variantOptions ?? [];

  const toggleBrand = (brandId: number) => {
    const next = form.brandIds.includes(brandId)
      ? form.brandIds.filter((id) => id !== brandId)
      : [...form.brandIds, brandId];
    // Remove variant selections for deselected brands
    const nextSelections = form.variantSelections.filter((s) => next.includes(s.brandId));
    update({ brandIds: next, variantSelections: nextSelections });
  };

  const toggleVariant = (variantOptionId: number, brandId: number) => {
    const exists = form.variantSelections.some(
      (s) => s.variantOptionId === variantOptionId && s.brandId === brandId,
    );
    const next = exists
      ? form.variantSelections.filter(
          (s) => !(s.variantOptionId === variantOptionId && s.brandId === brandId),
        )
      : [...form.variantSelections, { variantOptionId, brandId }];
    update({ variantSelections: next });
  };

  return (
    <div className="space-y-6">
      {/* Brands */}
      <div className="space-y-3">
        <Label className="text-base">Select Brands <span className="text-red-500">*</span></Label>
        <p className="text-sm text-muted-foreground">Choose which brands you will sell for this product</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {brands.map((b: any) => (
            <label
              key={b.id}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                form.brandIds.includes(b.id) ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Checkbox
                checked={form.brandIds.includes(b.id)}
                onCheckedChange={() => toggleBrand(b.id)}
              />
              <span className="text-sm font-medium">{b.name}</span>
            </label>
          ))}
        </div>
        {brands.length === 0 && (
          <p className="text-sm text-muted-foreground p-3 bg-gray-50 rounded-lg border">No brands available.</p>
        )}
      </div>

      {/* Variant Options per Brand */}
      {form.brandIds.length > 0 && (
        <div className="space-y-4">
          <Label className="text-base">Select Variants <span className="text-red-500">*</span></Label>
          <p className="text-sm text-muted-foreground">Choose variant options for each brand</p>

          {form.brandIds.map((brandId) => {
            const brandName = brands.find((b: any) => b.id === brandId)?.name ?? "Unknown";
            return (
              <div key={brandId} className="border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-3">{brandName}</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {variantOptions.map((vo: any) => {
                    const isSelected = form.variantSelections.some(
                      (s) => s.variantOptionId === vo.id && s.brandId === brandId,
                    );
                    return (
                      <label
                        key={`${brandId}-${vo.id}`}
                        className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer text-sm transition-colors ${
                          isSelected ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleVariant(vo.id, brandId)}
                        />
                        <span>{vo.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {vo.variantType === "loose" ? "Loose" : vo.unit}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {variantOptions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No variant options available for this category.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {form.variantSelections.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-700">
            ✓ {form.brandIds.length} brand(s) × {form.variantSelections.length} variant combination(s) selected
          </p>
        </div>
      )}
    </div>
  );
}
