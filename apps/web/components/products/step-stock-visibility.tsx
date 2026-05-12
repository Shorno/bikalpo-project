"use client";

import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CreateProductFormState } from "@/app/shop/(management)/dashboard/products/create/page";

type Props = {
  form: CreateProductFormState;
  update: (patch: Partial<CreateProductFormState>) => void;
  options: any;
};

export function StepStockVisibility({ form, update, options }: Props) {
  const brands = options?.brands ?? [];
  const variantOptions = options?.variantOptions ?? [];

  // Initialize opening stock array
  useEffect(() => {
    const nextStock = [...form.openingStock];
    let changed = false;
    form.variantSelections.forEach((sel) => {
      const exists = nextStock.some(
        (s) => s.variantOptionId === sel.variantOptionId && s.brandId === sel.brandId,
      );
      if (!exists) {
        nextStock.push({ variantOptionId: sel.variantOptionId, brandId: sel.brandId, quantity: 0 });
        changed = true;
      }
    });
    if (changed) update({ openingStock: nextStock });
  }, [form.variantSelections, form.openingStock, update]);

  const handleStockChange = (voId: number, bId: number, value: string) => {
    update({
      openingStock: form.openingStock.map((s) =>
        s.variantOptionId === voId && s.brandId === bId
          ? { ...s, quantity: value === "" ? 0 : parseInt(value, 10) }
          : s,
      ),
    });
  };

  // Group by brand for card layout
  const groupedByBrand = form.brandIds
    .map((brandId) => ({
      brandId,
      brandName: brands.find((b: any) => b.id === brandId)?.name ?? "Unknown",
      selections: form.variantSelections.filter((s) => s.brandId === brandId),
    }))
    .filter((g) => g.selections.length > 0);

  return (
    <div className="space-y-8">
      {/* ── STEP 6: Opening Stock ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <span className="text-lg">📊</span>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Stock / Inventory Setup
            </h3>
            <p className="text-xs text-muted-foreground">Set opening stock for each variant</p>
          </div>
        </div>

        {groupedByBrand.length > 0 ? (
          <div className="space-y-4">
            {groupedByBrand.map(({ brandId, brandName, selections }) => (
              <div key={brandId} className="border rounded-xl p-4 bg-gray-50/50">
                <h4 className="text-sm font-semibold mb-3 text-gray-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  {brandName}
                </h4>
                <div className="space-y-2">
                  {selections.map((sel) => {
                    const vo = variantOptions.find((v: any) => v.id === sel.variantOptionId);
                    const voName = vo
                      ? `${vo.name}${vo.size && vo.unit !== "pcs" ? ` (${vo.size} ${vo.unit})` : ""}`
                      : "Unknown";
                    const currentQty = form.openingStock.find(
                      (s) => s.variantOptionId === sel.variantOptionId && s.brandId === sel.brandId,
                    )?.quantity ?? 0;

                    return (
                      <div key={`${sel.brandId}-${sel.variantOptionId}`} className="flex items-center gap-3 bg-white rounded-lg border p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{voName}</p>
                        </div>
                        <Input
                          type="number" min="0" value={currentQty || ""}
                          onChange={(e) => handleStockChange(sel.variantOptionId, sel.brandId, e.target.value)}
                          className="w-24 text-right font-mono h-9"
                          placeholder="0"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">pcs</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground p-4 border rounded-xl bg-gray-50 border-dashed text-center">
            No variants selected.
          </p>
        )}

        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700">Optional (can update later)</p>
        </div>
      </div>

      {/* ── STEP 7: Store Customization ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <span className="text-lg">📝</span>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Store Customization
            </h3>
            <p className="text-xs text-muted-foreground">Optional branding for your store</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm font-medium">Display Name</Label>
            <Input
              id="displayName"
              placeholder="e.g. Premium Miniket Rice"
              value={form.displayName}
              onChange={(e) => update({ displayName: e.target.value })}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shortNote" className="text-sm font-medium">Short Note</Label>
            <Textarea
              id="shortNote"
              placeholder="e.g. Best quality available"
              value={form.shortNote}
              onChange={(e) => update({ shortNote: e.target.value })}
              className="resize-none h-11 min-h-[44px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700">Optional branding</p>
        </div>
      </div>

      {/* ── STEP 8: Visibility ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <span className="text-lg">🌐</span>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700">
              Visibility
            </h3>
            <p className="text-xs text-muted-foreground">Control product status and availability</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Status */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Status</Label>
            <RadioGroup
              value={form.status}
              onValueChange={(value) => update({ status: value as any })}
              className="space-y-2"
            >
              <label className={`flex items-center gap-3 border rounded-xl p-3.5 cursor-pointer transition-all ${
                form.status === "active" ? "border-emerald-400 bg-emerald-50" : "border-gray-200 hover:bg-gray-50"
              }`}>
                <RadioGroupItem value="active" id="status-active" />
                <div>
                  <span className="font-medium text-emerald-700 text-sm block">Active</span>
                  <span className="text-xs text-muted-foreground">Product is visible and available</span>
                </div>
              </label>
              <label className={`flex items-center gap-3 border rounded-xl p-3.5 cursor-pointer transition-all ${
                form.status === "inactive" ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:bg-gray-50"
              }`}>
                <RadioGroupItem value="inactive" id="status-inactive" />
                <div>
                  <span className="font-medium text-amber-700 text-sm block">Inactive</span>
                  <span className="text-xs text-muted-foreground">Product is hidden from customers</span>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Available for Sale */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Available for Sale</Label>
            <label className={`flex items-center gap-3 border rounded-xl p-3.5 cursor-pointer transition-all ${
              form.availableForSale ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"
            }`}>
              <Checkbox
                checked={form.availableForSale}
                onCheckedChange={(checked) => update({ availableForSale: !!checked })}
                className="data-[state=checked]:bg-primary"
              />
              <div>
                <span className="font-medium text-sm block">Yes</span>
                <span className="text-xs text-muted-foreground">Customers can purchase this product</span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
