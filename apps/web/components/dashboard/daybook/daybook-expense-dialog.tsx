"use client";

import { CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  createDaybookExpenseId,
  DAYBOOK_EXPENSE_CATEGORIES,
  DAYBOOK_PAYMENT_ACCOUNTS,
  type DaybookExpenseScope,
} from "@/components/dashboard/daybook/daybook-expense-ledger";
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

type DraftExpenseLine = {
  amount: string;
  category: string;
  description: string;
  id: string;
};

const PAYMENT_METHODS = [
  "Cash",
  "Cheque",
  "Card",
  "Mobile Banking",
  "Bank Transfer",
];

function createDraftLine(): DraftExpenseLine {
  return {
    amount: "",
    category: DAYBOOK_EXPENSE_CATEGORIES[0] ?? "Bills / Utilities",
    description: "",
    id: createDaybookExpenseId("expense-line"),
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
  return Number.isFinite(parsed) ? parsed : 0;
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
  const [paymentDate, setPaymentDate] = useState(dateValue);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0] ?? "");
  const [referenceNo, setReferenceNo] = useState("");
  const [lines, setLines] = useState<DraftExpenseLine[]>(() => [
    createDraftLine(),
    createDraftLine(),
  ]);
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";
  const selectedPaymentAccount = useMemo(
    () =>
      DAYBOOK_PAYMENT_ACCOUNTS.find(
        (account) => account.id === paymentAccountId,
      ) ?? DAYBOOK_PAYMENT_ACCOUNTS[0],
    [paymentAccountId],
  );
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + toAmount(line.amount), 0),
    [lines],
  );

  const updateLine = (
    lineId: string,
    field: keyof Omit<DraftExpenseLine, "id">,
    value: string,
  ) => {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line,
      ),
    );
  };

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
                {money(total)}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-[minmax(180px,220px)_minmax(180px,260px)_minmax(180px,260px)]">
            <div className="grid gap-2">
              <Label htmlFor="daybook-expense-payment-date">Payment Date</Label>
              <div className="relative">
                <Input
                  id="daybook-expense-payment-date"
                  onChange={(event) => setPaymentDate(event.target.value)}
                  type="date"
                  value={paymentDate}
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="daybook-expense-payment-method">
                Payment Method
              </Label>
              <Select onValueChange={setPaymentMethod} value={paymentMethod}>
                <SelectTrigger
                  className="w-full bg-white"
                  id="daybook-expense-payment-method"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="daybook-expense-reference">Ref no.</Label>
              <Input
                id="daybook-expense-reference"
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="Reference"
                value={referenceNo}
              />
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[56px_minmax(180px,0.9fr)_minmax(260px,1.4fr)_minmax(140px,0.45fr)] border-slate-200 border-b bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-xs uppercase">
              <div>#</div>
              <div>Category</div>
              <div>Description</div>
              <div className="text-right">Amount</div>
            </div>
            <div>
              {lines.map((line, index) => (
                <div
                  className="grid grid-cols-[56px_minmax(180px,0.9fr)_minmax(260px,1.4fr)_minmax(140px,0.45fr)] items-center border-slate-200 border-b px-4 py-3 last:border-b-0"
                  key={line.id}
                >
                  <div className="font-medium text-slate-500">{index + 1}</div>
                  <Select
                    onValueChange={(value) =>
                      updateLine(line.id, "category", value)
                    }
                    value={line.category}
                  >
                    <SelectTrigger className="h-9 w-full bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYBOOK_EXPENSE_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="h-9 rounded-none border-x-0 border-y-0 bg-transparent focus-visible:ring-0"
                    onChange={(event) =>
                      updateLine(line.id, "description", event.target.value)
                    }
                    placeholder="Description"
                    value={line.description}
                  />
                  <Input
                    className="h-9 text-right tabular-nums"
                    inputMode="decimal"
                    onChange={(event) =>
                      updateLine(line.id, "amount", event.target.value)
                    }
                    placeholder="0.00"
                    value={line.amount}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
