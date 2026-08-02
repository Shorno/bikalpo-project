"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarIcon,
  PaperclipIcon,
  PrinterIcon,
  RepeatIcon,
  SaveIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildDaybookBillPayeeOptions,
  filterDaybookBillPayees,
} from "@/components/dashboard/daybook/daybook-bill-payees";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import {
  addDaybookSupplierAdvance,
  createDaybookSupplierAdvanceId,
} from "@/components/dashboard/daybook/daybook-supplier-advance-ledger";
import { useDaybookBills } from "@/components/dashboard/daybook/use-daybook-bills";
import { useDaybookProductPurchases } from "@/components/dashboard/daybook/use-daybook-product-purchases";
import { useRetailerSuppliers } from "@/components/dashboard/daybook/use-retailer-suppliers";
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

type DaybookSupplierAdvanceDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
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

export function DaybookSupplierAdvanceDialog({
  onOpenChange,
  open,
  scope,
}: DaybookSupplierAdvanceDialogProps) {
  const queryClient = useQueryClient();
  const { data: paymentAccountsData } = useQuery(
    orpc.finance.getPaymentAccounts.queryOptions({ input: {} }),
  );
  const createAdvanceMutation = useMutation(
    orpc.finance.createSupplierAdvancePayment.mutationOptions(),
  );
  const savedBills = useDaybookBills(scope);
  const savedProductPurchases = useDaybookProductPurchases(scope);
  const retailerSuppliers = useRetailerSuppliers(scope);
  const paymentAccounts = useMemo(
    () => paymentAccountsData?.paymentAccounts ?? [],
    [paymentAccountsData?.paymentAccounts],
  );
  const [supplier, setSupplier] = useState("");
  const [supplierFocused, setSupplierFocused] = useState(false);
  const [advanceNo, setAdvanceNo] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState(
    paymentAccounts[0]?.id ?? "",
  );
  const [paymentDate, setPaymentDate] = useState(dateValue);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodLabel>(
    PAYMENT_METHODS[0] ?? "Cash",
  );
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";
  const selectedPaymentAccount = useMemo(
    () => paymentAccounts.find((account) => account.id === paymentAccountId),
    [paymentAccountId, paymentAccounts],
  );
  const supplierOptions = useMemo(
    () =>
      buildDaybookBillPayeeOptions({
        bills: savedBills,
        externalPayees: retailerSuppliers,
        partyType: "supplier",
        productPurchases: savedProductPurchases,
      }),
    [retailerSuppliers, savedBills, savedProductPurchases],
  );
  const filteredSuppliers = useMemo(
    () => filterDaybookBillPayees(supplierOptions, supplier).slice(0, 6),
    [supplier, supplierOptions],
  );
  const total = useMemo(() => toAmount(amount), [amount]);

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

  const changePaymentMethod = (method: PaymentMethodLabel) => {
    setPaymentMethod(method);
    const matchingAccount = paymentAccounts.find(
      (account) => account.type === methodToPaymentType(method),
    );

    if (matchingAccount) {
      setPaymentAccountId(matchingAccount.id);
    }
  };

  const invalidateQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.finance.getPaymentAccounts.key(),
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
    setSupplier("");
    setSupplierFocused(false);
    setAdvanceNo("");
    setReferenceNo("");
    setPaymentAccountId(paymentAccounts[0]?.id ?? "");
    setPaymentDate(dateValue());
    setPaymentMethod(PAYMENT_METHODS[0] ?? "Cash");
    setAmount("");
    setNotes("");
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMessage(null);
      resetForm();
    }

    onOpenChange(nextOpen);
  };

  const saveAdvance = async (closeAfterSave: boolean) => {
    if (!selectedPaymentAccount) {
      setMessage({ text: "Select a payment account.", tone: "error" });
      return;
    }

    if (total <= 0) {
      setMessage({
        text: "Enter a supplier advance amount.",
        tone: "error",
      });
      return;
    }

    if (selectedPaymentAccount.balance < total) {
      setMessage({
        text: `Insufficient ${selectedPaymentAccount.name} balance. Available ${money(
          selectedPaymentAccount.balance,
        )}.`,
        tone: "error",
      });
      return;
    }

    const selectedPaymentMethod =
      selectedPaymentAccount.type ?? methodToPaymentType(paymentMethod);
    const localAdvance = {
      advanceNo: advanceNo.trim(),
      amount: total,
      createdAt: new Date().toISOString(),
      id: createDaybookSupplierAdvanceId("daybook-supplier-advance"),
      notes: notes.trim(),
      paymentAccountId: selectedPaymentAccount.id,
      paymentAccountName: selectedPaymentAccount.name,
      paymentAccountType: selectedPaymentAccount.type,
      paymentDate,
      paymentMethod: selectedPaymentMethod,
      referenceNo: referenceNo.trim(),
      scope,
      supplier: supplier.trim() || "ABC Supplier",
    };
    const mutationInput = {
      advanceNo: advanceNo.trim() || undefined,
      amount: total,
      notes: notes.trim() || undefined,
      paymentAccountId: selectedPaymentAccount.id,
      paymentDate,
      paymentMethod: selectedPaymentMethod,
      referenceNo: referenceNo.trim() || undefined,
      supplier: supplier.trim() || undefined,
    };

    if (closeAfterSave) {
      try {
        await createAdvanceMutation.mutateAsync(mutationInput);

        addDaybookSupplierAdvance({ ...localAdvance, isSynced: true });

        void invalidateQueries();
        resetForm();
        onOpenChange(false);
        setMessage(null);
      } catch (error) {
        setMessage({
          text:
            error instanceof Error
              ? error.message
              : "Supplier advance could not be saved.",
          tone: "error",
        });
      }
      return;
    }

    try {
      const result = await createAdvanceMutation.mutateAsync(mutationInput);

      addDaybookSupplierAdvance({ ...localAdvance, isSynced: true });

      await invalidateQueries();
      resetForm();
      setMessage({ text: result.message, tone: "success" });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Supplier advance could not be saved.",
        tone: "error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-slate-50 p-0 sm:max-w-5xl">
        <DialogHeader className="border-slate-200 border-b bg-white px-5 py-4">
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Supplier Advance Payment
          </DialogTitle>
          <DialogDescription>
            Record cash or bank advance paid to a supplier for {scopeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="supplier-advance-supplier">Supplier</Label>
                <div className="grid gap-1">
                  <div className="relative">
                    <Input
                      autoComplete="off"
                      className="h-10"
                      id="supplier-advance-supplier"
                      onBlur={() =>
                        window.setTimeout(() => setSupplierFocused(false), 120)
                      }
                      onChange={(event) => {
                        setSupplier(event.target.value);
                        setSupplierFocused(true);
                      }}
                      onFocus={() => setSupplierFocused(true)}
                      placeholder="Select supplier"
                      value={supplier}
                    />
                    {supplierFocused && filteredSuppliers.length > 0 ? (
                      <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                        {filteredSuppliers.map((supplierOption) => (
                          <button
                            className="flex w-full flex-col rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
                            key={supplierOption.id}
                            onClick={() => {
                              setSupplier(supplierOption.name);
                              setSupplierFocused(false);
                            }}
                            onMouseDown={(event) => event.preventDefault()}
                            type="button"
                          >
                            <span className="truncate font-medium text-slate-900">
                              {supplierOption.name}
                            </span>
                            <span className="text-slate-500 text-xs">
                              {supplierOption.subtitle}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span aria-hidden="true" className="h-5 text-sm">
                    &nbsp;
                  </span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="supplier-advance-payment-account">
                  Payment account
                </Label>
                <div className="grid gap-1">
                  <Select
                    onValueChange={setPaymentAccountId}
                    value={paymentAccountId}
                  >
                    <SelectTrigger
                      className="!h-10 min-h-10 w-full border-emerald-500 bg-white"
                      id="supplier-advance-payment-account"
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
              <Label htmlFor="supplier-advance-payment-date">
                Payment Date
              </Label>
              <div className="relative">
                <Input
                  className="h-10"
                  id="supplier-advance-payment-date"
                  onChange={(event) => setPaymentDate(event.target.value)}
                  type="date"
                  value={paymentDate}
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplier-advance-payment-method">
                Payment Method
              </Label>
              <Select
                onValueChange={(value) =>
                  changePaymentMethod(value as PaymentMethodLabel)
                }
                value={paymentMethod}
              >
                <SelectTrigger
                  className="!h-10 min-h-10 w-full bg-white"
                  id="supplier-advance-payment-method"
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
              <Label htmlFor="supplier-advance-reference">Ref no.</Label>
              <Input
                className="h-10"
                id="supplier-advance-reference"
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="REF-001"
                value={referenceNo}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplier-advance-number">Advance no.</Label>
              <Input
                className="h-10"
                id="supplier-advance-number"
                onChange={(event) => setAdvanceNo(event.target.value)}
                placeholder="ADV-2026-001"
                value={advanceNo}
              />
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[56px_repeat(3,minmax(0,1fr))] border-slate-200 border-b bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-xs uppercase">
              <div>#</div>
              <div>Advance Type</div>
              <div>Description</div>
              <div className="text-right">Amount</div>
            </div>
            <div className="grid grid-cols-[56px_repeat(3,minmax(0,1fr))] items-center gap-2 border-slate-200 border-b px-4 py-3 last:border-b-0">
              <div className="font-medium text-slate-500">1</div>
              <div className="font-medium text-slate-900">Supplier Advance</div>
              <Input
                className="h-10 w-full"
                readOnly
                value="Advance paid before bill is applied"
              />
              <Input
                className="h-10 w-full text-right tabular-nums"
                id="supplier-advance-amount"
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="50,000.00"
                value={amount}
              />
            </div>
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
              <Label htmlFor="supplier-advance-notes">Notes</Label>
              <Textarea
                className="min-h-36 bg-white"
                id="supplier-advance-notes"
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
              disabled={createAdvanceMutation.isPending}
              onClick={() => saveAdvance(false)}
              type="button"
              variant="outline"
            >
              <SaveIcon data-icon="inline-start" />
              Save & Share
            </Button>
            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={createAdvanceMutation.isPending}
              onClick={() => saveAdvance(true)}
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
