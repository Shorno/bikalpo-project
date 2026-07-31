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
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import {
  addDaybookLoan,
  createDaybookLoanId,
  type DaybookLoanLine,
  markDaybookLoanSynced,
} from "@/components/dashboard/daybook/daybook-loan-ledger";
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

type DaybookLoanDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
};

type DraftLoanLine = {
  amount: string;
  description: string;
  id: string;
  loanType: string;
};

const PAYMENT_METHODS = ["Cash", "Bank"] as const;

type PaymentMethodLabel = (typeof PAYMENT_METHODS)[number];

function paymentTypeToMethod(type?: "cash" | "bank"): PaymentMethodLabel {
  return type === "bank" ? "Bank" : "Cash";
}

function methodToPaymentType(method: PaymentMethodLabel): "cash" | "bank" {
  return method === "Bank" ? "bank" : "cash";
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

function createDraftLine(): DraftLoanLine {
  return {
    amount: "",
    description: "Loan Received",
    id: createDaybookLoanId("loan-line"),
    loanType: "Business Loan",
  };
}

export function DaybookLoanDialog({
  onOpenChange,
  open,
  scope,
}: DaybookLoanDialogProps) {
  const queryClient = useQueryClient();
  const { data: paymentAccountsData } = useQuery(
    orpc.finance.getPaymentAccounts.queryOptions({ input: {} }),
  );
  const { data: loanAccountsData } = useQuery(
    orpc.finance.getLoanAccounts.queryOptions({ input: {} }),
  );
  const createLoanMutation = useMutation(
    orpc.finance.createLoanReceived.mutationOptions(),
  );
  const paymentAccounts = useMemo(
    () => paymentAccountsData?.paymentAccounts ?? [],
    [paymentAccountsData?.paymentAccounts],
  );
  const loanAccounts = useMemo(
    () => loanAccountsData?.accounts ?? [],
    [loanAccountsData?.accounts],
  );
  const [lender, setLender] = useState("");
  const [loanNo, setLoanNo] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState(
    paymentAccounts[0]?.id ?? "",
  );
  const [receiveDate, setReceiveDate] = useState(dateValue);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodLabel>(
    PAYMENT_METHODS[0] ?? "Cash",
  );
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [lines, setLines] = useState<DraftLoanLine[]>(() => [
    createDraftLine(),
  ]);
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";
  const selectedPaymentAccount = useMemo(
    () => paymentAccounts.find((account) => account.id === paymentAccountId),
    [paymentAccountId, paymentAccounts],
  );
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + toAmount(line.amount), 0),
    [lines],
  );

  useEffect(() => {
    if (
      paymentAccounts.length > 0 &&
      !paymentAccounts.some((account) => account.id === paymentAccountId)
    ) {
      setPaymentAccountId(paymentAccounts[0]?.id ?? "");
    }
  }, [paymentAccountId, paymentAccounts]);

  useEffect(() => {
    const nextPaymentMethod = paymentTypeToMethod(selectedPaymentAccount?.type);
    setPaymentMethod((currentPaymentMethod) =>
      currentPaymentMethod === nextPaymentMethod
        ? currentPaymentMethod
        : nextPaymentMethod,
    );
  }, [selectedPaymentAccount?.type]);

  const updateLine = (
    lineId: string,
    field: keyof Omit<DraftLoanLine, "id">,
    value: string,
  ) => {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line,
      ),
    );
  };

  const changePaymentMethod = (method: PaymentMethodLabel) => {
    setPaymentMethod(method);
    const matchingAccount = paymentAccounts.find(
      (account) => account.type === methodToPaymentType(method),
    );

    if (matchingAccount) {
      setPaymentAccountId(matchingAccount.id);
    }
  };

  const addLine = () =>
    setLines((currentLines) => [...currentLines, createDraftLine()]);

  const clearLines = () => setLines([createDraftLine()]);

  const removeLine = (lineId: string) => {
    setLines((currentLines) =>
      currentLines.length === 1
        ? [createDraftLine()]
        : currentLines.filter((line) => line.id !== lineId),
    );
  };

  const buildLoanLines = (): DaybookLoanLine[] => {
    const loanLines: DaybookLoanLine[] = [];

    for (const line of lines) {
      const amount = toAmount(line.amount);

      if (amount <= 0) {
        continue;
      }

      loanLines.push({
        amount,
        description: line.description.trim() || "Loan Received",
        id: createDaybookLoanId("saved-loan-line"),
        loanType: line.loanType.trim() || "Business Loan",
      });
    }

    return loanLines;
  };

  const invalidateQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.finance.getPaymentAccounts.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.finance.getLoanAccounts.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.finance.getChartOfAccounts.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.balanceSheet.getBalanceSheet.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.profitLoss.getMonthlyPnL.key(),
      }),
    ]);
  };

  const resetForm = () => {
    setLender("");
    setLoanNo("");
    setReferenceNo("");
    setPaymentAccountId(paymentAccounts[0]?.id ?? "");
    setReceiveDate(dateValue());
    setPaymentMethod(PAYMENT_METHODS[0] ?? "Cash");
    setNotes("");
    setLines([createDraftLine()]);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMessage(null);
      resetForm();
    }

    onOpenChange(nextOpen);
  };

  const saveLoan = async (closeAfterSave: boolean) => {
    const loanLines = buildLoanLines();
    if (!selectedPaymentAccount) {
      setMessage({ text: "Select a deposit account.", tone: "error" });
      return;
    }

    if (loanLines.length === 0) {
      setMessage({
        text: "Enter at least one loan amount.",
        tone: "error",
      });
      return;
    }

    const nextTotal = loanLines.reduce((sum, line) => sum + line.amount, 0);
    const selectedPaymentMethod =
      selectedPaymentAccount.type ?? methodToPaymentType(paymentMethod);

    const localLoan = {
      createdAt: new Date().toISOString(),
      id: createDaybookLoanId("daybook-loan"),
      lender: lender.trim() || "Lender",
      lines: loanLines,
      loanNo: loanNo.trim(),
      notes: notes.trim(),
      paymentAccountId: selectedPaymentAccount.id,
      paymentAccountName: selectedPaymentAccount.name,
      paymentAccountType: selectedPaymentAccount.type,
      paymentMethod: selectedPaymentMethod,
      receiveDate,
      referenceNo: referenceNo.trim(),
      scope,
      total: nextTotal,
    };
    const mutationInput = {
      lender: lender.trim() || undefined,
      lines: loanLines.map((line) => ({
        amount: line.amount,
        description: line.description,
        loanType: line.loanType,
      })),
      loanNo: loanNo.trim() || undefined,
      notes: notes.trim() || undefined,
      paymentAccountId: selectedPaymentAccount.id,
      paymentMethod: selectedPaymentMethod,
      receiveDate,
      referenceNo: referenceNo.trim() || undefined,
    };

    if (closeAfterSave) {
      addDaybookLoan({ ...localLoan, isSynced: false });
      setMessage(null);
      resetForm();
      onOpenChange(false);

      void createLoanMutation
        .mutateAsync(mutationInput)
        .then(() => {
          markDaybookLoanSynced(localLoan.id);
          void invalidateQueries();
        })
        .catch(() => undefined);
      return;
    }

    try {
      const result = await createLoanMutation.mutateAsync(mutationInput);

      addDaybookLoan({ ...localLoan, isSynced: true });

      await invalidateQueries();
      resetForm();
      setMessage({ text: result.message, tone: "success" });
    } catch (error) {
      addDaybookLoan({ ...localLoan, isSynced: false });
      resetForm();

      if (closeAfterSave) {
        setMessage(null);
        onOpenChange(false);
        return;
      }

      setMessage({
        text:
          error instanceof Error
            ? `Saved locally. Sync failed: ${error.message}`
            : "Saved locally. Sync failed.",
        tone: "error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-slate-50 p-0 sm:max-w-6xl">
        <DialogHeader className="border-slate-200 border-b bg-white px-5 py-4">
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Loan Received
          </DialogTitle>
          <DialogDescription>
            Record cash or bank loan proceeds for {scopeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="loan-lender">Lender</Label>
                <Input
                  className="h-10"
                  id="loan-lender"
                  onChange={(event) => setLender(event.target.value)}
                  placeholder="Bank / Individual / Organization"
                  value={lender}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="loan-deposit-account">Deposit account</Label>
                <div className="grid gap-1">
                  <Select
                    onValueChange={setPaymentAccountId}
                    value={paymentAccountId}
                  >
                    <SelectTrigger
                      className="!h-10 min-h-10 w-full border-emerald-500 bg-white"
                      id="loan-deposit-account"
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
                  <span className="font-medium text-slate-600 text-sm">
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

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="loan-receive-date">Receive Date</Label>
              <div className="relative">
                <Input
                  className="h-10"
                  id="loan-receive-date"
                  onChange={(event) => setReceiveDate(event.target.value)}
                  type="date"
                  value={receiveDate}
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="loan-payment-method">Payment Method</Label>
              <Select
                onValueChange={(value) =>
                  changePaymentMethod(value as PaymentMethodLabel)
                }
                value={paymentMethod}
              >
                <SelectTrigger
                  className="!h-10 min-h-10 w-full bg-white"
                  id="loan-payment-method"
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
              <Label htmlFor="loan-reference">Ref no.</Label>
              <Input
                className="h-10"
                id="loan-reference"
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="REF-001"
                value={referenceNo}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="loan-no">Loan no.</Label>
              <Input
                className="h-10"
                id="loan-no"
                onChange={(event) => setLoanNo(event.target.value)}
                placeholder="LN-2026-001"
                value={loanNo}
              />
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <datalist id="loan-account-options">
              {loanAccounts.map((account) => (
                <option key={account.id} value={account.name} />
              ))}
            </datalist>
            <div className="grid grid-cols-[56px_repeat(3,minmax(0,1fr))_56px] border-slate-200 border-b bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-xs uppercase">
              <div>#</div>
              <div>Loan Type</div>
              <div>Description</div>
              <div className="text-right">Amount</div>
              <div />
            </div>
            <div>
              {lines.map((line, index) => (
                <div
                  className="grid grid-cols-[56px_repeat(3,minmax(0,1fr))_56px] items-center gap-2 border-slate-200 border-b px-4 py-3 last:border-b-0"
                  key={line.id}
                >
                  <div className="font-medium text-slate-500">{index + 1}</div>
                  <Input
                    className="h-10 w-full"
                    list="loan-account-options"
                    onChange={(event) =>
                      updateLine(line.id, "loanType", event.target.value)
                    }
                    placeholder="Business Loan"
                    value={line.loanType}
                  />
                  <Input
                    className="h-10 w-full"
                    onChange={(event) =>
                      updateLine(line.id, "description", event.target.value)
                    }
                    placeholder="Loan Received"
                    value={line.description}
                  />
                  <Input
                    className="h-10 w-full text-right tabular-nums"
                    inputMode="decimal"
                    onChange={(event) =>
                      updateLine(line.id, "amount", event.target.value)
                    }
                    placeholder="100,000.00"
                    value={line.amount}
                  />
                  <Button
                    aria-label={`Remove loan line ${index + 1}`}
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
              <Label htmlFor="loan-notes">Notes</Label>
              <Textarea
                className="min-h-36 bg-white"
                id="loan-notes"
                onChange={(event) => setNotes(event.target.value)}
                value={notes}
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
              onClick={() => handleDialogOpenChange(false)}
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
              disabled={createLoanMutation.isPending}
              onClick={() => saveLoan(false)}
              type="button"
              variant="outline"
            >
              <SaveIcon data-icon="inline-start" />
              Save & Share
            </Button>
            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={createLoanMutation.isPending}
              onClick={() => saveLoan(true)}
              type="button"
            >
              Save & Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
