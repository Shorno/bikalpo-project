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
  addDaybookFixedAssetPurchase,
  createDaybookFixedAssetId,
  type DaybookFixedAssetLine,
} from "@/components/dashboard/daybook/daybook-fixed-asset-ledger";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";

type DaybookFixedAssetDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
};

type DraftFixedAssetLine = {
  accountId: string;
  accountName: string;
  amount: string;
  id: string;
  productName: string;
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

function createDraftLine(): DraftFixedAssetLine {
  return {
    accountId: "",
    accountName: "Furniture",
    amount: "",
    id: createDaybookFixedAssetId("fixed-asset-line"),
    productName: "Furniture Purchased",
  };
}

export function DaybookFixedAssetDialog({
  onOpenChange,
  open,
  scope,
}: DaybookFixedAssetDialogProps) {
  const queryClient = useQueryClient();
  const { data: paymentAccountsData } = useQuery(
    orpc.finance.getPaymentAccounts.queryOptions({ input: {} }),
  );
  const { data: assetAccountsData } = useQuery(
    orpc.finance.getFixedAssetAccounts.queryOptions({ input: {} }),
  );
  const createPurchaseMutation = useMutation(
    orpc.finance.createFixedAssetPurchase.mutationOptions(),
  );
  const paymentAccounts = paymentAccountsData?.paymentAccounts ?? [];
  const assetAccounts = assetAccountsData?.accounts ?? [];
  const [supplier, setSupplier] = useState("");
  const [billNo, setBillNo] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState(
    paymentAccounts[0]?.id ?? "",
  );
  const [paymentDate, setPaymentDate] = useState(dateValue);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodLabel>(
    PAYMENT_METHODS[0] ?? "Cash",
  );
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [lines, setLines] = useState<DraftFixedAssetLine[]>(() => [
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
    setPaymentMethod(paymentTypeToMethod(selectedPaymentAccount?.type));
  }, [selectedPaymentAccount]);

  useEffect(() => {
    if (!open) {
      setMessage(null);
      setSupplier("");
      setBillNo("");
      setReferenceNo("");
      setPaymentAccountId(paymentAccounts[0]?.id ?? "");
      setPaymentDate(dateValue());
      setPaymentMethod(PAYMENT_METHODS[0] ?? "Cash");
      setNotes("");
      setLines([createDraftLine()]);
    }
  }, [open, paymentAccounts]);

  const updateLine = (
    lineId: string,
    field: keyof Omit<DraftFixedAssetLine, "id">,
    value: string,
  ) => {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line,
      ),
    );
  };

  const updateAccountName = (lineId: string, value: string) => {
    const matchedAccount = assetAccounts.find(
      (account) => account.name.toLowerCase() === value.trim().toLowerCase(),
    );

    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              accountId: matchedAccount?.id ?? "",
              accountName: value,
            }
          : line,
      ),
    );
  };

  const addLine = () =>
    setLines((currentLines) => [...currentLines, createDraftLine()]);

  const clearLines = () => setLines([createDraftLine()]);

  const changePaymentMethod = (method: PaymentMethodLabel) => {
    setPaymentMethod(method);
    const matchingAccount = paymentAccounts.find(
      (account) => account.type === methodToPaymentType(method),
    );

    if (matchingAccount) {
      setPaymentAccountId(matchingAccount.id);
    }
  };

  const removeLine = (lineId: string) => {
    setLines((currentLines) =>
      currentLines.length === 1
        ? [createDraftLine()]
        : currentLines.filter((line) => line.id !== lineId),
    );
  };

  const buildPurchaseLines = (): DaybookFixedAssetLine[] => {
    const purchaseLines: DaybookFixedAssetLine[] = [];

    for (const line of lines) {
      const amount = toAmount(line.amount);

      if (amount <= 0) {
        continue;
      }

      purchaseLines.push({
        accountId: line.accountId,
        accountName: line.accountName.trim() || "Furniture",
        amount,
        id: createDaybookFixedAssetId("saved-fixed-asset-line"),
        productName: line.productName.trim() || "Fixed Asset Purchase",
      });
    }

    return purchaseLines;
  };

  const invalidateQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.finance.getPaymentAccounts.key(),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.finance.getFixedAssetAccounts.key(),
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
    setBillNo("");
    setReferenceNo("");
    setPaymentAccountId(paymentAccounts[0]?.id ?? "");
    setPaymentDate(dateValue());
    setPaymentMethod(PAYMENT_METHODS[0] ?? "Cash");
    setNotes("");
    setLines([createDraftLine()]);
  };

  const savePurchase = async (closeAfterSave: boolean) => {
    const purchaseLines = buildPurchaseLines();
    if (!selectedPaymentAccount) {
      setMessage({ text: "Select a payment account.", tone: "error" });
      return;
    }

    if (purchaseLines.length === 0) {
      setMessage({
        text: "Enter at least one fixed asset amount.",
        tone: "error",
      });
      return;
    }

    const nextTotal = purchaseLines.reduce((sum, line) => sum + line.amount, 0);
    const selectedPaymentMethod =
      selectedPaymentAccount.type ?? methodToPaymentType(paymentMethod);

    const localPurchase = {
      billNo: billNo.trim(),
      createdAt: new Date().toISOString(),
      id: createDaybookFixedAssetId("daybook-fixed-asset"),
      lines: purchaseLines,
      notes: notes.trim(),
      paymentAccountId: selectedPaymentAccount.id,
      paymentAccountName: selectedPaymentAccount.name,
      paymentAccountType: selectedPaymentAccount.type,
      paymentDate,
      paymentMethod: selectedPaymentMethod,
      referenceNo: referenceNo.trim(),
      scope,
      supplier: supplier.trim() || "Vendor",
      total: nextTotal,
    };

    try {
      const result = await createPurchaseMutation.mutateAsync({
        billNo: billNo.trim() || undefined,
        lines: purchaseLines.map((line) => ({
          accountId: line.accountId || undefined,
          accountName: line.accountName,
          price: line.amount,
          productName: line.productName,
        })),
        notes: notes.trim() || undefined,
        paymentAccountId: selectedPaymentAccount.id,
        paymentDate,
        paymentMethod: selectedPaymentMethod,
        referenceNo: referenceNo.trim() || undefined,
        supplier: supplier.trim() || undefined,
      });

      addDaybookFixedAssetPurchase({ ...localPurchase, isSynced: true });
      await invalidateQueries();
      resetForm();
      setMessage({ text: result.message, tone: "success" });

      if (closeAfterSave) {
        onOpenChange(false);
      }
    } catch (error) {
      addDaybookFixedAssetPurchase({ ...localPurchase, isSynced: false });
      resetForm();
      setMessage({
        text:
          error instanceof Error
            ? `Saved locally. Sync failed: ${error.message}`
            : "Saved locally. Sync failed.",
        tone: "error",
      });

      if (closeAfterSave) {
        onOpenChange(false);
      }
    }
  };

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

        <div className="px-5 py-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5 md:grid-cols-[minmax(220px,360px)_minmax(260px,1fr)]">
              <div className="grid gap-2">
                <Label htmlFor="fixed-asset-supplier">Supplier</Label>
                <Input
                  id="fixed-asset-supplier"
                  onChange={(event) => setSupplier(event.target.value)}
                  placeholder="Supplier name"
                  value={supplier}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fixed-asset-payment-account">
                  Payment account
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    onValueChange={setPaymentAccountId}
                    value={paymentAccountId}
                  >
                    <SelectTrigger
                      className="w-full border-emerald-500 bg-white"
                      id="fixed-asset-payment-account"
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
              <p className="mt-2 text-slate-500 text-sm">Paid from cash/bank</p>
              <div className="mt-4 grid gap-2 border-slate-200 border-t pt-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold tabular-nums">
                    {money(total)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Total Paid</span>
                  <span className="font-semibold tabular-nums">
                    {money(total)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Amount Due</span>
                  <span className="font-semibold tabular-nums">{money(0)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-[minmax(180px,220px)_minmax(180px,240px)_minmax(180px,240px)_minmax(180px,240px)]">
            <div className="grid gap-2">
              <Label htmlFor="fixed-asset-payment-date">Payment Date</Label>
              <div className="relative">
                <Input
                  id="fixed-asset-payment-date"
                  onChange={(event) => setPaymentDate(event.target.value)}
                  type="date"
                  value={paymentDate}
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fixed-asset-payment-method">Payment Method</Label>
              <Select
                onValueChange={(value) =>
                  changePaymentMethod(value as PaymentMethodLabel)
                }
                value={paymentMethod}
              >
                <SelectTrigger
                  className="w-full bg-white"
                  id="fixed-asset-payment-method"
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
              <Label htmlFor="fixed-asset-reference">Ref no.</Label>
              <Input
                id="fixed-asset-reference"
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="Reference"
                value={referenceNo}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fixed-asset-bill-no">Bill no.</Label>
              <Input
                id="fixed-asset-bill-no"
                onChange={(event) => setBillNo(event.target.value)}
                placeholder="Bill number"
                value={billNo}
              />
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <datalist id="fixed-asset-account-options">
              {assetAccounts.map((account) => (
                <option key={account.id} value={account.name} />
              ))}
            </datalist>
            <div className="grid grid-cols-[56px_minmax(180px,0.9fr)_minmax(240px,1.2fr)_minmax(180px,1fr)_56px] border-slate-200 border-b bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-xs uppercase">
              <div>#</div>
              <div>Account Name</div>
              <div>Product Name</div>
              <div className="text-right">Price</div>
              <div />
            </div>
            <div>
              {lines.map((line, index) => (
                <div
                  className="grid grid-cols-[56px_minmax(180px,0.9fr)_minmax(240px,1.2fr)_minmax(180px,1fr)_56px] items-center border-slate-200 border-b px-4 py-3 last:border-b-0"
                  key={line.id}
                >
                  <div className="font-medium text-slate-500">{index + 1}</div>
                  <Input
                    className="h-9"
                    onChange={(event) =>
                      updateAccountName(line.id, event.target.value)
                    }
                    list="fixed-asset-account-options"
                    placeholder="Furniture"
                    value={line.accountName}
                  />
                  <Input
                    className="h-9"
                    onChange={(event) =>
                      updateLine(line.id, "productName", event.target.value)
                    }
                    placeholder="Furniture Purchased"
                    value={line.productName}
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
                    aria-label={`Remove fixed asset line ${index + 1}`}
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
              <Label htmlFor="fixed-asset-notes">Notes</Label>
              <Textarea
                className="min-h-36 bg-white"
                id="fixed-asset-notes"
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
              onClick={() => onOpenChange(false)}
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
              disabled={createPurchaseMutation.isPending}
              onClick={() => savePurchase(false)}
              type="button"
              variant="outline"
            >
              <SaveIcon data-icon="inline-start" />
              Save
            </Button>
            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={createPurchaseMutation.isPending}
              onClick={() => savePurchase(true)}
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
