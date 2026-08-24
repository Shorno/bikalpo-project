"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CalendarIcon,
  FileTextIcon,
  LandmarkIcon,
  PaperclipIcon,
  PlusIcon,
  PrinterIcon,
  RepeatIcon,
  SaveIcon,
  Trash2Icon,
  UserRoundIcon,
  WalletCardsIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  buildDaybookBillPayeeOptions,
  type DaybookBillPayeeOption,
  filterDaybookBillPayees,
} from "@/components/dashboard/daybook/daybook-bill-payees";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import { useDaybookBills } from "@/components/dashboard/daybook/use-daybook-bills";
import { useDaybookCustomerAdvances } from "@/components/dashboard/daybook/use-daybook-customer-advances";
import { useDaybookProductPurchases } from "@/components/dashboard/daybook/use-daybook-product-purchases";
import { useDaybookProductSales } from "@/components/dashboard/daybook/use-daybook-product-sales";
import { useDaybookSupplierAdvances } from "@/components/dashboard/daybook/use-daybook-supplier-advances";
import { useRetailerSuppliers } from "@/components/dashboard/daybook/use-retailer-suppliers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type MoneyMovementType = "money_in" | "money_out";

type DaybookMoneyMovementDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
  type: MoneyMovementType;
};

type AccountOption = {
  accountType: "ASSET" | "COGS" | "EQUITY" | "EXPENSE" | "INCOME" | "LIABILITY";
  amount: number;
  categoryId: string;
  categoryName: string;
  id: string;
  name: string;
};

type DraftLine = {
  accountId: string;
  accountName: string;
  amount: string;
  description: string;
  id: string;
};

type PartyActivity = {
  amount: number;
  date: string;
  id: string;
  label: string;
  reference: string;
  type: "advance" | "bill";
};

type PartyFinancialSummary = {
  activities: PartyActivity[];
  customerAdvance: number;
  previousBill: number;
  supplierAdvance: number;
};

const PAYMENT_METHODS = ["Cash", "Bank"] as const;

type PaymentMethodLabel = (typeof PAYMENT_METHODS)[number];

function paymentTypeToMethod(type?: "cash" | "bank"): PaymentMethodLabel {
  return type === "bank" ? "Bank" : "Cash";
}

function methodToPaymentType(method: PaymentMethodLabel): "cash" | "bank" {
  return method === "Bank" ? "bank" : "cash";
}

function createDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDraftLine(account?: AccountOption): DraftLine {
  return {
    accountId: account?.id ?? "",
    accountName: account?.name ?? "",
    amount: "",
    description: "",
    id: createDraftId("money-line"),
  };
}

function dateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function defaultMovementNo(type: MoneyMovementType) {
  const now = new Date();
  const prefix = type === "money_in" ? "MIN" : "MOUT";
  return `${prefix}-${now.getFullYear()}-${String(now.getTime()).slice(-4)}`;
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

function normalizePartyName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function PartyNameInput({
  id,
  onSelect,
  onValueChange,
  options,
  placeholder,
  value,
}: {
  id: string;
  onSelect: (option: DaybookBillPayeeOption) => void;
  onValueChange: (value: string) => void;
  options: ReturnType<typeof buildDaybookBillPayeeOptions>;
  placeholder: string;
  value: string;
}) {
  const [focused, setFocused] = useState(false);
  const filteredOptions = useMemo(
    () => filterDaybookBillPayees(options, value).slice(0, 8),
    [options, value],
  );

  return (
    <div className="relative">
      <Input
        autoComplete="off"
        className="h-10"
        id={id}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onChange={(event) => {
          onValueChange(event.target.value);
          setFocused(true);
        }}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        value={value}
      />
      {focused && filteredOptions.length > 0 ? (
        <div className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {filteredOptions.map((option) => (
            <button
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
              key={option.id}
              onClick={() => {
                onSelect(option);
                setFocused(false);
              }}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900">
                  {option.name}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {option.partyType === "supplier" ? "Supplier" : "Customer"}
                  {option.subtitle ? ` - ${option.subtitle}` : ""}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DaybookMoneyMovementDialog({
  onOpenChange,
  open,
  scope,
  type,
}: DaybookMoneyMovementDialogProps) {
  const queryClient = useQueryClient();
  const { data: paymentAccountsData } = useQuery(
    orpc.finance.getPaymentAccounts.queryOptions({ input: {} }),
  );
  const { data: chartAccountsData } = useQuery(
    orpc.finance.getChartOfAccounts.queryOptions({ input: {} }),
  );
  const createMovementMutation = useMutation(
    orpc.finance.createMoneyMovement.mutationOptions(),
  );
  const savedBills = useDaybookBills(scope);
  const savedCustomerAdvances = useDaybookCustomerAdvances(scope);
  const savedProductPurchases = useDaybookProductPurchases(scope);
  const savedProductSales = useDaybookProductSales(scope);
  const savedSupplierAdvances = useDaybookSupplierAdvances(scope);
  const retailerSuppliers = useRetailerSuppliers(scope);
  const { data: customerData } = useQuery({
    ...orpc.retailerPos.searchCustomers.queryOptions({
      input: { search: undefined },
    }),
    enabled: scope === "retailer",
  });
  const paymentAccounts = useMemo(
    () => paymentAccountsData?.paymentAccounts ?? [],
    [paymentAccountsData?.paymentAccounts],
  );
  const categoryById = useMemo(
    () =>
      new Map(
        (chartAccountsData?.categories ?? []).map((category) => [
          category.id,
          category.name,
        ]),
      ),
    [chartAccountsData?.categories],
  );
  const accountOptions = useMemo<AccountOption[]>(() => {
    const uniqueAccounts = new Map<string, AccountOption>();

    for (const account of chartAccountsData?.accounts ?? []) {
      if (
        (type === "money_in" &&
          (account.accountType === "EXPENSE" ||
            account.accountType === "COGS")) ||
        (type === "money_out" && account.accountType === "INCOME")
      ) {
        continue;
      }

      const option = {
        accountType: account.accountType,
        amount: account.amount,
        categoryId: account.categoryId,
        categoryName: categoryById.get(account.categoryId) ?? "Account",
        id: account.id,
        name: account.name,
      };
      const key = [
        option.accountType,
        option.categoryId,
        option.categoryName.trim().toLowerCase(),
        option.name.trim().toLowerCase(),
      ].join("|");
      const existingOption = uniqueAccounts.get(key);

      if (
        !existingOption ||
        Math.abs(option.amount) > Math.abs(existingOption.amount)
      ) {
        uniqueAccounts.set(key, option);
      }
    }

    return Array.from(uniqueAccounts.values()).toSorted((first, second) =>
      first.name.localeCompare(second.name),
    );
  }, [categoryById, chartAccountsData?.accounts, type]);
  const customerPayees = useMemo(
    () =>
      (customerData?.customers ?? []).map((customer) => ({
        company: customer.address,
        currentPayable: 0,
        id: customer.key,
        name: customer.name,
        phone: customer.phone,
      })),
    [customerData?.customers],
  );
  const partyOptions = useMemo(() => {
    const supplierOptions = buildDaybookBillPayeeOptions({
      bills: savedBills,
      externalPayees: retailerSuppliers,
      partyType: "supplier",
      productPurchases: savedProductPurchases,
      productSales: savedProductSales,
    });
    const customerOptions = buildDaybookBillPayeeOptions({
      bills: savedBills,
      externalPayees: customerPayees,
      partyType: "customer",
      productPurchases: savedProductPurchases,
      productSales: savedProductSales,
    });

    return [...supplierOptions, ...customerOptions].toSorted(
      (first, second) => {
        const firstHasPreviousBill = first.previousBillAmount > 0;
        const secondHasPreviousBill = second.previousBillAmount > 0;

        if (firstHasPreviousBill !== secondHasPreviousBill) {
          return firstHasPreviousBill ? -1 : 1;
        }

        return first.name.localeCompare(second.name);
      },
    );
  }, [
    customerPayees,
    retailerSuppliers,
    savedBills,
    savedProductPurchases,
    savedProductSales,
  ]);
  const [partyName, setPartyName] = useState("");
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [movementNo, setMovementNo] = useState(() => defaultMovementNo(type));
  const [paymentDate, setPaymentDate] = useState(dateValue);
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState(
    paymentAccounts[0]?.id ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodLabel>(
    PAYMENT_METHODS[0] ?? "Cash",
  );
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [lines, setLines] = useState<DraftLine[]>(() => [createDraftLine()]);
  const selectedParty = useMemo(
    () => partyOptions.find((option) => option.id === selectedPartyId),
    [partyOptions, selectedPartyId],
  );
  const partyFinancialSummary = useMemo<PartyFinancialSummary | null>(() => {
    if (!selectedParty) {
      return null;
    }

    const selectedName = normalizePartyName(selectedParty.name);
    const matchingBills = savedBills.filter(
      (bill) =>
        bill.partyType === selectedParty.partyType &&
        normalizePartyName(bill.partyName) === selectedName,
    );
    const matchingSupplierAdvances = savedSupplierAdvances.filter(
      (advance) => normalizePartyName(advance.supplier) === selectedName,
    );
    const matchingCustomerAdvances = savedCustomerAdvances.filter(
      (advance) => normalizePartyName(advance.customer) === selectedName,
    );
    const matchingPurchases =
      selectedParty.partyType === "supplier"
        ? savedProductPurchases.filter(
            (purchase) =>
              purchase.paymentType === "due" &&
              normalizePartyName(purchase.supplier) === selectedName,
          )
        : [];
    const matchingSales =
      selectedParty.partyType === "customer"
        ? savedProductSales.filter(
            (sale) =>
              sale.paymentType === "due" &&
              normalizePartyName(sale.customer) === selectedName,
          )
        : [];
    const activities: PartyActivity[] = [
      ...matchingBills
        .filter((bill) => bill.amountDue > 0)
        .map((bill) => ({
          amount: bill.amountDue,
          date: bill.createdAt || bill.issueDate,
          id: `bill-${bill.id}`,
          label: bill.billNo || "Previous bill",
          reference: bill.referenceNo || bill.dueDate,
          type: "bill" as const,
        })),
      ...matchingPurchases.map((purchase) => ({
        amount: purchase.total,
        date: purchase.createdAt || purchase.paymentDate,
        id: `purchase-${purchase.id}`,
        label: purchase.billNo || "Purchase due",
        reference: purchase.referenceNo || "Product purchase",
        type: "bill" as const,
      })),
      ...matchingSales.map((sale) => ({
        amount: sale.totalSales,
        date: sale.createdAt || sale.saleDate,
        id: `sale-${sale.id}`,
        label: sale.saleNo || "Sales invoice",
        reference: sale.referenceNo || "Product sale",
        type: "bill" as const,
      })),
      ...matchingSupplierAdvances.map((advance) => ({
        amount: advance.amount,
        date: advance.createdAt || advance.paymentDate,
        id: `supplier-advance-${advance.id}`,
        label: "Supplier advance",
        reference: advance.referenceNo || advance.advanceNo,
        type: "advance" as const,
      })),
      ...matchingCustomerAdvances.map((advance) => ({
        amount: advance.amount,
        date: advance.createdAt || advance.receiveDate,
        id: `customer-advance-${advance.id}`,
        label: "Customer advance",
        reference: advance.referenceNo || advance.customerId,
        type: "advance" as const,
      })),
    ]
      .toSorted(
        (first, second) =>
          new Date(second.date).getTime() - new Date(first.date).getTime(),
      )
      .slice(0, 8);

    return {
      activities,
      customerAdvance: matchingCustomerAdvances.reduce(
        (sum, advance) => sum + advance.amount,
        0,
      ),
      previousBill: selectedParty.previousBillAmount,
      supplierAdvance: matchingSupplierAdvances.reduce(
        (sum, advance) => sum + advance.amount,
        0,
      ),
    };
  }, [
    savedBills,
    savedCustomerAdvances,
    savedProductPurchases,
    savedProductSales,
    savedSupplierAdvances,
    selectedParty,
  ]);
  const selectedPaymentAccount = useMemo(
    () => paymentAccounts.find((account) => account.id === paymentAccountId),
    [paymentAccountId, paymentAccounts],
  );
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + toAmount(line.amount), 0),
    [lines],
  );
  const title = type === "money_in" ? "Money In" : "Money Out";
  const partyLabel = type === "money_in" ? "Received From" : "Paid To";
  const partyPlaceholder =
    type === "money_in"
      ? "Customer / supplier / source"
      : "Supplier / customer / payee";
  const dateLabel = type === "money_in" ? "Receive Date" : "Payment Date";
  const accountLabel =
    type === "money_in" ? "Deposit Account*" : "Payment Account*";

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
    if (open) {
      setMovementNo(defaultMovementNo(type));
    }
  }, [open, type]);

  const updateLine = (
    lineId: string,
    field: keyof Omit<DraftLine, "id">,
    value: string,
  ) => {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line,
      ),
    );
  };

  const selectAccount = (lineId: string, account: AccountOption) => {
    setLines((currentLines) =>
      currentLines.map((line) => {
        if (line.id !== lineId) {
          return line;
        }

        const previousDefaultDescription = line.accountName;

        return {
          ...line,
          accountId: account.id,
          accountName: account.name,
          description:
            !line.description.trim() ||
            line.description.trim() === previousDefaultDescription
              ? account.name
              : line.description,
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

  const resetForm = () => {
    setPartyName("");
    setSelectedPartyId("");
    setMovementNo(defaultMovementNo(type));
    setPaymentDate(dateValue());
    setReferenceNo("");
    setPaymentAccountId(paymentAccounts[0]?.id ?? "");
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

  const invalidateFinanceQueries = async () => {
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
      queryClient.invalidateQueries({
        queryKey: orpc.finance.getGeneralLedger.key(),
      }),
    ]);
  };

  const saveMovement = async (closeAfterSave: boolean) => {
    if (!selectedPaymentAccount) {
      setMessage({ text: `Select a ${accountLabel}.`, tone: "error" });
      return;
    }

    const movementLines = lines
      .map((line) => {
        const account =
          accountOptions.find((option) => option.id === line.accountId) ??
          accountOptions.find(
            (option) =>
              option.name.trim().toLowerCase() ===
              line.accountName.trim().toLowerCase(),
          );

        return {
          account,
          amount: toAmount(line.amount),
          description: line.description.trim(),
        };
      })
      .filter((line) => line.account && line.amount > 0);

    if (movementLines.length === 0) {
      setMessage({ text: "Enter at least one account amount.", tone: "error" });
      return;
    }

    if (type === "money_out" && selectedPaymentAccount.balance < total) {
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

    try {
      const result = await createMovementMutation.mutateAsync({
        lines: movementLines.map((line) => ({
          accountId: line.account?.id,
          accountName: line.account?.name ?? "",
          amount: line.amount,
          description: line.description || line.account?.name,
        })),
        movementNo: movementNo.trim() || undefined,
        notes: notes.trim() || undefined,
        partyName: partyName.trim() || undefined,
        paymentAccountId: selectedPaymentAccount.id,
        paymentDate,
        paymentMethod: selectedPaymentMethod,
        referenceNo: referenceNo.trim() || undefined,
        type,
      });

      await invalidateFinanceQueries();
      resetForm();

      if (closeAfterSave) {
        setMessage(null);
        onOpenChange(false);
        return;
      }

      setMessage({ text: result.message, tone: "success" });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : `${title} could not be saved.`,
        tone: "error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="h-dvh max-h-dvh w-screen max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none bg-white p-0 sm:max-w-none">
        <DialogHeader className="border-slate-200 border-b px-4 py-4 sm:px-6 sm:py-5">
          <DialogTitle className="text-xl font-bold text-slate-900">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div
          className={cn(
            "relative grid min-h-0 grid-cols-1 transition-[padding-right] duration-200",
            selectedParty && partyFinancialSummary && "lg:pr-[420px]",
          )}
        >
          <div className="min-w-0 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px]">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FieldBlock id="money-movement-party" label={partyLabel}>
                  <PartyNameInput
                    id="money-movement-party"
                    onSelect={(option) => {
                      setPartyName(option.name);
                      setSelectedPartyId(option.id);
                    }}
                    onValueChange={(value) => {
                      setPartyName(value);
                      setSelectedPartyId("");
                    }}
                    options={partyOptions}
                    placeholder={partyPlaceholder}
                    value={partyName}
                  />
                </FieldBlock>

                <FieldBlock id="money-movement-no" label={`${title} No`}>
                  <Input
                    className="h-10"
                    id="money-movement-no"
                    onChange={(event) => setMovementNo(event.target.value)}
                    placeholder={
                      type === "money_in" ? "MIN-2026-001" : "MOUT-2026-001"
                    }
                    value={movementNo}
                  />
                </FieldBlock>

                <FieldBlock id="money-movement-date" label={dateLabel}>
                  <div className="relative">
                    <Input
                      className="h-10"
                      id="money-movement-date"
                      onChange={(event) => setPaymentDate(event.target.value)}
                      type="date"
                      value={paymentDate}
                    />
                    <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </FieldBlock>

                <FieldBlock id="money-movement-reference" label="Reference No">
                  <Input
                    className="h-10"
                    id="money-movement-reference"
                    onChange={(event) => setReferenceNo(event.target.value)}
                    placeholder="REF-001"
                    value={referenceNo}
                  />
                </FieldBlock>

                <FieldBlock label="Payment Method">
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
                </FieldBlock>

                <FieldBlock
                  hint={
                    <span className="font-medium text-slate-600 text-sm">
                      Balance {money(selectedPaymentAccount?.balance ?? 0)}
                    </span>
                  }
                  label={accountLabel}
                >
                  <Select
                    onValueChange={setPaymentAccountId}
                    value={paymentAccountId}
                  >
                    <SelectTrigger className="!h-10 min-h-10 w-full border-emerald-500 bg-white">
                      <SelectValue placeholder="Select cash/bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldBlock>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                <div className="font-semibold text-slate-500 text-xs uppercase">
                  Amount
                </div>
                <div className="mt-1 font-bold text-2xl text-slate-900 tabular-nums">
                  {money(total)}
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[56px_minmax(240px,1fr)_minmax(260px,1.1fr)_minmax(160px,0.7fr)_52px] border-slate-200 border-b bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-xs uppercase">
                  <div>#</div>
                  <div>Account Name*</div>
                  <div>Description</div>
                  <div className="text-right">Amount</div>
                  <div />
                </div>
                {lines.map((line, index) => (
                  <div
                    className="grid grid-cols-[56px_minmax(240px,1fr)_minmax(260px,1.1fr)_minmax(160px,0.7fr)_52px] items-center gap-2 border-slate-200 border-b px-4 py-3 last:border-b-0"
                    key={line.id}
                  >
                    <div className="font-medium text-slate-500">
                      {index + 1}
                    </div>
                    <AccountNameInput
                      onSelect={(account) => selectAccount(line.id, account)}
                      onValueChange={(value) => {
                        updateLine(line.id, "accountName", value);
                        updateLine(line.id, "accountId", "");
                      }}
                      options={accountOptions}
                      value={line.accountName}
                    />
                    <Input
                      className="h-10 w-full"
                      onChange={(event) =>
                        updateLine(line.id, "description", event.target.value)
                      }
                      placeholder="Description"
                      value={line.description}
                    />
                    <Input
                      className="h-10 w-full text-right tabular-nums"
                      inputMode="decimal"
                      onChange={(event) =>
                        updateLine(line.id, "amount", event.target.value)
                      }
                      placeholder="0.00"
                      value={line.amount}
                    />
                    <Button
                      aria-label={`Remove ${title} line ${index + 1}`}
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

            {message ? (
              <div
                className={cn(
                  "mt-4 rounded-lg px-4 py-3 font-medium text-sm",
                  message.tone === "error"
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700",
                )}
              >
                {message.text}
              </div>
            ) : null}

            <div className="mt-6 grid gap-6 border-slate-200 border-t pt-5 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="grid gap-2">
                <Label htmlFor="money-movement-notes">Notes</Label>
                <Textarea
                  className="min-h-28"
                  id="money-movement-notes"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={`Short note for this ${title.toLowerCase()}`}
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

            <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap justify-end gap-2 border-slate-200 border-t bg-white px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              <Button type="button" variant="ghost">
                <PrinterIcon data-icon="inline-start" />
                Print
              </Button>
              <Button type="button" variant="ghost">
                <RepeatIcon data-icon="inline-start" />
                Make recurring
              </Button>
              <Button
                disabled={createMovementMutation.isPending}
                onClick={() => saveMovement(false)}
                type="button"
                variant="outline"
              >
                <SaveIcon data-icon="inline-start" />
                Save
              </Button>
              <Button
                disabled={createMovementMutation.isPending}
                onClick={() => saveMovement(true)}
                type="button"
              >
                Save & Close
              </Button>
            </div>
          </div>
        </div>

        {selectedParty && partyFinancialSummary ? (
          <PartyFinancialPanel
            onBack={() => setSelectedPartyId("")}
            party={selectedParty}
            summary={partyFinancialSummary}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PartyFinancialPanel({
  onBack,
  party,
  summary,
}: {
  onBack: () => void;
  party: DaybookBillPayeeOption;
  summary: PartyFinancialSummary;
}) {
  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex min-h-0 w-full max-w-[420px] flex-col border-slate-200 border-l bg-white shadow-2xl animate-in slide-in-from-right-full duration-200">
      <div className="flex items-center gap-3 border-slate-200 border-b px-4 py-4 sm:px-5">
        <Button
          aria-label="Back to money entry"
          onClick={onBack}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ArrowLeftIcon />
        </Button>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <UserRoundIcon className="size-5" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-bold text-base text-slate-950">
            {party.name}
          </h3>
          <p className="truncate text-slate-500 text-sm">
            {party.partyType === "supplier" ? "Supplier" : "Customer"}
            {party.subtitle ? ` - ${party.subtitle}` : ""}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileTextIcon className="size-5 shrink-0 text-amber-700" />
              <span className="font-medium text-slate-700 text-sm">
                Previous Bills
              </span>
            </div>
            <span className="shrink-0 font-bold text-amber-800 tabular-nums">
              {money(summary.previousBill)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <LandmarkIcon className="size-5 shrink-0 text-blue-700" />
              <span className="font-medium text-slate-700 text-sm">
                Supplier Advance
              </span>
            </div>
            <span className="shrink-0 font-bold text-blue-800 tabular-nums">
              {money(summary.supplierAdvance)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <WalletCardsIcon className="size-5 shrink-0 text-emerald-700" />
              <span className="font-medium text-slate-700 text-sm">
                Customer Advance
              </span>
            </div>
            <span className="shrink-0 font-bold text-emerald-800 tabular-nums">
              {money(summary.customerAdvance)}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 border-slate-200 border-b pb-3">
            <h4 className="font-semibold text-slate-950">Recent Activity</h4>
            <span className="text-slate-500 text-xs">
              {summary.activities.length} records
            </span>
          </div>

          {summary.activities.length > 0 ? (
            <div>
              {summary.activities.map((activity) => (
                <div
                  className="flex items-start gap-3 border-slate-100 border-b py-4 last:border-b-0"
                  key={activity.id}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                      activity.type === "bill"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-blue-50 text-blue-700",
                    )}
                  >
                    {activity.type === "bill" ? (
                      <FileTextIcon className="size-4" />
                    ) : (
                      <WalletCardsIcon className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="truncate font-medium text-slate-900 text-sm">
                        {activity.label}
                      </span>
                      <span className="shrink-0 font-semibold text-slate-950 text-sm tabular-nums">
                        {money(activity.amount)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-slate-500 text-xs">
                      <span className="truncate">
                        {activity.reference || "No reference"}
                      </span>
                      <span className="shrink-0">
                        {formatPartyActivityDate(activity.date)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <FileTextIcon className="mx-auto size-7 text-slate-300" />
              <p className="mt-3 font-medium text-slate-700 text-sm">
                No saved activity yet
              </p>
              <p className="mt-1 text-slate-500 text-xs">
                Available balances are shown above.
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function formatPartyActivityDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "No date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function FieldBlock({
  children,
  hint,
  id,
  label,
}: {
  children: ReactNode;
  hint?: ReactNode;
  id?: string;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid gap-1">
        {children}
        <span className="h-5 text-sm">{hint ?? "\u00a0"}</span>
      </div>
    </div>
  );
}

function AccountNameInput({
  onSelect,
  onValueChange,
  options,
  value,
}: {
  onSelect: (account: AccountOption) => void;
  onValueChange: (value: string) => void;
  options: AccountOption[];
  value: string;
}) {
  const [focused, setFocused] = useState(false);
  const filteredOptions = useMemo(() => {
    const query = value.trim().toLowerCase();

    return options
      .filter((account) => {
        if (!query) {
          return true;
        }

        return `${account.name} ${account.categoryName} ${account.accountType}`
          .toLowerCase()
          .includes(query);
      })
      .toSorted((first, second) => {
        if (!query) {
          return first.name.localeCompare(second.name);
        }

        const firstStartsWithQuery = first.name.toLowerCase().startsWith(query);
        const secondStartsWithQuery = second.name
          .toLowerCase()
          .startsWith(query);

        if (firstStartsWithQuery !== secondStartsWithQuery) {
          return firstStartsWithQuery ? -1 : 1;
        }

        return first.name.localeCompare(second.name);
      });
  }, [options, value]);

  return (
    <div className="relative">
      <Input
        autoComplete="off"
        className="h-10 w-full"
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onChange={(event) => {
          onValueChange(event.target.value);
          setFocused(true);
        }}
        onFocus={() => setFocused(true)}
        placeholder="Select account"
        value={value}
      />
      {focused && filteredOptions.length > 0 ? (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {filteredOptions.map((account) => (
            <button
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
              key={account.id}
              onClick={() => {
                onSelect(account);
                setFocused(false);
              }}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-900">
                  {account.name}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
