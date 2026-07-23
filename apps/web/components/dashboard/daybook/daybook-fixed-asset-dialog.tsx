"use client";

import { useMemo, useState } from "react";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DaybookFixedAssetDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
};

function dateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function money(value: number) {
  return `Tk${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

export function DaybookFixedAssetDialog({
  onOpenChange,
  open,
  scope,
}: DaybookFixedAssetDialogProps) {
  const [paymentDate] = useState(dateValue);
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";
  const previewTotal = useMemo(() => 0, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-slate-50 p-0 sm:max-w-6xl">
        <DialogHeader className="border-slate-200 border-b bg-white px-5 py-4">
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Fixed Asset Purchase
          </DialogTitle>
          <DialogDescription>
            Record furniture, equipment, or other fixed assets for {scopeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-5 py-6">
          <div className="rounded-lg bg-white p-4 text-right">
            <div className="font-semibold text-slate-500 text-xs uppercase">
              Amount
            </div>
            <div className="mt-2 font-bold text-4xl text-slate-900 tabular-nums">
              {money(previewTotal)}
            </div>
            <p className="mt-2 text-slate-500 text-sm">{paymentDate}</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)} type="button">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
