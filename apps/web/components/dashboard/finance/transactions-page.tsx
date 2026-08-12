"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CalendarIcon,
  EditIcon,
  EyeIcon,
  Loader2Icon,
  PrinterIcon,
  RefreshCcwIcon,
  SaveIcon,
  ScanLineIcon,
  SearchIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type TransactionKind = "income" | "expense";
type TransactionFilter = "all" | TransactionKind;

type LedgerTransaction = {
  amount: string;
  balance: string;
  date: string;
  description: string;
  direction: "credit" | "debit";
  id: number;
  referenceId: number;
  referenceType: string;
  signedAmount: string;
  transactionType: string;
};

type LedgerAccount = {
  accountType: string;
  balance: string;
  category: string;
  id: string;
  name: string;
  openingBalance: string;
  transactions: LedgerTransaction[];
};

type LedgerReport = {
  accounts: LedgerAccount[];
};

type TransactionRecord = LedgerTransaction & {
  accountName: string;
  accountType: string;
  categoryName: string;
  displayDescription: string;
  displayType: string;
  kind: TransactionKind;
  movementNo: string;
  partyName: string;
  paymentAccount: string;
  referenceNo: string;
};

type TransactionDraft = {
  amount: string;
  date: string;
  description: string;
  movementNo: string;
  notes: string;
  partyName: string;
  referenceNo: string;
};

const FILTER_OPTIONS: Array<{ label: string; value: TransactionFilter }> = [
  { label: "All", value: "all" },
  { label: "Income", value: "income" },
  { label: "Expense", value: "expense" },
];

function dateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function firstDateOfYear(year: number) {
  return `${year}-01-01`;
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined) {
  return `\u09F3${Math.abs(toNumber(value)).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formattedTransactionAmount(transaction: TransactionRecord) {
  const amount = money(transaction.amount);
  return transaction.kind === "expense" ? `(${amount})` : amount;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function descriptionValue(description: string, label: string) {
  const prefix = `${label.toLowerCase()}:`;
  const segment = description
    .split("|")
    .map((part) => part.trim())
    .find((part) => part.toLowerCase().startsWith(prefix));

  return segment?.slice(segment.indexOf(":") + 1).trim() ?? "";
}

function businessTransactionKind(
  transaction: LedgerTransaction,
  account: LedgerAccount,
): TransactionKind | null {
  const segments = transaction.description
    .split("|")
    .map((part) => part.trim().toLowerCase());
  const accountType = account.accountType.toLowerCase();
  const isCostOfSales =
    transaction.transactionType === "Cost of Sales" ||
    segments.some((segment) => segment === "cogs");

  if (accountType === "income" && transaction.direction === "credit") {
    return "income";
  }

  if (
    (accountType === "expense" || accountType === "cogs") &&
    transaction.direction === "debit"
  ) {
    return "expense";
  }

  if (
    !isCostOfSales &&
    (transaction.transactionType === "Sale Invoice" ||
      segments.some(
        (segment) =>
          segment === "product sale" || segment === "product sale due",
      ))
  ) {
    return "income";
  }

  if (
    transaction.transactionType === "Expense Payment" ||
    segments.some((segment) => segment.startsWith("expense:"))
  ) {
    return "expense";
  }

  return null;
}

function expenseCategory(
  transaction: LedgerTransaction,
  account: LedgerAccount,
) {
  if (["expense", "cogs"].includes(account.accountType.toLowerCase())) {
    return account.name;
  }

  const expenseValue = descriptionValue(transaction.description, "Expense");
  const categoryMatch = expenseValue.match(/\(([^()]*)\)\s*$/);

  return categoryMatch?.[1]?.trim() || account.category || "Other";
}

function incomeType(
  transaction: LedgerTransaction,
  account: LedgerAccount,
) {
  const source = `${transaction.transactionType} ${transaction.description}`.toLowerCase();

  if (
    transaction.transactionType === "Sale Invoice" ||
    source.includes("product sale")
  ) {
    return "Sale";
  }

  const searchable = `${account.name} ${account.category}`.toLowerCase();

  if (searchable.includes("sale")) {
    return "Sale";
  }

  if (
    searchable.includes("service") ||
    searchable.includes("delivery") ||
    searchable.includes("commission") ||
    searchable.includes("membership")
  ) {
    return "Service";
  }

  return "Other";
}

function expenseDescription(transaction: LedgerTransaction) {
  const value = descriptionValue(transaction.description, "Expense");
  return value.replace(/\s*\([^()]*\)\s*$/, "").trim();
}

function transactionRecord(
  transaction: LedgerTransaction,
  account: LedgerAccount,
  kind: TransactionKind,
): TransactionRecord {
  const categoryName =
    kind === "expense"
      ? expenseCategory(transaction, account)
      : incomeType(transaction, account);
  const movementNo =
    descriptionValue(transaction.description, "Money In No") ||
    descriptionValue(transaction.description, "Money Out No") ||
    descriptionValue(transaction.description, "Sale") ||
    descriptionValue(transaction.description, "Bill") ||
    descriptionValue(transaction.description, "Advance") ||
    transaction.description.split("|")[0]?.trim() ||
    `${transaction.referenceType.toUpperCase()}-${transaction.referenceId}`;
  const lineDescription = descriptionValue(
    transaction.description,
    "Description",
  );
  const accountDescription =
    descriptionValue(transaction.description, "Accounts") ||
    descriptionValue(transaction.description, "Account");

  return {
    ...transaction,
    accountName: account.name,
    accountType: account.accountType,
    categoryName,
    displayDescription:
      lineDescription ||
      (kind === "expense" ? expenseDescription(transaction) : "") ||
      descriptionValue(transaction.description, "Items") ||
      accountDescription ||
      descriptionValue(transaction.description, "Customer") ||
      descriptionValue(transaction.description, "Name") ||
      transaction.transactionType,
    displayType:
      kind === "income"
        ? `Income (${categoryName})`
        : `Expense (${categoryName})`,
    kind,
    movementNo,
    partyName:
      descriptionValue(transaction.description, "Customer") ||
      descriptionValue(transaction.description, "Payee") ||
      descriptionValue(transaction.description, "Name"),
    paymentAccount:
      descriptionValue(transaction.description, "Cash/Bank") || account.name,
    referenceNo:
      descriptionValue(transaction.description, "Reference") || movementNo,
  };
}

function flattenTransactions(report: LedgerReport | undefined) {
  const grouped = new Map<string, TransactionRecord>();

  for (const account of report?.accounts ?? []) {
    for (const transaction of account.transactions) {
      const kind = businessTransactionKind(transaction, account);

      if (!kind) {
        continue;
      }

      const record = transactionRecord(transaction, account, kind);
      const key = `ledger:${transaction.id}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, record);
      }
    }
  }

  return Array.from(grouped.values()).toSorted(
    (first, second) =>
      new Date(`${second.date}T12:00:00`).getTime() -
        new Date(`${first.date}T12:00:00`).getTime() || second.id - first.id,
  );
}

export function TransactionsPage() {
  const now = new Date();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [startDate, setStartDate] = useState(
    firstDateOfYear(now.getFullYear()),
  );
  const [endDate, setEndDate] = useState(dateValue(now));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionRecord | null>(null);
  const ledgerQuery = useQuery(
    orpc.finance.getGeneralLedger.queryOptions({
      input: {
        accountId: "all",
        endDate,
        includeZeroBalance: true,
        startDate,
      },
    }),
  );
  const transactions = useMemo(
    () => flattenTransactions(ledgerQuery.data as LedgerReport | undefined),
    [ledgerQuery.data],
  );
  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      if (filter !== "all" && transaction.kind !== filter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        transaction.movementNo,
        transaction.displayType,
        transaction.displayDescription,
        transaction.accountName,
        transaction.partyName,
        transaction.referenceNo,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [filter, search, transactions]);

  const changeYear = (nextYear: string) => {
    setYear(nextYear);
    setStartDate(`${nextYear}-01-01`);
    setEndDate(`${nextYear}-12-31`);
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Transactions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review income and expenses, then open a transaction for full details.
        </p>
      </div>

      <section className="border bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto]">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-10 pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search transaction"
              ref={searchInputRef}
              value={search}
            />
          </div>
          <Button
            onClick={() => searchInputRef.current?.focus()}
            type="button"
            variant="outline"
          >
            <ScanLineIcon />
            Scan
          </Button>
          <Button
            disabled={ledgerQuery.isFetching}
            onClick={() => void ledgerQuery.refetch()}
            type="button"
          >
            <RefreshCcwIcon
              className={cn(ledgerQuery.isFetching && "animate-spin")}
            />
            Update
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Select onValueChange={changeYear} value={year}>
            <SelectTrigger className="h-10 w-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3].map((offset) => {
                const option = String(now.getFullYear() - offset);
                return (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <DateInput onChange={setStartDate} value={startDate} />
          <DateInput onChange={setEndDate} value={endDate} />
        </div>

        <div className="mt-4 grid grid-cols-3 border bg-slate-50 p-1">
          {FILTER_OPTIONS.map((option) => (
            <button
              className={cn(
                "h-9 border text-sm font-semibold transition-colors",
                filter === option.value
                  ? "border-blue-600 bg-white text-blue-700 shadow-sm"
                  : "border-transparent text-slate-600 hover:text-slate-950",
              )}
              key={option.value}
              onClick={() => setFilter(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <TransactionList
        isLoading={ledgerQuery.isLoading}
        onView={setSelectedTransaction}
        transactions={filteredTransactions}
      />

      {selectedTransaction ? (
        <TransactionDetailsDialog
          key={selectedTransaction.id}
          onClose={() => setSelectedTransaction(null)}
          onUpdated={() => void ledgerQuery.refetch()}
          transaction={selectedTransaction}
        />
      ) : null}
    </div>
  );
}

function DateInput({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="relative">
      <Input
        className="h-10 pr-9"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
      <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

function TransactionList({
  isLoading,
  onView,
  transactions,
}: {
  isLoading: boolean;
  onView: (transaction: TransactionRecord) => void;
  transactions: TransactionRecord[];
}) {
  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center border bg-white">
        <Loader2Icon className="size-6 animate-spin text-blue-700" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center border bg-white px-5 text-center text-sm text-slate-500">
        No transactions match the selected filters.
      </div>
    );
  }

  return (
    <section className="overflow-hidden border bg-white shadow-sm">
      <div className="divide-y md:hidden">
        {transactions.map((transaction) => (
          <article className="p-4" key={transaction.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-950">
                  {transaction.displayType}
                </div>
                <div className="mt-1 truncate text-sm text-slate-500">
                  {transaction.movementNo}
                </div>
              </div>
              <KindPill kind={transaction.kind} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <MobileValue label="Date" value={formatDate(transaction.date)} />
              <MobileValue
                align="right"
                label="Amount"
                value={formattedTransactionAmount(transaction)}
              />
              <MobileValue
                label="Description"
                value={transaction.displayDescription}
              />
              <MobileValue
                align="right"
                label="Account"
                value={transaction.accountName}
              />
            </div>
            <Button
              className="mt-4 w-full"
              onClick={() => onView(transaction)}
              type="button"
              variant="outline"
            >
              <EyeIcon />
              View Details
            </Button>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Transaction Type</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Account</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
              <th className="px-4 py-3 text-right font-semibold">View</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.map((transaction) => (
              <tr className="hover:bg-slate-50" key={transaction.id}>
                <td className="px-4 py-3 text-slate-700">
                  {formatDate(transaction.date)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-950">
                    {transaction.displayType}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {transaction.movementNo}
                  </div>
                </td>
                <td className="max-w-80 px-4 py-3 text-slate-700">
                  <div className="truncate">
                    {transaction.displayDescription}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {transaction.accountName}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-semibold tabular-nums",
                    transaction.kind === "income"
                      ? "text-emerald-700"
                      : "text-rose-700",
                  )}
                >
                  {formattedTransactionAmount(transaction)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    aria-label={`View ${transaction.movementNo}`}
                    onClick={() => onView(transaction)}
                    size="icon-sm"
                    title="View transaction details"
                    type="button"
                    variant="outline"
                  >
                    <EyeIcon />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MobileValue({
  align,
  label,
  value,
}: {
  align?: "right";
  label: string;
  value: string;
}) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <div className="text-[11px] font-semibold uppercase text-slate-500">
        {label}
      </div>
      <div className="mt-1 break-words text-slate-800">{value}</div>
    </div>
  );
}

function KindPill({ kind }: { kind: TransactionKind }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold capitalize",
        kind === "income"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-rose-50 text-rose-700",
      )}
    >
      {kind}
    </span>
  );
}

function TransactionDetailsDialog({
  onClose,
  onUpdated,
  transaction,
}: {
  onClose: () => void;
  onUpdated: () => void;
  transaction: TransactionRecord;
}) {
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<"details" | "edit">("details");
  const [currentTransaction, setCurrentTransaction] = useState(transaction);
  const [draft, setDraft] = useState<TransactionDraft>(() =>
    draftFromTransaction(transaction),
  );
  const closeAfterSaveRef = useRef(false);
  const updateMutation = useMutation({
    mutationFn: (input: {
      amount: number;
      description: string;
      id: number;
      transactionDate: string;
    }) => orpc.finance.updateLedgerTransaction.call(input),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: orpc.finance.getGeneralLedger.key(),
      });
      onUpdated();
      toast.success("Transaction updated");

      if (closeAfterSaveRef.current) {
        onClose();
        return;
      }

      setCurrentTransaction((current) => ({
        ...current,
        amount: String(variables.amount),
        date: variables.transactionDate,
        description: variables.description,
        displayDescription: draft.description,
        movementNo: draft.movementNo,
        partyName: draft.partyName,
        referenceNo: draft.referenceNo,
      }));
      setScreen("details");
    },
  });

  const save = (shouldClose: boolean) => {
    const amount = toNumber(draft.amount);

    if (amount <= 0) {
      toast.error("Enter a transaction amount greater than 0");
      return;
    }

    if (!draft.date) {
      toast.error("Select a transaction date");
      return;
    }

    closeAfterSaveRef.current = shouldClose;
    updateMutation.mutate({
      amount,
      description: buildTransactionDescription(currentTransaction, draft),
      id: currentTransaction.id,
      transactionDate: draft.date,
    });
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      open
    >
      <DialogContent
        className={cn(
          "gap-0 bg-white p-0",
          screen === "edit"
            ? "h-dvh max-h-dvh w-screen max-w-none grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-none sm:max-w-none"
            : "h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] overflow-y-auto sm:h-auto sm:max-h-[92vh] sm:max-w-4xl",
        )}
      >
        <DialogHeader className="border-b px-4 py-4 sm:px-6 sm:py-5">
          <DialogTitle className="text-xl font-bold text-slate-950">
            {screen === "edit"
              ? currentTransaction.kind === "income"
                ? "Edit Money In"
                : "Edit Money Out"
              : "Transaction Details"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            View or edit this transaction.
          </DialogDescription>
        </DialogHeader>

        {screen === "details" ? (
          <TransactionReadOnlyDetails
            onEdit={() => setScreen("edit")}
            transaction={currentTransaction}
          />
        ) : (
          <TransactionFullScreenEditor
            draft={draft}
            isSaving={updateMutation.isPending}
            onBack={() => {
              setDraft(draftFromTransaction(currentTransaction));
              setScreen("details");
            }}
            onChange={setDraft}
            onSave={save}
            transaction={currentTransaction}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransactionReadOnlyDetails({
  onEdit,
  transaction,
}: {
  onEdit: () => void;
  transaction: TransactionRecord;
}) {
  return (
    <main className="px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div>
          <div className="text-lg font-bold text-slate-950">
            {transaction.displayType}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {transaction.movementNo}
          </div>
        </div>
        <KindPill kind={transaction.kind} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ReadOnlyValue label="Date" value={formatDate(transaction.date)} />
        <ReadOnlyValue label="Reference" value={transaction.referenceNo} />
        <ReadOnlyValue
          label="Amount"
          value={formattedTransactionAmount(transaction)}
        />
        <ReadOnlyValue
          label={transaction.kind === "income" ? "Received From" : "Paid To"}
          value={transaction.partyName || "Not specified"}
        />
        <ReadOnlyValue label="Account" value={transaction.accountName} />
        <ReadOnlyValue label="Cash / Bank" value={transaction.paymentAccount} />
      </div>

      <div className="mt-4">
        <ReadOnlyValue
          label="Description"
          multiline
          value={transaction.displayDescription}
        />
      </div>

      <div className="mt-6 flex justify-end border-t pt-4">
        <Button onClick={onEdit} type="button">
          <EditIcon />
          Edit
        </Button>
      </div>
    </main>
  );
}

function TransactionFullScreenEditor({
  draft,
  isSaving,
  onBack,
  onChange,
  onSave,
  transaction,
}: {
  draft: TransactionDraft;
  isSaving: boolean;
  onBack: () => void;
  onChange: (draft: TransactionDraft) => void;
  onSave: (closeAfterSave: boolean) => void;
  transaction: TransactionRecord;
}) {
  const title = transaction.kind === "income" ? "Money In" : "Money Out";
  const partyLabel =
    transaction.kind === "income" ? "Received From" : "Paid To";
  const accountLabel =
    transaction.kind === "income" ? "Deposit Account*" : "Payment Account*";

  const updateDraft = (key: keyof TransactionDraft, value: string) => {
    onChange({ ...draft, [key]: value });
  };

  return (
    <main className="min-h-0 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <EditorField
            label={partyLabel}
            onChange={(value) => updateDraft("partyName", value)}
            value={draft.partyName}
          />
          <EditorField
            label={`${title} No`}
            onChange={(value) => updateDraft("movementNo", value)}
            value={draft.movementNo}
          />
          <EditorField
            label={
              transaction.kind === "income" ? "Receive Date" : "Payment Date"
            }
            onChange={(value) => updateDraft("date", value)}
            type="date"
            value={draft.date}
          />
          <EditorField
            label="Reference No"
            onChange={(value) => updateDraft("referenceNo", value)}
            value={draft.referenceNo}
          />
          <div>
            <Label>Payment Method</Label>
            <Select disabled value={paymentMethod(transaction.paymentAccount)}>
              <SelectTrigger className="mt-2 h-10 w-full bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{accountLabel}</Label>
            <Input
              className="mt-2 h-10 bg-slate-50"
              readOnly
              value={transaction.paymentAccount}
            />
            <p className="mt-1 text-xs text-slate-500">
              Account changes require a reversing entry.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-slate-50 px-4 py-3 text-right">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Amount
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-950 tabular-nums">
            {money(draft.amount)}
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[56px_minmax(220px,1fr)_minmax(280px,1.2fr)_minmax(160px,0.7fr)] border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-600">
            <span>#</span>
            <span>Account Name*</span>
            <span>Description</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="grid grid-cols-[56px_minmax(220px,1fr)_minmax(280px,1.2fr)_minmax(160px,0.7fr)] items-center gap-2 px-4 py-3">
            <span className="text-slate-500">1</span>
            <Input
              className="h-10 bg-slate-50"
              readOnly
              value={transaction.accountName}
            />
            <Input
              className="h-10"
              onChange={(event) =>
                updateDraft("description", event.target.value)
              }
              value={draft.description}
            />
            <Input
              className="h-10 text-right tabular-nums"
              inputMode="decimal"
              min={0}
              onChange={(event) => updateDraft("amount", event.target.value)}
              type="number"
              value={draft.amount}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 border-t pt-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <Label htmlFor="transaction-notes">Notes</Label>
          <Textarea
            className="mt-2 min-h-28 resize-none"
            id="transaction-notes"
            onChange={(event) => updateDraft("notes", event.target.value)}
            placeholder={`Short note for this ${title.toLowerCase()}`}
            value={draft.notes}
          />
        </div>
        <div>
          <Label>Attachments</Label>
          <div className="mt-2 flex min-h-28 items-center justify-center rounded-lg border border-dashed bg-white px-4 text-center text-sm text-slate-500">
            No attachment
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap justify-end gap-2 border-t bg-white px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Button onClick={onBack} type="button" variant="ghost">
          <ArrowLeftIcon />
          Back to Details
        </Button>
        <Button type="button" variant="ghost">
          <PrinterIcon />
          Print
        </Button>
        <Button
          disabled={isSaving}
          onClick={() => onSave(false)}
          type="button"
          variant="outline"
        >
          <SaveIcon />
          Save
        </Button>
        <Button disabled={isSaving} onClick={() => onSave(true)} type="button">
          <SaveIcon />
          Save &amp; Close
        </Button>
      </div>
    </main>
  );
}

function EditorField({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-2 h-10"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </div>
  );
}

function ReadOnlyValue({
  label,
  multiline,
  value,
}: {
  label: string;
  multiline?: boolean;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-slate-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 rounded-lg border bg-slate-50 px-3 py-2.5 text-sm text-slate-900",
          multiline && "min-h-24 whitespace-pre-wrap",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function draftFromTransaction(
  transaction: TransactionRecord,
): TransactionDraft {
  return {
    amount: String(toNumber(transaction.amount)),
    date: transaction.date,
    description: transaction.displayDescription,
    movementNo: transaction.movementNo,
    notes: descriptionValue(transaction.description, "Notes"),
    partyName: transaction.partyName,
    referenceNo: transaction.referenceNo,
  };
}

function buildTransactionDescription(
  transaction: TransactionRecord,
  draft: TransactionDraft,
) {
  const movementLabel =
    transaction.kind === "income" ? "Money In No" : "Money Out No";
  let sourceLabel = transaction.kind === "income" ? "Money In" : "Money Out";

  if (transaction.transactionType === "Sale Invoice") {
    sourceLabel = "Product sale";
  } else if (transaction.transactionType === "Bill Due") {
    sourceLabel = "Bill due";
  } else if (transaction.transactionType === "Expense Payment") {
    sourceLabel = `Expense: ${draft.description.trim() || transaction.displayDescription} (${transaction.categoryName})`;
  }

  return [
    sourceLabel,
    draft.movementNo.trim()
      ? `${movementLabel}: ${draft.movementNo.trim()}`
      : null,
    draft.partyName.trim() ? `Name: ${draft.partyName.trim()}` : null,
    draft.referenceNo.trim() ? `Reference: ${draft.referenceNo.trim()}` : null,
    `Account: ${transaction.accountName}`,
    draft.description.trim()
      ? `Description: ${draft.description.trim()}`
      : null,
    `Cash/Bank: ${transaction.paymentAccount}`,
    draft.notes.trim() ? `Notes: ${draft.notes.trim()}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function paymentMethod(accountName: string) {
  return accountName.toLowerCase().includes("bank") ? "bank" : "cash";
}
