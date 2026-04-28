"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
        nextStock.push({
          variantOptionId: sel.variantOptionId,
          brandId: sel.brandId,
          quantity: 0,
        });
        changed = true;
      }
    });

    if (changed) {
      update({ openingStock: nextStock });
    }
  }, [form.variantSelections, form.openingStock, update]);

  const handleStockChange = (variantOptionId: number, brandId: number, value: string) => {
    const nextStock = form.openingStock.map((s) => {
      if (s.variantOptionId === variantOptionId && s.brandId === brandId) {
        return { ...s, quantity: value === "" ? 0 : parseInt(value, 10) };
      }
      return s;
    });
    update({ openingStock: nextStock });
  };

  return (
    <div className="space-y-8">
      {/* Opening Stock */}
      <div className="space-y-4">
        <Label className="text-base">Opening Stock</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Set the initial inventory quantity for your store.
        </p>
        
        {form.variantSelections.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Brand</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="w-[150px] text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {form.variantSelections.map((sel) => {
                  const brandName = brands.find((b: any) => b.id === sel.brandId)?.name ?? "Unknown";
                  const vo = variantOptions.find((v: any) => v.id === sel.variantOptionId);
                  const voName = vo ? `${vo.name} ${vo.size && vo.unit !== 'pcs' ? `(${vo.size} ${vo.unit})` : ""}` : "Unknown";
                  
                  const currentQty =
                    form.openingStock.find(
                      (s) => s.variantOptionId === sel.variantOptionId && s.brandId === sel.brandId,
                    )?.quantity ?? 0;

                  return (
                    <TableRow key={`${sel.brandId}-${sel.variantOptionId}`}>
                      <TableCell className="font-medium">{brandName}</TableCell>
                      <TableCell>{voName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={currentQty || ""}
                          onChange={(e) =>
                            handleStockChange(sel.variantOptionId, sel.brandId, e.target.value)
                          }
                          className="text-right font-mono"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground p-3 border rounded-lg bg-gray-50">
            No variants selected.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customization */}
        <div className="space-y-4">
          <Label className="text-base">Display Details</Label>
          <div className="space-y-3">
            <div>
              <Label htmlFor="displayName" className="text-xs text-muted-foreground">
                Custom Display Name (Optional)
              </Label>
              <Input
                id="displayName"
                placeholder="Leave blank to use core identity name"
                value={form.displayName}
                onChange={(e) => update({ displayName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="shortNote" className="text-xs text-muted-foreground">
                Short Note
              </Label>
              <Textarea
                id="shortNote"
                placeholder="Internal notes about this product..."
                value={form.shortNote}
                onChange={(e) => update({ shortNote: e.target.value })}
                className="resize-none h-20"
              />
            </div>
          </div>
        </div>

        {/* Visibility */}
        <div className="space-y-4">
          <Label className="text-base">Status & Visibility</Label>
          <RadioGroup
            value={form.status}
            onValueChange={(value) => update({ status: value as any })}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="active" id="status-active" />
              <Label htmlFor="status-active" className="cursor-pointer flex-1">
                <span className="font-medium text-emerald-700 block">Active</span>
                <span className="text-xs text-muted-foreground">Product is visible and available for sale</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 border rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
              <RadioGroupItem value="inactive" id="status-inactive" />
              <Label htmlFor="status-inactive" className="cursor-pointer flex-1">
                <span className="font-medium text-amber-700 block">Inactive</span>
                <span className="text-xs text-muted-foreground">Product is hidden from customers</span>
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}
