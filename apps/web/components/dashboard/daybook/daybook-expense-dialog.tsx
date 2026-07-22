"use client";

import { useMemo, useState } from "react";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import { DAYBOOK_PAYMENT_ACCOUNTS } from "@/components/dashboard/daybook/daybook-expense-ledger";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DaybookExpenseDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
};

function money(value: number) {
  return `Tk${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

export function DaybookExpenseDialog({
  onOpenChange,
  open,
  scope,
}: DaybookExpenseDialogProps) {
  const [payee, setPayee] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState(
    DAYBOOK_PAYMENT_ACCOUNTS[0]?.id ?? "",
  );
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";
  const selectedPaymentAccount = useMemo(
    () =>
      DAYBOOK_PAYMENT_ACCOUNTS.find(
        (account) => account.id === paymentAccountId,
      ) ?? DAYBOOK_PAYMENT_ACCOUNTS[0],
    [paymentAccountId],
  );

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
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5 md:grid-cols-[minmax(220px,360px)_minmax(260px,1fr)]">
              <div className="grid gap-2">
                <Label htmlFor="daybook-expense-payee">Payee</Label>
                <Input
                  id="daybook-expense-payee"
                  onChange={(event) => setPayee(event.target.value)}
                  placeholder="Who did you pay?"
                  value={payee}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="daybook-expense-payment-account">
                  Payment account
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    onValueChange={setPaymentAccountId}
                    value={paymentAccountId}
                  >
                    <SelectTrigger
                      className="w-full border-emerald-500 bg-white"
                      id="daybook-expense-payment-account"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYBOOK_PAYMENT_ACCOUNTS.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="whitespace-nowrap font-medium text-slate-600 text-sm">
                    Balance {money(selectedPaymentAccount?.balance ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 text-right">
              <div className="font-semibold text-slate-500 text-xs uppercase">
                Amount
              </div>
              <div className="mt-2 font-bold text-4xl text-slate-900 tabular-nums">
                {money(0)}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
