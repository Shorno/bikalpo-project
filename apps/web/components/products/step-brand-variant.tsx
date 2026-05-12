"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RequestSetupModal } from "./request-setup-modal";
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
    <div className="space-y-8">
      {/* ── Available Brands ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <span className="text-lg">🏷️</span>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Available Brands
            </h3>
            <p className="text-xs text-muted-foreground">Choose which brands you will sell</p>
          </div>
        </div>

        {brands.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 bg-gray-50 rounded-lg border border-dashed text-center">
            No brands available for this product.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {brands.map((b: any) => {
              const isSelected = form.brandIds.includes(b.id);
              return (
                <label
                  key={b.id}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-sm ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleBrand(b.id)}
                    className="data-[state=checked]:bg-primary"
                  />
                  <div className="min-w-0">
                    <span className="text-sm font-medium block truncate">{b.name}</span>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Available Variants (per selected brand) ── */}
      {form.brandIds.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <span className="text-lg">📦</span>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
                Available Variants
              </h3>
              <p className="text-xs text-muted-foreground">Select variant options for each brand</p>
            </div>
          </div>

          {form.brandIds.map((brandId) => {
            const brandName = brands.find((b: any) => b.id === brandId)?.name ?? "Unknown";
            return (
              <div key={brandId} className="border rounded-xl p-4 bg-gray-50/50">
                <h4 className="text-sm font-semibold mb-3 text-gray-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  {brandName}
                </h4>
                {variantOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No variant options available for this category.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {variantOptions.map((vo: any) => {
                      const isSelected = form.variantSelections.some(
                        (s) => s.variantOptionId === vo.id && s.brandId === brandId,
                      );
                      return (
                        <label
                          key={`${brandId}-${vo.id}`}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm transition-all duration-150 ${
                            isSelected
                              ? "border-primary bg-primary/5 font-medium"
                              : "border-gray-200 hover:bg-white hover:border-gray-300"
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleVariant(vo.id, brandId)}
                            className="data-[state=checked]:bg-primary"
                          />
                          <span className="truncate">{vo.name}</span>
                          <span className="text-xs text-muted-foreground ml-auto shrink-0">
                            {vo.variantType === "loose" ? "Loose" : vo.unit}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Request Setup ── */}
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-sm text-muted-foreground">Not found?</span>
        <RequestSetupModal
          allowedTypes={["brand", "variant"]}
          triggerLabel="+ Request Setup"
        />
      </div>

      {/* ── Summary Badge ── */}
      {form.variantSelections.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700">
            {form.brandIds.length} brand(s) × {form.variantSelections.length} variant combination(s) selected
          </p>
        </div>
      )}
    </div>
  );
}
