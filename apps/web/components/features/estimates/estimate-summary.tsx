"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface EstimateSummaryProps {
  subtotal: number;
  discount: number;
  onDiscountChange: (value: number) => void;
}

import { CreditCard, Tag } from "lucide-react";

export function EstimateSummary({
  subtotal,
  discount,
  onDiscountChange,
}: EstimateSummaryProps) {
  const total = subtotal - discount;

  return (
    <Card className="shadow-none overflow-hidden">
      <div className="bg-muted/20 px-6 py-4 border-b">
        <div className="flex items-center gap-2 text-primary">
          <CreditCard className="size-5" />
          <h3 className="text-lg font-bold">Summary</h3>
        </div>
      </div>
      <CardContent className="p-6">
        <div className="space-y-5">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground font-medium">Subtotal</span>
            <span className="font-semibold tabular-nums">
              ৳{subtotal.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-muted-foreground" />
              <Label
                htmlFor="discount"
                className="text-muted-foreground font-medium whitespace-nowrap"
              >
                Discount
              </Label>
            </div>
            <Input
              id="discount"
              type="number"
              min="0"
              value={discount}
              onChange={(e) =>
                onDiscountChange(parseFloat(e.target.value) || 0)
              }
              className="h-9 w-28 text-right bg-background focus:border-primary focus:ring-primary/20 transition-all font-medium tabular-nums"
            />
          </div>

          <Separator />

          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                Amount Payable
              </span>
              <span className="text-2xl font-black text-foreground">Total</span>
            </div>
            <span className="text-3xl font-black text-primary tabular-nums tracking-tight">
              ৳{total.toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
