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
import {
  addDaybookCustomerAdvance,
  createDaybookCustomerAdvanceId,
  markDaybookCustomerAdvanceSynced,
} from "@/components/dashboard/daybook/daybook-customer-advance-ledger";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import { useDaybookBills } from "@/components/dashboard/daybook/use-daybook-bills";
import { useDaybookProductSales } from "@/components/dashboard/daybook/use-daybook-product-sales";
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

type DaybookCustomerAdvanceDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
};

const PAYMENT_METHODS = ["Cash", "Bank"] as const;
const ADVANCE_TYPES = ["Customer Advance"] as const;
const DEFAULT_ADVANCE_DESCRIPTION = "Advance Payment Received";

type PaymentMethodLabel = (typeof PAYMENT_METHODS)[number];
type AdvanceType = (typeof ADVANCE_TYPES)[number];

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

export function DaybookCustomerAdvanceDialog({
  onOpenChange,
  open,
  scope,
}: DaybookCustomerAdvanceDialogProps) {
  const queryClient = useQueryClient();
  const { data: paymentAccountsData } = useQuery(
    orpc.finance.getPaymentAccounts.queryOptions({ input: {} }),
  );
  const createAdvanceMutation = useMutation(
    orpc.finance.createCustomerAdvancePayment.mutationOptions(),
  );
  const savedBills = useDaybookBills(scope);
  const savedProductSales = useDaybookProductSales(scope);
  const paymentAccounts = useMemo(
    () => paymentAccountsData?.paymentAccounts ?? [],
    [paymentAccountsData?.paymentAccounts],
  );
  const [customer, setCustomer] = useState("");
  const [customerFocused, setCustomerFocused] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [depositAccountId, setDepositAccountId] = useState(
    paymentAccounts[0]?.id ?? "",
  );
  const [receiveDate, setReceiveDate] = useState(dateValue);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodLabel>(
    PAYMENT_METHODS[0] ?? "Cash",
  );
  const [advanceType, setAdvanceType] = useState<AdvanceType>(
    ADVANCE_TYPES[0] ?? "Customer Advance",
  );
  const [description, setDescription] = useState(DEFAULT_ADVANCE_DESCRIPTION);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";
  const selectedDepositAccount = useMemo(
    () => paymentAccounts.find((account) => account.id === depositAccountId),
    [depositAccountId, paymentAccounts],
  );
  const customerOptions = useMemo(
    () =>
      buildDaybookBillPayeeOptions({
        bills: savedBills,
        partyType: "customer",
        productSales: savedProductSales,
      }),
    [savedBills, savedProductSales],
  );
  const filteredCustomers = useMemo(
    () => filterDaybookBillPayees(customerOptions, customer).slice(0, 6),
    [customer, customerOptions],
  );
  const total = useMemo(() => toAmount(amount), [amount]);

  useEffect(() => {
    if (
      paymentAccounts.length > 0 &&
      !paymentAccounts.some((account) => account.id === depositAccountId)
    ) {
      setDepositAccountId(paymentAccounts[0]?.id ?? "");
    }
  }, [depositAccountId, paymentAccounts]);

  useEffect(() => {
    const nextPaymentMethod = paymentTypeToMethod(selectedDepositAccount?.type);
    setPaymentMethod((currentPaymentMethod) =>
      currentPaymentMethod === nextPaymentMethod
        ? currentPaymentMethod
        : nextPaymentMethod,
    );
  }, [selectedDepositAccount?.type]);

  const changePaymentMethod = (method: PaymentMethodLabel) => {
    setPaymentMethod(method);
    const matchingAccount = paymentAccounts.find(
      (account) => account.type === methodToPaymentType(method),
    );

    if (matchingAccount) {
      setDepositAccountId(matchingAccount.id);
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
    setCustomer("");
    setCustomerFocused(false);
    setCustomerId("");
    setReferenceNo("");
    setDepositAccountId(paymentAccounts[0]?.id ?? "");
    setReceiveDate(dateValue());
    setPaymentMethod(PAYMENT_METHODS[0] ?? "Cash");
    setAdvanceType(ADVANCE_TYPES[0] ?? "Customer Advance");
    setDescription(DEFAULT_ADVANCE_DESCRIPTION);
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
    if (!selectedDepositAccount) {
      setMessage({ text: "Select a deposit account.", tone: "error" });
      return;
    }

    if (total <= 0) {
      setMessage({
        text: "Enter a customer advance amount.",
        tone: "error",
      });
      return;
    }

    const selectedPaymentMethod =
      selectedDepositAccount.type ?? methodToPaymentType(paymentMethod);
    const localAdvance = {
      advanceType,
      amount: total,
      createdAt: new Date().toISOString(),
      customer: customer.trim() || "XYZ Customer",
      customerId: customerId.trim(),
      description: description.trim() || "Advance received before delivery",
      depositAccountId: selectedDepositAccount.id,
      depositAccountName: selectedDepositAccount.name,
      depositAccountType: selectedDepositAccount.type,
      id: createDaybookCustomerAdvanceId("daybook-customer-advance"),
      notes: notes.trim(),
      paymentMethod: selectedPaymentMethod,
      receiveDate,
      referenceNo: referenceNo.trim(),
      scope,
    };
    const mutationInput = {
      advanceType,
      amount: total,
      customer: customer.trim() || undefined,
      customerId: customerId.trim() || undefined,
      depositAccountId: selectedDepositAccount.id,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      paymentMethod: selectedPaymentMethod,
      receiveDate,
      referenceNo: referenceNo.trim() || undefined,
    };

    if (closeAfterSave) {
      addDaybookCustomerAdvance({ ...localAdvance, isSynced: false });
      setMessage(null);
      resetForm();
      onOpenChange(false);

      void createAdvanceMutation
        .mutateAsync(mutationInput)
        .then(() => {
          markDaybookCustomerAdvanceSynced(localAdvance.id);
          void invalidateQueries();
        })
        .catch(() => undefined);
      return;
    }

    try {
      const result = await createAdvanceMutation.mutateAsync(mutationInput);

      addDaybookCustomerAdvance({ ...localAdvance, isSynced: true });

      await invalidateQueries();
      resetForm();
      setMessage({ text: result.message, tone: "success" });
    } catch (error) {
      addDaybookCustomerAdvance({ ...localAdvance, isSynced: false });
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
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-slate-50 p-0 sm:max-w-5xl">
        <DialogHeader className="border-slate-200 border-b bg-white px-5 py-4">
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Customer Advance
          </DialogTitle>
          <DialogDescription>
            Record advance payment received from a customer for {scopeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="customer-advance-customer">Name *</Label>
              <div className="grid gap-1">
                <div className="relative">
                  <Input
                    autoComplete="off"
                    className="h-10"
                    id="customer-advance-customer"
                    onBlur={() =>
                      window.setTimeout(() => setCustomerFocused(false), 120)
                    }
                    onChange={(event) => {
                      setCustomer(event.target.value);
                      setCustomerFocused(true);
                    }}
                    onFocus={() => setCustomerFocused(true)}
                    placeholder="Select customer"
                    value={customer}
                  />
                  {customerFocused && filteredCustomers.length > 0 ? (
                    <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                      {filteredCustomers.map((customerOption) => (
                        <button
                          className="flex w-full flex-col rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
                          key={customerOption.id}
                          onClick={() => {
                            setCustomer(customerOption.name);
                            setCustomerFocused(false);
                          }}
                          onMouseDown={(event) => event.preventDefault()}
                          type="button"
                        >
                          <span className="truncate font-medium text-slate-900">
                            {customerOption.name}
                          </span>
                          <span className="text-slate-500 text-xs">
                            {customerOption.subtitle}
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
              <Label htmlFor="customer-advance-customer-id">Customer ID</Label>
              <div className="grid gap-1">
                <Input
                  className="h-10"
                  id="customer-advance-customer-id"
                  onChange={(event) => setCustomerId(event.target.value)}
                  placeholder="CUS-2026-001"
                  value={customerId}
                />
                <span aria-hidden="true" className="h-5 text-sm">
                  &nbsp;
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <div className="grid gap-1">
                <div className="flex h-10 items-center font-medium text-slate-900">
                  Received
                </div>
                <span aria-hidden="true" className="h-5 text-sm">
                  &nbsp;
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Amount</Label>
              <div className="grid gap-1">
                <div className="flex h-10 items-center font-bold text-slate-900 tabular-nums">
                  {money(total)}
                </div>
                <span aria-hidden="true" className="h-5 text-sm">
                  &nbsp;
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="customer-advance-reference">Reference No</Label>
              <div className="grid gap-1">
                <Input
                  className="h-10"
                  id="customer-advance-reference"
                  onChange={(event) => setReferenceNo(event.target.value)}
                  placeholder="REF-001"
                  value={referenceNo}
                />
                <span aria-hidden="true" className="h-5 text-sm">
                  &nbsp;
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customer-advance-receive-date">
                Receive Date
              </Label>
              <div className="grid gap-1">
                <div className="relative">
                  <Input
                    className="h-10"
                    id="customer-advance-receive-date"
                    onChange={(event) => setReceiveDate(event.target.value)}
                    type="date"
                    value={receiveDate}
                  />
                  <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                </div>
                <span aria-hidden="true" className="h-5 text-sm">
                  &nbsp;
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customer-advance-payment-method">
                Payment Method
              </Label>
              <div className="grid gap-1">
                <Select
                  onValueChange={(value) =>
                    changePaymentMethod(value as PaymentMethodLabel)
                  }
                  value={paymentMethod}
                >
                  <SelectTrigger
                    className="!h-10 min-h-10 w-full bg-white"
                    id="customer-advance-payment-method"
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
                <span aria-hidden="true" className="h-5 text-sm">
                  &nbsp;
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="customer-advance-deposit-account">
                Deposit Account*
              </Label>
              <div className="grid gap-1">
                <Select
                  onValueChange={setDepositAccountId}
                  value={depositAccountId}
                >
                  <SelectTrigger
                    className="!h-10 min-h-10 w-full border-emerald-500 bg-white"
                    id="customer-advance-deposit-account"
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
                <span className="h-5 font-medium text-slate-600 text-sm">
                  Balance {money(selectedDepositAccount?.balance ?? 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[minmax(150px,0.8fr)_minmax(260px,1.6fr)_minmax(160px,0.8fr)] border-slate-200 border-b bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-sm">
              <span>ADVANCE TYPE *</span>
              <span>DESCRIPTION</span>
              <span className="text-right">AMOUNT</span>
            </div>
            <div className="grid grid-cols-[minmax(150px,0.8fr)_minmax(260px,1.6fr)_minmax(160px,0.8fr)] items-center gap-2 px-4 py-4">
              <Select
                onValueChange={(value) => setAdvanceType(value as AdvanceType)}
                value={advanceType}
              >
                <SelectTrigger className="!h-10 min-h-10 w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADVANCE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label="Advance description"
                className="h-10 w-full"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Advance Payment Received"
                value={description}
              />
              <Input
                className="h-10 w-full text-right tabular-nums"
                id="customer-advance-amount"
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
              <Label htmlFor="customer-advance-notes">Notes</Label>
              <Textarea
                className="min-h-36 bg-white"
                id="customer-advance-notes"
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
