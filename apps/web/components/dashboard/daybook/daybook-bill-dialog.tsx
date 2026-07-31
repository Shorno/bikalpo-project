"use client";

import { CalendarIcon, FileTextIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type DaybookBillPartyType,
  createDaybookBillId,
} from "@/components/dashboard/daybook/daybook-bill-ledger";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DaybookBillDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
};

type DraftBillLine = {
  amount: string;
  category: string;
  description: string;
  id: string;
};

const BILL_CATEGORIES = [
  "Bills / Utilities",
  "Purchase Bill",
  "Service Bill",
  "Rent",
  "Miscellaneous",
] as const;

function createDraftLine(): DraftBillLine {
  return {
    amount: "",
    category: BILL_CATEGORIES[0] ?? "Bills / Utilities",
    description: "",
    id: createDaybookBillId("bill-line"),
  };
}

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

function toAmount(value: string) {
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function DaybookBillDialog({
  onOpenChange,
  open,
  scope,
}: DaybookBillDialogProps) {
  const [partyType, setPartyType] =
    useState<DaybookBillPartyType>("supplier");
  const [payeeName, setPayeeName] = useState("");
  const [issueDate, setIssueDate] = useState(dateValue);
  const [dueDate, setDueDate] = useState(dateValue);
  const [lines] = useState<DraftBillLine[]>(() => [createDraftLine()]);
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + toAmount(line.amount), 0),
    [lines],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-slate-50 p-0 sm:max-w-5xl">
        <DialogHeader className="border-slate-200 border-b bg-white px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <FileTextIcon className="size-5 text-blue-700" />
            Bill
          </DialogTitle>
          <DialogDescription>
            Record an unpaid supplier or customer bill for {scopeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Payee type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => setPartyType("supplier")}
                    type="button"
                    variant={partyType === "supplier" ? "default" : "outline"}
                  >
                    Supplier
                  </Button>
                  <Button
                    onClick={() => setPartyType("customer")}
                    type="button"
                    variant={partyType === "customer" ? "default" : "outline"}
                  >
                    Customer
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="daybook-bill-payee">Payee</Label>
                <Input
                  id="daybook-bill-payee"
                  onChange={(event) => setPayeeName(event.target.value)}
                  placeholder="Type supplier or customer"
                  value={payeeName}
                />
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 text-right">
              <div className="font-semibold text-slate-500 text-xs uppercase">
                Amount
              </div>
              <div className="mt-2 font-bold text-4xl text-slate-900 tabular-nums">
                {money(total)}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="daybook-bill-issue-date">Bill Date</Label>
              <div className="relative">
                <Input
                  id="daybook-bill-issue-date"
                  onChange={(event) => setIssueDate(event.target.value)}
                  type="date"
                  value={issueDate}
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="daybook-bill-due-date">Due Date</Label>
              <div className="relative">
                <Input
                  id="daybook-bill-due-date"
                  onChange={(event) => setDueDate(event.target.value)}
                  type="date"
                  value={dueDate}
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button type="button">
              <SaveIcon data-icon="inline-start" />
              Save
            </Button>
            <Button type="button">
              <PlusIcon data-icon="inline-start" />
              Save and close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
