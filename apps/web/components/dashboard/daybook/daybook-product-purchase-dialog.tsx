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
  addDaybookProductPurchase,
  createDaybookProductPurchaseId,
  type DaybookProductPurchaseItem,
  type DaybookProductPurchasePaymentType,
} from "@/components/dashboard/daybook/daybook-product-purchase-ledger";
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

type DaybookProductPurchaseDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
};

type DraftPurchaseItem = {
  amount: string;
  description: string;
  id: string;
  productName: string;
};

const PAYMENT_METHODS = ["Cash", "Bank"] as const;
const PRODUCT_PURCHASE_PAYMENT_TYPES = [
  { label: "Cash / Bank", value: "cash" },
  { label: "Due to supplier", value: "due" },
] as const satisfies {
  label: string;
  value: DaybookProductPurchasePaymentType;
}[];

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

function createDraftItem(): DraftPurchaseItem {
  return {
    amount: "",
    description: "Product Purchased",
    id: createDaybookProductPurchaseId("product-purchase-line"),
    productName: "Product Purchased",
  };
}

export function DaybookProductPurchaseDialog({
  onOpenChange,
  open,
  scope,
}: DaybookProductPurchaseDialogProps) {
  const queryClient = useQueryClient();
  const { data: paymentAccountsData } = useQuery(
    orpc.finance.getPaymentAccounts.queryOptions({ input: {} }),
  );
  const createPurchaseMutation = useMutation(
    orpc.finance.createProductPurchase.mutationOptions(),
  );
  const paymentAccounts = useMemo(
    () => paymentAccountsData?.paymentAccounts ?? [],
    [paymentAccountsData?.paymentAccounts],
  );
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
  const [purchasePaymentType, setPurchasePaymentType] =
    useState<DaybookProductPurchasePaymentType>("cash");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [items, setItems] = useState<DraftPurchaseItem[]>(() => [
    createDraftItem(),
  ]);
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";
  const selectedPaymentAccount = useMemo(
    () => paymentAccounts.find((account) => account.id === paymentAccountId),
    [paymentAccountId, paymentAccounts],
  );
  const total = useMemo(
    () => items.reduce((sum, item) => sum + toAmount(item.amount), 0),
    [items],
  );
  const isDuePurchase = purchasePaymentType === "due";

  useEffect(() => {
    if (
      !isDuePurchase &&
      paymentAccounts.length > 0 &&
      !paymentAccounts.some((account) => account.id === paymentAccountId)
    ) {
      setPaymentAccountId(paymentAccounts[0]?.id ?? "");
    }
  }, [isDuePurchase, paymentAccountId, paymentAccounts]);

  useEffect(() => {
    if (!isDuePurchase) {
      const nextPaymentMethod = paymentTypeToMethod(
        selectedPaymentAccount?.type,
      );
      setPaymentMethod((currentPaymentMethod) =>
        currentPaymentMethod === nextPaymentMethod
          ? currentPaymentMethod
          : nextPaymentMethod,
      );
    }
  }, [isDuePurchase, selectedPaymentAccount?.type]);

  const updateItem = (
    itemId: string,
    field: keyof Omit<DraftPurchaseItem, "id">,
    value: string,
  ) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
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

  const addItem = () =>
    setItems((currentItems) => [...currentItems, createDraftItem()]);

  const clearItems = () => setItems([createDraftItem()]);

  const removeItem = (itemId: string) => {
    setItems((currentItems) =>
      currentItems.length === 1
        ? [createDraftItem()]
        : currentItems.filter((item) => item.id !== itemId),
    );
  };

  const buildPurchaseItems = (): DaybookProductPurchaseItem[] => {
    const purchaseItems: DaybookProductPurchaseItem[] = [];

    for (const item of items) {
      const amount = toAmount(item.amount);

      if (amount <= 0) {
        continue;
      }

      purchaseItems.push({
        amount,
        description: item.description.trim() || "Product Purchased",
        id: createDaybookProductPurchaseId("saved-product-purchase-line"),
        productName: item.productName.trim() || "Product Purchased",
      });
    }

    return purchaseItems;
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
    setBillNo("");
    setReferenceNo("");
    setPaymentAccountId(paymentAccounts[0]?.id ?? "");
    setPaymentDate(dateValue());
    setPaymentMethod(PAYMENT_METHODS[0] ?? "Cash");
    setPurchasePaymentType("cash");
    setNotes("");
    setItems([createDraftItem()]);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMessage(null);
      resetForm();
    }

    onOpenChange(nextOpen);
  };

  const savePurchase = async (closeAfterSave: boolean) => {
    const purchaseItems = buildPurchaseItems();
    if (!isDuePurchase && !selectedPaymentAccount) {
      setMessage({ text: "Select a payment account.", tone: "error" });
      return;
    }

    if (purchaseItems.length === 0) {
      setMessage({
        text: "Enter at least one product purchase amount.",
        tone: "error",
      });
      return;
    }

    const nextTotal = purchaseItems.reduce((sum, item) => sum + item.amount, 0);
    const selectedPaymentMethod = selectedPaymentAccount
      ? (selectedPaymentAccount.type ?? methodToPaymentType(paymentMethod))
      : methodToPaymentType(paymentMethod);

    const localPurchase = {
      billNo: billNo.trim(),
      createdAt: new Date().toISOString(),
      id: createDaybookProductPurchaseId("daybook-product-purchase"),
      items: purchaseItems,
      notes: notes.trim(),
      paymentAccountId: isDuePurchase
        ? "accounts-payable"
        : (selectedPaymentAccount?.id ?? ""),
      paymentAccountName: isDuePurchase
        ? "Accounts Payable"
        : (selectedPaymentAccount?.name ?? ""),
      paymentAccountType: isDuePurchase
        ? undefined
        : selectedPaymentAccount?.type,
      paymentDate,
      paymentMethod: isDuePurchase ? undefined : selectedPaymentMethod,
      paymentType: purchasePaymentType,
      referenceNo: referenceNo.trim(),
      scope,
      supplier: supplier.trim() || "Supplier",
      total: nextTotal,
    };

    try {
      const result = await createPurchaseMutation.mutateAsync({
        billNo: billNo.trim() || undefined,
        items: purchaseItems.map((item) => ({
          amount: item.amount,
          description: item.description,
          productName: item.productName,
        })),
        notes: notes.trim() || undefined,
        paymentAccountId: isDuePurchase
          ? undefined
          : selectedPaymentAccount?.id,
        paymentDate,
        paymentMethod: isDuePurchase ? undefined : selectedPaymentMethod,
        paymentType: purchasePaymentType,
        referenceNo: referenceNo.trim() || undefined,
        supplier: supplier.trim() || undefined,
      });

      addDaybookProductPurchase({ ...localPurchase, isSynced: true });
      await invalidateQueries();
      resetForm();

      if (closeAfterSave) {
        setMessage(null);
        onOpenChange(false);
      } else {
        setMessage({ text: result.message, tone: "success" });
      }
    } catch (error) {
      addDaybookProductPurchase({ ...localPurchase, isSynced: false });
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
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-slate-50 p-0 sm:max-w-6xl">
        <DialogHeader className="border-slate-200 border-b bg-white px-5 py-4">
          <DialogTitle className="text-2xl font-bold text-slate-900">
            Product Purchase
          </DialogTitle>
          <DialogDescription>
            Record product purchase cost for {scopeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5 md:grid-cols-[minmax(200px,1fr)_minmax(180px,220px)_minmax(240px,1fr)]">
              <div className="grid gap-2">
                <Label htmlFor="product-purchase-supplier">Supplier</Label>
                <Input
                  id="product-purchase-supplier"
                  onChange={(event) => setSupplier(event.target.value)}
                  placeholder="ABC Supplier"
                  value={supplier}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="product-purchase-payment-type">
                  Payment type
                </Label>
                <Select
                  onValueChange={(value) =>
                    setPurchasePaymentType(
                      value as DaybookProductPurchasePaymentType,
                    )
                  }
                  value={purchasePaymentType}
                >
                  <SelectTrigger
                    className="w-full bg-white"
                    id="product-purchase-payment-type"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_PURCHASE_PAYMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="product-purchase-payment-account">
                  Payment account
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {isDuePurchase ? (
                    <Input
                      className="border-amber-300 bg-white"
                      disabled
                      id="product-purchase-payment-account"
                      value="Accounts Payable"
                    />
                  ) : (
                    <Select
                      onValueChange={setPaymentAccountId}
                      value={paymentAccountId}
                    >
                      <SelectTrigger
                        className="w-full border-emerald-500 bg-white"
                        id="product-purchase-payment-account"
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
                  )}
                  <span className="whitespace-nowrap font-medium text-slate-600 text-sm">
                    {isDuePurchase
                      ? "Supplier due"
                      : `Balance ${money(selectedPaymentAccount?.balance ?? 0)}`}
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
              <p className="mt-2 text-slate-500 text-sm">
                {isDuePurchase
                  ? "COGS + Accounts Payable"
                  : "Product Purchase Cost"}
              </p>
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
                    {money(isDuePurchase ? 0 : total)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Amount Due</span>
                  <span className="font-semibold tabular-nums">
                    {money(isDuePurchase ? total : 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-[minmax(180px,220px)_minmax(180px,240px)_minmax(180px,240px)_minmax(180px,240px)]">
            <div className="grid gap-2">
              <Label htmlFor="product-purchase-payment-date">
                Payment Date
              </Label>
              <div className="relative">
                <Input
                  id="product-purchase-payment-date"
                  onChange={(event) => setPaymentDate(event.target.value)}
                  type="date"
                  value={paymentDate}
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-purchase-payment-method">
                Payment Method
              </Label>
              {isDuePurchase ? (
                <Input
                  disabled
                  id="product-purchase-payment-method"
                  value="Due"
                />
              ) : (
                <Select
                  onValueChange={(value) =>
                    changePaymentMethod(value as PaymentMethodLabel)
                  }
                  value={paymentMethod}
                >
                  <SelectTrigger
                    className="w-full bg-white"
                    id="product-purchase-payment-method"
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
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-purchase-reference">Ref no.</Label>
              <Input
                id="product-purchase-reference"
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="REF-001"
                value={referenceNo}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-purchase-bill-no">Bill no.</Label>
              <Input
                id="product-purchase-bill-no"
                onChange={(event) => setBillNo(event.target.value)}
                placeholder="BILL-2026-001"
                value={billNo}
              />
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[56px_minmax(240px,1.1fr)_minmax(240px,1fr)_minmax(180px,0.8fr)_56px] border-slate-200 border-b bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-xs uppercase">
              <div>#</div>
              <div>Product Name</div>
              <div>Description</div>
              <div className="text-right">Amount</div>
              <div />
            </div>
            <div>
              {items.map((item, index) => (
                <div
                  className="grid grid-cols-[56px_minmax(240px,1.1fr)_minmax(240px,1fr)_minmax(180px,0.8fr)_56px] items-center border-slate-200 border-b px-4 py-3 last:border-b-0"
                  key={item.id}
                >
                  <div className="font-medium text-slate-500">{index + 1}</div>
                  <Input
                    className="h-9"
                    onChange={(event) =>
                      updateItem(item.id, "productName", event.target.value)
                    }
                    placeholder="Product Purchased"
                    value={item.productName}
                  />
                  <Input
                    className="h-9"
                    onChange={(event) =>
                      updateItem(item.id, "description", event.target.value)
                    }
                    placeholder="Product Purchased"
                    value={item.description}
                  />
                  <Input
                    className="h-9 text-right tabular-nums"
                    inputMode="decimal"
                    onChange={(event) =>
                      updateItem(item.id, "amount", event.target.value)
                    }
                    placeholder="40,000.00"
                    value={item.amount}
                  />
                  <Button
                    aria-label={`Remove product purchase line ${index + 1}`}
                    className="ml-2 text-slate-400 hover:text-red-600"
                    onClick={() => removeItem(item.id)}
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
            <Button onClick={addItem} type="button" variant="outline">
              <PlusIcon data-icon="inline-start" />
              Add lines
            </Button>
            <Button onClick={clearItems} type="button" variant="outline">
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
              <Label htmlFor="product-purchase-notes">Notes</Label>
              <Textarea
                className="min-h-36 bg-white"
                id="product-purchase-notes"
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
              disabled={createPurchaseMutation.isPending}
              onClick={() => savePurchase(false)}
              type="button"
              variant="outline"
            >
              <SaveIcon data-icon="inline-start" />
              Save & Share
            </Button>
            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={createPurchaseMutation.isPending}
              onClick={() => savePurchase(true)}
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
