"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";

type DaybookExpenseDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
};

export function DaybookExpenseDialog({
  onOpenChange,
  open,
  scope,
}: DaybookExpenseDialogProps) {
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-slate-50 p-0 sm:max-w-6xl">
        <DialogHeader className="border-slate-200 border-b bg-white px-5 py-4">
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Expense
          </DialogTitle>
          <DialogDescription>
            Record a cash or bank expense for {scopeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Expense form is loading.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
