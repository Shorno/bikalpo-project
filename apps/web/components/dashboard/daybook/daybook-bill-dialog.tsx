"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarIcon,
  FileTextIcon,
  PlusIcon,
  SaveIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addDaybookBill,
  createDaybookBillId,
  type DaybookBillEntry,
  type DaybookBillLine,
} from "@/components/dashboard/daybook/daybook-bill-ledger";
import {
  buildDaybookBillPayeeOptions,
  filterDaybookBillPayees,
} from "@/components/dashboard/daybook/daybook-bill-payees";
import {
  DAYBOOK_PAYMENT_ACCOUNTS,
  type DaybookExpenseScope,
  type DaybookPaymentAccountType,
} from "@/components/dashboard/daybook/daybook-expense-ledger";
import { useDaybookBills } from "@/components/dashboard/daybook/use-daybook-bills";
import { useDaybookProductPurchases } from "@/components/dashboard/daybook/use-daybook-product-purchases";
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

type DaybookBillDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
};

type DraftBillLine = {
  accountId: string;
  accountName: string;
  id: string;
  price: string;
  productName: string;
};

type BillAccountOption = {
  id: string;
  name: string;
};

const PAYMENT_METHODS = ["Cash", "Bank"] as const;

const DEFAULT_BILL_ACCOUNTS: BillAccountOption[] = [
  { id: "furniture", name: "Furniture" },
  { id: "inventory", name: "Inventory" },
  { id: "purchase", name: "Purchase" },
  { id: "bills-utilities", name: "Bills / Utilities" },
  { id: "rent", name: "Rent" },
  { id: "miscellaneous", name: "Miscellaneous" },
];

type PaymentMethodLabel = (typeof PAYMENT_METHODS)[number];

function paymentTypeToMethod(
  type?: DaybookPaymentAccountType,
): PaymentMethodLabel {
  return type === "bank" ? "Bank" : "Cash";
}

function methodToPaymentType(
  method: PaymentMethodLabel,
): DaybookPaymentAccountType {
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

function createDefaultBillNo(existingBills: DaybookBillEntry[] = []) {
  const year = new Date().getFullYear();
  const nextNumber =
    existingBills.filter((bill) => bill.billNo.startsWith(`INV-${year}-`))
      .length + 1;

  return `INV-${year}-${String(nextNumber).padStart(3, "0")}`;
}

function createDraftLine(): DraftBillLine {
  const defaultAccount = DEFAULT_BILL_ACCOUNTS[0] ?? {
    id: "furniture",
    name: "Furniture",
  };

  return {
    accountId: defaultAccount.id,
    accountName: defaultAccount.name,
    id: createDaybookBillId("bill-line"),
    price: "",
    productName: `${defaultAccount.name} Purchased`,
  };
}

export function DaybookBillDialog({
  onOpenChange,
  open,
  scope,
}: DaybookBillDialogProps) {
  const { data: paymentAccountsData } = useQuery(
    orpc.finance.getPaymentAccounts.queryOptions({ input: {} }),
  );
  const { data: chartAccountsData } = useQuery(
    orpc.finance.getChartOfAccounts.queryOptions({ input: {} }),
  );
  const savedBills = useDaybookBills(scope);
  const savedProductPurchases = useDaybookProductPurchases(scope);
  const paymentAccounts = useMemo(
    () =>
      paymentAccountsData?.paymentAccounts?.length
        ? paymentAccountsData.paymentAccounts
        : DAYBOOK_PAYMENT_ACCOUNTS,
    [paymentAccountsData],
  );
  const billAccounts = useMemo(() => {
    const options = new Map<string, BillAccountOption>();

    for (const account of DEFAULT_BILL_ACCOUNTS) {
      options.set(account.name.toLowerCase(), account);
    }

    for (const account of chartAccountsData?.accounts ?? []) {
      if (!account.name.trim()) {
        continue;
      }

      options.set(account.name.trim().toLowerCase(), {
        id: account.id,
        name: account.name,
      });
    }

    return Array.from(options.values());
  }, [chartAccountsData?.accounts]);
  const [supplierName, setSupplierName] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierFocused, setSupplierFocused] = useState(false);
  const [billNo, setBillNo] = useState("");
  const [paymentDate, setPaymentDate] = useState(dateValue);
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState(
    paymentAccounts[0]?.id ?? DAYBOOK_PAYMENT_ACCOUNTS[0]?.id ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodLabel>(
    PAYMENT_METHODS[0] ?? "Cash",
  );
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [lines, setLines] = useState<DraftBillLine[]>(() => [
    createDraftLine(),
  ]);
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";
  const supplierOptions = useMemo(
    () =>
      buildDaybookBillPayeeOptions({
        bills: savedBills,
        partyType: "supplier",
        productPurchases: savedProductPurchases,
      }),
    [savedBills, savedProductPurchases],
  );
  const filteredSuppliers = useMemo(
    () => filterDaybookBillPayees(supplierOptions, supplierName).slice(0, 6),
    [supplierName, supplierOptions],
  );
  const selectedSupplier = useMemo(
    () => supplierOptions.find((option) => option.id === selectedSupplierId),
    [selectedSupplierId, supplierOptions],
  );
  const matchingSupplier = useMemo(
    () =>
      supplierOptions.find(
        (option) =>
          option.name.trim().toLowerCase() ===
          supplierName.trim().toLowerCase(),
      ),
    [supplierName, supplierOptions],
  );
  const activeSupplier = selectedSupplier ?? matchingSupplier;
  const previousBillAmount = activeSupplier?.previousBillAmount ?? 0;
  const selectedPaymentAccount = useMemo(
    () =>
      paymentAccounts.find((account) => account.id === paymentAccountId) ??
      paymentAccounts[0] ??
      DAYBOOK_PAYMENT_ACCOUNTS[0],
    [paymentAccountId, paymentAccounts],
  );
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + toAmount(line.price), 0),
    [lines],
  );
  const totalPaid = 0;
  const amountDue = Math.max(subtotal - totalPaid, 0);

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

  useEffect(() => {
    if (open && !billNo.trim()) {
      setBillNo(createDefaultBillNo(savedBills));
    }
  }, [billNo, open, savedBills]);

  const updateLine = (
    lineId: string,
    field: keyof Omit<DraftBillLine, "id">,
    value: string,
  ) => {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line,
      ),
    );
  };

  const updateAccount = (lineId: string, accountName: string) => {
    const account = billAccounts.find((option) => option.name === accountName);

    setLines((currentLines) =>
      currentLines.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        const defaultProductName = `${line.accountName} Purchased`;

        return {
          ...line,
          accountId: account?.id ?? "",
          accountName,
          productName:
            line.productName.trim() && line.productName !== defaultProductName
              ? line.productName
              : `${accountName} Purchased`,
        };
      }),
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

  const buildBillLines = (): DaybookBillLine[] => {
    const billLines: DaybookBillLine[] = [];

    for (const line of lines) {
      const price = toAmount(line.price);

      if (price <= 0) {
        continue;
      }

      const accountName = line.accountName.trim() || "Furniture";
      const productName = line.productName.trim() || `${accountName} Purchased`;

      billLines.push({
        accountId: line.accountId,
        accountName,
        amount: price,
        category: accountName,
        description: productName,
        id: createDaybookBillId("saved-bill-line"),
        price,
        productName,
      });
    }

    return billLines;
  };

  const resetForm = (nextSavedBills = savedBills) => {
    setSupplierName("");
    setSelectedSupplierId("");
    setSupplierFocused(false);
    setBillNo(createDefaultBillNo(nextSavedBills));
    setPaymentDate(dateValue());
    setReferenceNo("");
    setPaymentAccountId(
      paymentAccounts[0]?.id ?? DAYBOOK_PAYMENT_ACCOUNTS[0]?.id ?? "",
    );
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

  const saveBill = (closeAfterSave: boolean) => {
    const supplier = supplierName.trim();
    const paymentAccount = selectedPaymentAccount;
    const billLines = buildBillLines();
    const nextSubtotal = billLines.reduce((sum, line) => sum + line.price, 0);

    if (!supplier) {
      setMessage({ text: "Select or enter a supplier.", tone: "error" });
      return;
    }

    if (!paymentAccount) {
      setMessage({ text: "Select a payment account.", tone: "error" });
      return;
    }

    if (nextSubtotal <= 0 || billLines.length === 0) {
      setMessage({ text: "Enter at least one bill price.", tone: "error" });
      return;
    }

    const nextTotalPaid = 0;
    const nextAmountDue = Math.max(nextSubtotal - nextTotalPaid, 0);
    const selectedPaymentMethod =
      paymentAccount.type ?? methodToPaymentType(paymentMethod);

    const savedBill: DaybookBillEntry = {
      amountDue: nextAmountDue,
      billNo: billNo.trim() || createDefaultBillNo(savedBills),
      createdAt: new Date().toISOString(),
      dueDate: paymentDate,
      id: createDaybookBillId("daybook-bill"),
      issueDate: paymentDate,
      lines: billLines,
      notes: notes.trim(),
      partyId: activeSupplier?.id ?? `supplier-${supplier}`,
      partyName: supplier,
      partyType: "supplier",
      paymentAccountId: paymentAccount.id,
      paymentAccountName: paymentAccount.name,
      paymentAccountType: paymentAccount.type,
      paymentDate,
      paymentMethod: selectedPaymentMethod,
      previousBillAmount,
      referenceNo: referenceNo.trim(),
      scope,
      subtotal: nextSubtotal,
      total: nextSubtotal,
      totalPaid: nextTotalPaid,
    };

    addDaybookBill(savedBill);
    resetForm([...savedBills, savedBill]);

    if (closeAfterSave) {
      setMessage(null);
      onOpenChange(false);
      return;
    }

    setMessage({ text: "Bill saved.", tone: "success" });
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-white p-0 sm:max-w-6xl">
        <DialogHeader className="border-slate-200 border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <FileTextIcon className="size-5 text-blue-700" />
            Bill
          </DialogTitle>
          <DialogDescription>
            Record a supplier bill for {scopeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px]">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="daybook-bill-supplier">Supplier</Label>
                <div className="relative">
                  <Input
                    autoComplete="off"
                    className="h-10"
                    id="daybook-bill-supplier"
                    onBlur={() =>
                      window.setTimeout(() => setSupplierFocused(false), 120)
                    }
                    onChange={(event) => {
                      setSupplierName(event.target.value);
                      setSelectedSupplierId("");
                      setSupplierFocused(true);
                    }}
                    onFocus={() => setSupplierFocused(true)}
                    placeholder="Select supplier"
                    value={supplierName}
                  />
                  {supplierFocused && filteredSuppliers.length > 0 ? (
                    <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                      {filteredSuppliers.map((supplier) => (
                        <button
                          className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
                          key={supplier.id}
                          onClick={() => {
                            setSupplierName(supplier.name);
                            setSelectedSupplierId(supplier.id);
                            setSupplierFocused(false);
                          }}
                          onMouseDown={(event) => event.preventDefault()}
                          type="button"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">
                              {supplier.name}
                            </span>
                            <span className="block text-slate-500 text-xs">
                              {supplier.subtitle}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-700 text-xs">
                            Prev {money(supplier.previousBillAmount)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="daybook-bill-no">Bill No</Label>
                <Input
                  className="h-10"
                  id="daybook-bill-no"
                  onChange={(event) => setBillNo(event.target.value)}
                  placeholder="INV-2026-001"
                  value={billNo}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="daybook-bill-payment-date">Payment Date</Label>
                <div className="relative">
                  <Input
                    className="h-10"
                    id="daybook-bill-payment-date"
                    onChange={(event) => setPaymentDate(event.target.value)}
                    type="date"
                    value={paymentDate}
                  />
                  <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="daybook-bill-reference">Reference No</Label>
                <Input
                  className="h-10"
                  id="daybook-bill-reference"
                  onChange={(event) => setReferenceNo(event.target.value)}
                  placeholder="REF-001"
                  value={referenceNo}
                />
              </div>

              <div className="grid gap-2">
                <Label>Payment Method</Label>
                <Select
                  onValueChange={(value) =>
                    changePaymentMethod(value as PaymentMethodLabel)
                  }
                  value={paymentMethod}
                >
                  <SelectTrigger className="!h-10 min-h-10 w-full bg-white">
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
                <Label>Payment Account*</Label>
                <Select
                  onValueChange={setPaymentAccountId}
                  value={paymentAccountId}
                >
                  <SelectTrigger className="!h-10 min-h-10 w-full bg-white">
                    <SelectValue placeholder="Select payment account" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <div className="font-semibold text-slate-500 text-xs uppercase">
                Amount
              </div>
              <div className="mt-1 font-bold text-2xl text-slate-900 tabular-nums">
                {money(subtotal)}
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
            <div className="min-w-[780px]">
              <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_52px] border-slate-200 border-b bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-xs uppercase">
                <div>Account Name*</div>
                <div>Product Name</div>
                <div className="text-right">Price</div>
                <div />
              </div>
              {lines.map((line, index) => (
                <div
                  className="grid grid-cols-[repeat(3,minmax(0,1fr))_52px] items-center gap-2 border-slate-200 border-b px-4 py-3 last:border-b-0"
                  key={line.id}
                >
                  <Select
                    onValueChange={(value) => updateAccount(line.id, value)}
                    value={line.accountName}
                  >
                    <SelectTrigger className="!h-10 min-h-10 w-full bg-white">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {billAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.name}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label={`Product name ${index + 1}`}
                    className="h-10 w-full"
                    onChange={(event) =>
                      updateLine(line.id, "productName", event.target.value)
                    }
                    placeholder="Furniture Purchased"
                    value={line.productName}
                  />
                  <Input
                    aria-label={`Price ${index + 1}`}
                    className="h-10 w-full text-right tabular-nums"
                    inputMode="decimal"
                    onChange={(event) =>
                      updateLine(line.id, "price", event.target.value)
                    }
                    placeholder="0.00"
                    value={line.price}
                  />
                  <Button
                    aria-label={`Remove bill row ${index + 1}`}
                    className="text-slate-400 hover:text-red-600"
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <Button onClick={addLine} type="button" variant="outline">
              <PlusIcon data-icon="inline-start" />
              Add Row
            </Button>
            <Button onClick={clearLines} type="button" variant="outline">
              Clear
            </Button>
          </div>

          <div className="mt-6 grid gap-6 border-slate-200 border-t pt-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-2">
              <Label htmlFor="daybook-bill-notes">Notes</Label>
              <Textarea
                className="min-h-28"
                id="daybook-bill-notes"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Short note for this bill"
                value={notes}
              />
            </div>

            <div className="grid content-start gap-2 text-sm">
              <SummaryLine label="Subtotal" value={money(subtotal)} />
              <SummaryLine label="Total" value={money(0)} />
              <SummaryLine label="Total Paid" value={money(totalPaid)} />
              <SummaryLine label="Amount Due" value={money(amountDue)} strong />
              {previousBillAmount > 0 ? (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-amber-700">
                  Previous bill {money(previousBillAmount)}
                </div>
              ) : null}
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

          <div className="mt-6 flex justify-end gap-2 border-slate-200 border-t pt-4">
            <Button
              onClick={() => saveBill(false)}
              type="button"
              variant="outline"
            >
              <Share2Icon data-icon="inline-start" />
              Save & Share
            </Button>
            <Button onClick={() => saveBill(true)} type="button">
              <SaveIcon data-icon="inline-start" />
              Save & Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryLine({
  label,
  strong,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4">
      <span className={strong ? "font-semibold text-slate-900" : ""}>
        {label}
      </span>
      <span
        className={`font-semibold tabular-nums ${
          strong ? "text-slate-950" : "text-slate-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
