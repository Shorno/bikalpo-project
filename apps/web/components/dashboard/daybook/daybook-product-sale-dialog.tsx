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
  addDaybookProductSale,
  createDaybookProductSaleId,
  type DaybookProductSaleItem,
  type DaybookProductSalePaymentType,
} from "@/components/dashboard/daybook/daybook-product-sale-ledger";
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

type DaybookProductSaleDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
};

type DraftSaleItem = {
  description: string;
  id: string;
  productCost: string;
  productName: string;
  saleAmount: string;
};

const PAYMENT_METHODS = ["Cash", "Bank"] as const;
const PRODUCT_SALE_PAYMENT_TYPES = [
  { label: "Cash / Bank", value: "cash" },
  { label: "Due from customer", value: "due" },
] as const satisfies {
  label: string;
  value: DaybookProductSalePaymentType;
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

function createDraftItem(): DraftSaleItem {
  return {
    description: "Product Sold",
    id: createDaybookProductSaleId("product-sale-line"),
    productCost: "",
    productName: "Product Sold",
    saleAmount: "",
  };
}

export function DaybookProductSaleDialog({
  onOpenChange,
  open,
  scope,
}: DaybookProductSaleDialogProps) {
  const queryClient = useQueryClient();
  const { data: paymentAccountsData } = useQuery(
    orpc.finance.getPaymentAccounts.queryOptions({ input: {} }),
  );
  const createSaleMutation = useMutation(
    orpc.finance.createProductSale.mutationOptions(),
  );
  const paymentAccounts = useMemo(
    () => paymentAccountsData?.paymentAccounts ?? [],
    [paymentAccountsData?.paymentAccounts],
  );
  const [customer, setCustomer] = useState("");
  const [saleNo, setSaleNo] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState(
    paymentAccounts[0]?.id ?? "",
  );
  const [saleDate, setSaleDate] = useState(dateValue);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodLabel>(
    PAYMENT_METHODS[0] ?? "Cash",
  );
  const [salePaymentType, setSalePaymentType] =
    useState<DaybookProductSalePaymentType>("cash");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [items, setItems] = useState<DraftSaleItem[]>(() => [
    createDraftItem(),
  ]);
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";
  const selectedPaymentAccount = useMemo(
    () => paymentAccounts.find((account) => account.id === paymentAccountId),
    [paymentAccountId, paymentAccounts],
  );
  const totalSales = useMemo(
    () => items.reduce((sum, item) => sum + toAmount(item.saleAmount), 0),
    [items],
  );
  const totalCost = useMemo(
    () => items.reduce((sum, item) => sum + toAmount(item.productCost), 0),
    [items],
  );
  const grossProfit = totalSales - totalCost;
  const isDueSale = salePaymentType === "due";

  useEffect(() => {
    if (
      !isDueSale &&
      paymentAccounts.length > 0 &&
      !paymentAccounts.some((account) => account.id === paymentAccountId)
    ) {
      setPaymentAccountId(paymentAccounts[0]?.id ?? "");
    }
  }, [isDueSale, paymentAccountId, paymentAccounts]);

  useEffect(() => {
    if (!isDueSale) {
      const nextPaymentMethod = paymentTypeToMethod(
        selectedPaymentAccount?.type,
      );
      setPaymentMethod((currentPaymentMethod) =>
        currentPaymentMethod === nextPaymentMethod
          ? currentPaymentMethod
          : nextPaymentMethod,
      );
    }
  }, [isDueSale, selectedPaymentAccount?.type]);

  const updateItem = (
    itemId: string,
    field: keyof Omit<DraftSaleItem, "id">,
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

  const buildSaleItems = (): DaybookProductSaleItem[] => {
    const saleItems: DaybookProductSaleItem[] = [];

    for (const item of items) {
      const saleAmount = toAmount(item.saleAmount);

      if (saleAmount <= 0) {
        continue;
      }

      saleItems.push({
        description: item.description.trim() || "Product Sold",
        id: createDaybookProductSaleId("saved-product-sale-line"),
        productCost: toAmount(item.productCost),
        productName: item.productName.trim() || "Product Sold",
        saleAmount,
      });
    }

    return saleItems;
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
    setSaleNo("");
    setReferenceNo("");
    setPaymentAccountId(paymentAccounts[0]?.id ?? "");
    setSaleDate(dateValue());
    setPaymentMethod(PAYMENT_METHODS[0] ?? "Cash");
    setSalePaymentType("cash");
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

  const saveSale = async (closeAfterSave: boolean) => {
    const saleItems = buildSaleItems();
    if (!isDueSale && !selectedPaymentAccount) {
      setMessage({ text: "Select a payment account.", tone: "error" });
      return;
    }

    if (saleItems.length === 0) {
      setMessage({
        text: "Enter at least one product sale amount.",
        tone: "error",
      });
      return;
    }

    const nextTotalSales = saleItems.reduce(
      (sum, item) => sum + item.saleAmount,
      0,
    );
    const nextTotalCost = saleItems.reduce(
      (sum, item) => sum + item.productCost,
      0,
    );
    const nextGrossProfit = nextTotalSales - nextTotalCost;
    const selectedPaymentMethod = selectedPaymentAccount
      ? (selectedPaymentAccount.type ?? methodToPaymentType(paymentMethod))
      : methodToPaymentType(paymentMethod);

    const localSale = {
      createdAt: new Date().toISOString(),
      customer: customer.trim() || "XYZ Customer",
      grossProfit: nextGrossProfit,
      id: createDaybookProductSaleId("daybook-product-sale"),
      items: saleItems,
      notes: notes.trim(),
      paymentAccountId: isDueSale
        ? "accounts-receivable"
        : (selectedPaymentAccount?.id ?? ""),
      paymentAccountName: isDueSale
        ? "Accounts Receivable"
        : (selectedPaymentAccount?.name ?? ""),
      paymentAccountType: isDueSale
        ? undefined
        : selectedPaymentAccount?.type,
      paymentMethod: isDueSale ? undefined : selectedPaymentMethod,
      paymentType: salePaymentType,
      referenceNo: referenceNo.trim(),
      saleDate,
      saleNo: saleNo.trim(),
      scope,
      totalCost: nextTotalCost,
      totalSales: nextTotalSales,
    };

    try {
      const result = await createSaleMutation.mutateAsync({
        customer: customer.trim() || undefined,
        items: saleItems.map((item) => ({
          description: item.description,
          productCost: item.productCost,
          productName: item.productName,
          saleAmount: item.saleAmount,
        })),
        notes: notes.trim() || undefined,
        paymentAccountId: isDueSale
          ? undefined
          : selectedPaymentAccount?.id,
        paymentMethod: isDueSale ? undefined : selectedPaymentMethod,
        paymentType: salePaymentType,
        referenceNo: referenceNo.trim() || undefined,
        saleDate,
        saleNo: saleNo.trim() || undefined,
      });

      addDaybookProductSale({ ...localSale, isSynced: true });

      if (closeAfterSave) {
        setMessage(null);
        resetForm();
        onOpenChange(false);
        void invalidateQueries();
        return;
      }

      await invalidateQueries();
      resetForm();
      setMessage({ text: result.message, tone: "success" });
    } catch (error) {
      addDaybookProductSale({ ...localSale, isSynced: false });
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
            Product Sale
          </DialogTitle>
          <DialogDescription>
            Record product sale revenue and COGS for {scopeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="grid gap-5 md:grid-cols-[minmax(200px,1fr)_minmax(180px,220px)_minmax(240px,1fr)]">
              <div className="grid gap-2">
                <Label htmlFor="product-sale-customer">Customer</Label>
                <Input
                  id="product-sale-customer"
                  onChange={(event) => setCustomer(event.target.value)}
                  placeholder="XYZ Customer"
                  value={customer}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="product-sale-payment-type">Payment type</Label>
                <Select
                  onValueChange={(value) =>
                    setSalePaymentType(value as DaybookProductSalePaymentType)
                  }
                  value={salePaymentType}
                >
                  <SelectTrigger
                    className="w-full bg-white"
                    id="product-sale-payment-type"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_SALE_PAYMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="product-sale-payment-account">
                  Payment account
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {isDueSale ? (
                    <Input
                      className="border-amber-300 bg-white"
                      disabled
                      id="product-sale-payment-account"
                      value="Accounts Receivable"
                    />
                  ) : (
                    <Select
                      onValueChange={setPaymentAccountId}
                      value={paymentAccountId}
                    >
                      <SelectTrigger
                        className="w-full border-emerald-500 bg-white"
                        id="product-sale-payment-account"
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
                    {isDueSale
                      ? "Customer due"
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
                {money(totalSales)}
              </div>
              <p className="mt-2 text-slate-500 text-sm">
                {isDueSale ? "A/R + Product Sales" : "Cash + Product Sales"}
              </p>
              <div className="mt-4 grid gap-2 border-slate-200 border-t pt-4 text-sm">
                <ImpactLine label="Product Sales" value={money(totalSales)} />
                <ImpactLine label="COGS" value={money(totalCost)} />
                <ImpactLine
                  label="Gross Profit"
                  value={money(grossProfit)}
                  valueClassName={
                    grossProfit >= 0 ? "text-emerald-700" : "text-red-700"
                  }
                />
                <ImpactLine
                  label={isDueSale ? "Accounts Receivable" : "Cash & Bank"}
                  value={money(totalSales)}
                />
                <ImpactLine label="Inventory" value={`-${money(totalCost)}`} />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-[minmax(180px,220px)_minmax(180px,240px)_minmax(180px,240px)_minmax(180px,240px)]">
            <div className="grid gap-2">
              <Label htmlFor="product-sale-date">Sale Date</Label>
              <div className="relative">
                <Input
                  id="product-sale-date"
                  onChange={(event) => setSaleDate(event.target.value)}
                  type="date"
                  value={saleDate}
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-sale-payment-method">
                Payment Method
              </Label>
              {isDueSale ? (
                <Input disabled id="product-sale-payment-method" value="Due" />
              ) : (
                <Select
                  onValueChange={(value) =>
                    changePaymentMethod(value as PaymentMethodLabel)
                  }
                  value={paymentMethod}
                >
                  <SelectTrigger
                    className="w-full bg-white"
                    id="product-sale-payment-method"
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
              <Label htmlFor="product-sale-reference">Ref no.</Label>
              <Input
                id="product-sale-reference"
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="REF-001"
                value={referenceNo}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-sale-no">Sale no.</Label>
              <Input
                id="product-sale-no"
                onChange={(event) => setSaleNo(event.target.value)}
                placeholder="SALE-2026-001"
                value={saleNo}
              />
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[52px_minmax(190px,1fr)_minmax(180px,1fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_52px] border-slate-200 border-b bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-xs uppercase">
              <div>#</div>
              <div>Product Name</div>
              <div>Description</div>
              <div className="text-right">Sales Amount</div>
              <div className="text-right">Product Cost</div>
              <div />
            </div>
            <div>
              {items.map((item, index) => (
                <div
                  className="grid grid-cols-[52px_minmax(190px,1fr)_minmax(180px,1fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_52px] items-center border-slate-200 border-b px-4 py-3 last:border-b-0"
                  key={item.id}
                >
                  <div className="font-medium text-slate-500">{index + 1}</div>
                  <Input
                    className="h-9"
                    onChange={(event) =>
                      updateItem(item.id, "productName", event.target.value)
                    }
                    placeholder="Product Sold"
                    value={item.productName}
                  />
                  <Input
                    className="h-9"
                    onChange={(event) =>
                      updateItem(item.id, "description", event.target.value)
                    }
                    placeholder="Product Sold"
                    value={item.description}
                  />
                  <Input
                    className="h-9 text-right tabular-nums"
                    inputMode="decimal"
                    onChange={(event) =>
                      updateItem(item.id, "saleAmount", event.target.value)
                    }
                    placeholder="60,000.00"
                    value={item.saleAmount}
                  />
                  <Input
                    className="h-9 text-right tabular-nums"
                    inputMode="decimal"
                    onChange={(event) =>
                      updateItem(item.id, "productCost", event.target.value)
                    }
                    placeholder="40,000.00"
                    value={item.productCost}
                  />
                  <Button
                    aria-label={`Remove product sale line ${index + 1}`}
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
              <Label htmlFor="product-sale-notes">Notes</Label>
              <Textarea
                className="min-h-36 bg-white"
                id="product-sale-notes"
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
              disabled={createSaleMutation.isPending}
              onClick={() => saveSale(false)}
              type="button"
              variant="outline"
            >
              <SaveIcon data-icon="inline-start" />
              Save & Share
            </Button>
            <Button
              className="bg-emerald-700 hover:bg-emerald-800"
              disabled={createSaleMutation.isPending}
              onClick={() => saveSale(true)}
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

function ImpactLine({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold tabular-nums ${valueClassName ?? ""}`}>
        {value}
      </span>
    </div>
  );
}
