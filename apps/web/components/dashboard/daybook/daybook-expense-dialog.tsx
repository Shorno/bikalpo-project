"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarIcon,
  PaperclipIcon,
  PlusIcon,
  PrinterIcon,
  RepeatIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addDaybookExpense,
  createDaybookExpenseId,
  DAYBOOK_EXPENSE_CATEGORIES,
  DAYBOOK_PAYMENT_ACCOUNTS,
  type DaybookExpenseLine,
  type DaybookExpenseScope,
} from "@/components/dashboard/daybook/daybook-expense-ledger";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";

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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function DaybookExpenseDialog({
  onOpenChange,
  open,
  scope,
}: DaybookExpenseDialogProps) {
  const queryClient = useQueryClient();
  const { data: paymentAccountsData } = useQuery(
    orpc.finance.getPaymentAccounts.queryOptions({ input: {} }),
  );
  const createExpenseMutation = useMutation(
    orpc.finance.createDaybookExpense.mutationOptions(),
  );
  const paymentAccounts = useMemo(
    () =>
      paymentAccountsData?.paymentAccounts?.length
        ? paymentAccountsData.paymentAccounts
        : DAYBOOK_PAYMENT_ACCOUNTS,
    [paymentAccountsData],
  );
  const [payee, setPayee] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState(
    paymentAccounts[0]?.id ?? DAYBOOK_PAYMENT_ACCOUNTS[0]?.id ?? "",
  );
  const [paymentDate, setPaymentDate] = useState(dateValue);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0] ?? "");
  const [referenceNo, setReferenceNo] = useState("");
  const [memo, setMemo] = useState("");
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [lines, setLines] = useState<DraftExpenseLine[]>(() => [
    createDraftLine(),
    createDraftLine(),
  ]);
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";
  const selectedPaymentAccount = useMemo(
    () =>
      paymentAccounts.find((account) => account.id === paymentAccountId) ??
      paymentAccounts[0] ??
      DAYBOOK_PAYMENT_ACCOUNTS[0],
    [paymentAccountId, paymentAccounts],
  );
  useEffect(() => {
    if (
      paymentAccounts.length > 0 &&
      !paymentAccounts.some((account) => account.id === paymentAccountId)
    ) {
      setPaymentAccountId(paymentAccounts[0]?.id ?? "");
    }
  }, [paymentAccountId, paymentAccounts]);
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
  const addLine = () =>
    setLines((currentLines) => [...currentLines, createDraftLine()]);
  const clearLines = () => setLines([createDraftLine(), createDraftLine()]);
  const removeLine = (lineId: string) => {
    setLines((currentLines) =>
      currentLines.length === 1
        ? [createDraftLine()]
        : currentLines.filter((line) => line.id !== lineId),
    );
  };
  const resetForm = () => {
    setPayee("");
    setPaymentAccountId(
      paymentAccounts[0]?.id ?? DAYBOOK_PAYMENT_ACCOUNTS[0]?.id ?? "",
    );
    setPaymentDate(dateValue());
    setPaymentMethod(PAYMENT_METHODS[0] ?? "");
    setReferenceNo("");
    setMemo("");
    setLines([createDraftLine(), createDraftLine()]);
  };
  const closeDialog = () => {
    setMessage(null);
    onOpenChange(false);
  };
  const buildExpenseLines = () => {
    const expenseLines: DaybookExpenseLine[] = [];

    for (const line of lines) {
      const amount = toAmount(line.amount);

      if (amount <= 0) {
        continue;
      }

      expenseLines.push({
        amount,
        category: line.category,
        description: line.description.trim(),
        id: createDaybookExpenseId("saved-expense-line"),
      });
    }

    return expenseLines;
  };
  const invalidateFinanceQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.finance.getPaymentAccounts.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.profitLoss.getMonthlyPnL.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.balanceSheet.getBalanceSheet.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.expense.getExpenses.key(),
      }),
    ]);
  };
  const saveExpense = async (closeAfterSave: boolean) => {
    const paymentAccount = selectedPaymentAccount;
    const expenseLines = buildExpenseLines();
    const nextTotal = expenseLines.reduce((sum, line) => sum + line.amount, 0);

    if (!paymentAccount) {
      setMessage({ text: "Select a payment account.", tone: "error" });
      return;
    }

    if (nextTotal <= 0 || expenseLines.length === 0) {
      setMessage({ text: "Enter at least one expense amount.", tone: "error" });
      return;
    }

    const localExpense = {
      createdAt: new Date().toISOString(),
      id: createDaybookExpenseId("daybook-expense"),
      lines: expenseLines,
      memo: memo.trim(),
      payee: payee.trim() || "Expense",
      paymentAccountId: paymentAccount.id,
      paymentAccountName: paymentAccount.name,
      paymentAccountType: paymentAccount.type,
      paymentDate,
      paymentMethod,
      referenceNo: referenceNo.trim(),
      scope,
      total: nextTotal,
    };

    try {
      const result = await createExpenseMutation.mutateAsync({
        lines: expenseLines.map((line) => ({
          amount: line.amount,
          category: line.category,
          description: line.description,
        })),
        memo: memo.trim() || undefined,
        payee: payee.trim() || undefined,
        paymentAccountId: paymentAccount.id,
        paymentDate,
        paymentMethod: paymentAccount.type,
        referenceNo: referenceNo.trim() || undefined,
      });

      addDaybookExpense({
        ...localExpense,
        isSynced: true,
        serverExpenseIds: result.expenses.map((expense) => expense.id),
      });

      if (closeAfterSave) {
        resetForm();
        closeDialog();
        void invalidateFinanceQueries();
        return;
      }

      await invalidateFinanceQueries();
      resetForm();
      setMessage({ text: result.message, tone: "success" });
    } catch (error) {
      addDaybookExpense({ ...localExpense, isSynced: false });
      resetForm();

      if (closeAfterSave) {
        closeDialog();
        return;
      }

      setMessage({
        text:
          error instanceof Error
            ? `Expense saved locally. Sync failed: ${error.message}`
            : "Expense saved locally. Sync failed.",
        tone: "error",
      });
    }
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setMessage(null);
        }

        onOpenChange(nextOpen);
      }}
      open={open}
    >
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
                      {paymentAccounts.map((account) => (
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
            <div className="grid grid-cols-[56px_minmax(180px,0.9fr)_minmax(260px,1.4fr)_minmax(140px,0.45fr)_56px] border-slate-200 border-b bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-xs uppercase">
              <div>#</div>
              <div>Category</div>
              <div>Description</div>
              <div className="text-right">Amount</div>
              <div />
            </div>
            <div>
              {lines.map((line, index) => (
                <div
                  className="grid grid-cols-[56px_minmax(180px,0.9fr)_minmax(260px,1.4fr)_minmax(140px,0.45fr)_56px] items-center border-slate-200 border-b px-4 py-3 last:border-b-0"
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
                  <Button
                    aria-label={`Remove expense line ${index + 1}`}
                    className="ml-2 text-slate-400 hover:text-red-600"
                    onClick={() => removeLine(line.id)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={addLine} type="button" variant="outline">
              <PlusIcon data-icon="inline-start" />
              Add lines
            </Button>
            <Button onClick={clearLines} type="button" variant="outline">
              Clear all lines
            </Button>
          </div>

          {message ? (
            <div
              className={`mt-4 rounded-lg px-4 py-3 font-medium text-sm ${
                message.tone === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {message.text}
            </div>
          ) : null}

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,0.8fr)]">
            <div className="grid gap-2">
              <Label htmlFor="daybook-expense-memo">Memo</Label>
              <Textarea
                className="min-h-36 bg-white"
                id="daybook-expense-memo"
                onChange={(event) => setMemo(event.target.value)}
                value={memo}
              />
            </div>

            <div className="grid content-start gap-2">
              <Label>Attachments</Label>
              <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-slate-500">
                <PaperclipIcon className="mb-2 size-5 text-blue-600" />
                <button
                  className="font-semibold text-blue-700 hover:text-blue-800"
                  type="button"
                >
                  Add attachment
                </button>
                <p className="mt-1 text-xs">Max file size: 20 MB</p>
              </div>
            </div>
          </div>

          <div className="-mx-5 mt-8 flex flex-col gap-3 border-slate-200 border-t bg-white px-5 py-4 sm:flex-row sm:items-center">
            <Button
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              onClick={closeDialog}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <div className="flex-1" />
            <Button type="button" variant="ghost">
              <PrinterIcon data-icon="inline-start" />
              Print
            </Button>
            <Button type="button" variant="ghost">
              <RepeatIcon data-icon="inline-start" />
              Make recurring
            </Button>
            <Button
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              disabled={createExpenseMutation.isPending}
              onClick={() => saveExpense(false)}
              type="button"
              variant="outline"
            >
              <SaveIcon data-icon="inline-start" />
              Save
            </Button>
            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={createExpenseMutation.isPending}
              onClick={() => saveExpense(true)}
              type="button"
            >
              Save and close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
