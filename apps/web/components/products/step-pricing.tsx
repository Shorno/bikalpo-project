"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CreateProductFormState } from "@/app/shop/(management)/dashboard/products/create/page";

type Props = {
  form: CreateProductFormState;
  update: (patch: Partial<CreateProductFormState>) => void;
  options: any;
};

export function StepPricing({ form, update, options }: Props) {
  const brands = options?.brands ?? [];
  const variantOptions = options?.variantOptions ?? [];

  // Initialize pricing array for newly selected variants
  useEffect(() => {
    const nextPricing = [...form.pricing];
    let changed = false;

    form.variantSelections.forEach((sel) => {
      const exists = nextPricing.some(
        (p) => p.variantOptionId === sel.variantOptionId && p.brandId === sel.brandId,
      );
      if (!exists) {
        nextPricing.push({
          variantOptionId: sel.variantOptionId,
          brandId: sel.brandId,
          retailPrice: "",
        });
        changed = true;
      }
    });

    if (changed) {
      update({ pricing: nextPricing });
    }
  }, [form.variantSelections, form.pricing, update]);

  const handlePriceChange = (variantOptionId: number, brandId: number, value: string) => {
    const nextPricing = form.pricing.map((p) => {
      if (p.variantOptionId === variantOptionId && p.brandId === brandId) {
        return { ...p, retailPrice: value };
      }
      return p;
    });
    update({ pricing: nextPricing });
  };

  if (form.variantSelections.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-lg bg-gray-50">
        Please select brands and variants in the previous step first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Label className="text-base">Retail Pricing <span className="text-red-500">*</span></Label>
      <p className="text-sm text-muted-foreground mb-4">
        Set your selling price for each selected combination
      </p>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Brand</TableHead>
              <TableHead>Variant Option</TableHead>
              <TableHead className="w-[200px] text-right">Retail Price (৳)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {form.variantSelections.map((sel) => {
              const brandName = brands.find((b: any) => b.id === sel.brandId)?.name ?? "Unknown";
              const vo = variantOptions.find((v: any) => v.id === sel.variantOptionId);
              const voName = vo ? `${vo.name} ${vo.size && vo.unit !== 'pcs' ? `(${vo.size} ${vo.unit})` : ""}` : "Unknown";
              
              const currentPrice =
                form.pricing.find(
                  (p) => p.variantOptionId === sel.variantOptionId && p.brandId === sel.brandId,
                )?.retailPrice ?? "";

              return (
                <TableRow key={`${sel.brandId}-${sel.variantOptionId}`}>
                  <TableCell className="font-medium">{brandName}</TableCell>
                  <TableCell>{voName}</TableCell>
                  <TableCell>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">৳</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={currentPrice}
                        onChange={(e) =>
                          handlePriceChange(sel.variantOptionId, sel.brandId, e.target.value)
                        }
                        className="pl-8 text-right font-mono"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
