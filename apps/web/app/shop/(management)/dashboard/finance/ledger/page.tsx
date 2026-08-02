"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarIcon,
  ChevronDownIcon,
  DownloadIcon,
  Loader2Icon,
  RefreshCcwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  period: {
    endDate: string;
    startDate: string;
  };
};

type SelectedLedgerTransaction = LedgerTransaction & {
  accountBalance: string;
  accountName: string;
  accountType: string;
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined) {
  const numeric = toNumber(value);
  const sign = numeric < 0 ? "-" : "";

  return `${sign}\u09F3${Math.abs(numeric).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function dateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateValueFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0",
  )}`;
}

function formatDate(value: string) {
  const [rawYear, rawMonth, rawDay] = value.split("-");
  const year = Number.parseInt(rawYear ?? "", 10);
  const month = Number.parseInt(rawMonth ?? "", 10);
  const day = Number.parseInt(rawDay ?? "", 10);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export default function LedgerPage() {
  const today = new Date();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const initialAccountId = searchParams.get("accountId") ?? "all";
  const [accountId, setAccountId] = useState(initialAccountId);
  const [startDate, setStartDate] = useState(
    dateValueFromParts(today.getFullYear(), 1, 1),
  );
  const [endDate, setEndDate] = useState(dateValue(today));
  const [selectedTransaction, setSelectedTransaction] =
    useState<SelectedLedgerTransaction | null>(null);
  const [draftAmount, setDraftAmount] = useState("");

  const ledgerQuery = useQuery(
    orpc.finance.getGeneralLedger.queryOptions({
      input: {
        accountId,
        endDate,
        startDate,
      },
    }),
  );
  const report = ledgerQuery.data as LedgerReport | undefined;
  const allAccountsQuery = useQuery(
    orpc.finance.getGeneralLedger.queryOptions({
      input: {
        accountId: "all",
        endDate,
        startDate,
      },
    }),
  );
  const accountOptions = (allAccountsQuery.data as LedgerReport | undefined)
    ?.accounts;
  const updateMutation = useMutation({
    mutationFn: (input: { amount: number; id: number }) =>
      orpc.finance.updateLedgerTransaction.call(input),
    onSuccess: () => {
      invalidateReports();
      setSelectedTransaction(null);
      toast.success("Transaction updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (input: { id: number }) =>
      orpc.finance.deleteLedgerTransaction.call(input),
    onSuccess: () => {
      invalidateReports();
      setSelectedTransaction(null);
      toast.success("Transaction deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const totals = useMemo(
    () => ({
      accountCount: report?.accounts.length ?? 0,
      transactionCount:
        report?.accounts.reduce(
          (sum, account) => sum + account.transactions.length,
          0,
        ) ?? 0,
    }),
    [report],
  );

  function invalidateReports() {
    queryClient.invalidateQueries({
      queryKey: orpc.finance.getGeneralLedger.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.finance.getPaymentAccounts.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.balanceSheet.getBalanceSheet.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.profitLoss.getMonthlyPnL.key(),
    });
  }

  const draftSignedAmount = selectedTransaction
    ? (toNumber(selectedTransaction.signedAmount) < 0 ? -1 : 1) *
      Math.abs(toNumber(draftAmount))
    : 0;
  const draftBalanceAfter = selectedTransaction
    ? toNumber(selectedTransaction.balance) -
      toNumber(selectedTransaction.signedAmount) +
      draftSignedAmount
    : 0;

  function openTransaction(
    transaction: LedgerTransaction,
    account: LedgerAccount,
  ) {
    setSelectedTransaction({
      ...transaction,
      accountBalance: account.balance,
      accountName: account.name,
      accountType: account.accountType,
    });
    setDraftAmount(String(toNumber(transaction.amount)));
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">General Ledger</h1>
          <p className="mt-1 text-sm text-slate-500">
            Double-click a transaction to edit or delete it.
          </p>
        </div>
        <Button
          className="h-10 w-fit rounded-full border-blue-600 px-5 font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-800"
          type="button"
          variant="outline"
        >
          <DownloadIcon />
          Export
          <ChevronDownIcon />
        </Button>
      </div>

      <div className="rounded-lg bg-slate-100 p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(180px,1fr)_minmax(140px,220px)_minmax(140px,220px)_auto] lg:items-end">
          <div className="grid gap-2">
            <Label>Account</Label>
            <Select onValueChange={setAccountId} value={accountId}>
              <SelectTrigger className="h-10 border-blue-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {(accountOptions ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateInput
            label="Start Date"
            onChange={setStartDate}
            value={startDate}
          />
          <DateInput label="End Date" onChange={setEndDate} value={endDate} />
          <Button
            className="h-10 rounded-full bg-blue-600 px-5 hover:bg-blue-700"
            disabled={ledgerQuery.isFetching}
            onClick={() => void ledgerQuery.refetch()}
            type="button"
          >
            {ledgerQuery.isFetching ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <RefreshCcwIcon />
            )}
            Update Report
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-slate-500 text-xs uppercase">Accounts</p>
          <p className="mt-1 font-bold text-2xl text-slate-950">
            {totals.accountCount}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-slate-500 text-xs uppercase">Transactions</p>
          <p className="mt-1 font-bold text-2xl text-slate-950">
            {totals.transactionCount}
          </p>
        </div>
      </div>

      {ledgerQuery.isLoading ? (
        <div className="flex min-h-80 items-center justify-center">
          <Loader2Icon className="size-8 animate-spin text-slate-400" />
        </div>
      ) : report && report.accounts.length > 0 ? (
        <LedgerTable accounts={report.accounts} onOpen={openTransaction} />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-500">
          No non-zero ledger accounts found for this period.
        </div>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTransaction(null);
          }
        }}
        open={Boolean(selectedTransaction)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto bg-slate-50 p-0 sm:max-w-4xl">
          <DialogHeader className="border-slate-200 border-b bg-white px-5 py-4">
            <DialogTitle className="text-2xl font-bold text-slate-950">
              Ledger Transaction
            </DialogTitle>
            <DialogDescription>
              Edit the amount or delete this transaction from the ledger.
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction ? (
            <div className="space-y-5 px-5 py-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Account</Label>
                    <Input
                      className="h-10 bg-white"
                      readOnly
                      value={selectedTransaction.accountName}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Account Type</Label>
                    <Input
                      className="h-10 bg-white"
                      readOnly
                      value={selectedTransaction.accountType}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Date</Label>
                    <Input
                      className="h-10 bg-white"
                      readOnly
                      value={formatDate(selectedTransaction.date)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Transaction Type</Label>
                    <Input
                      className="h-10 bg-white"
                      readOnly
                      value={selectedTransaction.transactionType}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Reference</Label>
                    <Input
                      className="h-10 bg-white"
                      readOnly
                      value={`${selectedTransaction.referenceType} #${selectedTransaction.referenceId}`}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Direction</Label>
                    <Input
                      className="h-10 bg-white"
                      readOnly
                      value={
                        selectedTransaction.direction === "credit"
                          ? "Credit"
                          : "Debit"
                      }
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-white p-4 text-right">
                  <div className="font-semibold text-slate-500 text-xs uppercase">
                    Balance After
                  </div>
                  <div className="mt-2 font-bold text-2xl text-slate-950 tabular-nums">
                    {money(draftBalanceAfter)}
                  </div>
                  <div className="mt-3 text-slate-500 text-xs">
                    Current {money(selectedTransaction.accountBalance)}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="border-slate-200 border-b bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-xs uppercase">
                  Transaction details
                </div>
                <div className="grid gap-4 bg-white px-4 py-4">
                  <div className="grid gap-1.5">
                    <Label>Description</Label>
                    <Textarea
                      className="min-h-28 resize-y bg-white leading-relaxed"
                      readOnly
                      value={selectedTransaction.description}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label>Amount</Label>
                      <Input
                        className="h-10 text-right tabular-nums"
                        inputMode="decimal"
                        onChange={(event) => setDraftAmount(event.target.value)}
                        value={draftAmount}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Balance Impact</Label>
                      <Input
                        className="h-10 bg-white text-right tabular-nums"
                        readOnly
                        value={money(draftSignedAmount)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="border-slate-200 border-t bg-white px-5 py-4 sm:justify-between">
            <Button
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={!selectedTransaction || deleteMutation.isPending}
              onClick={() => {
                if (
                  selectedTransaction &&
                  window.confirm("Delete this ledger transaction?")
                ) {
                  deleteMutation.mutate({ id: selectedTransaction.id });
                }
              }}
              type="button"
              variant="ghost"
            >
              <Trash2Icon />
              Delete
            </Button>
            <Button
              disabled={!selectedTransaction || updateMutation.isPending}
              onClick={() => {
                if (!selectedTransaction) {
                  return;
                }

                updateMutation.mutate({
                  amount: toNumber(draftAmount),
                  id: selectedTransaction.id,
                });
              }}
              type="button"
            >
              <SaveIcon />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DateInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          className="h-10 border-blue-200 bg-white pr-9"
          onChange={(event) => onChange(event.target.value)}
          type="date"
          value={value}
        />
        <CalendarIcon className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
      </div>
    </div>
  );
}

function LedgerTable({
  accounts,
  onOpen,
}: {
  accounts: LedgerAccount[];
  onOpen: (transaction: LedgerTransaction, account: LedgerAccount) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <tbody>
          {accounts.map((account) => (
            <LedgerAccountRows
              account={account}
              key={account.id}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LedgerAccountRows({
  account,
  onOpen,
}: {
  account: LedgerAccount;
  onOpen: (transaction: LedgerTransaction, account: LedgerAccount) => void;
}) {
  return (
    <>
      <tr>
        <td
          className="bg-slate-300 px-4 py-3 font-bold text-slate-950"
          colSpan={5}
        >
          <div className="flex items-center justify-between gap-4">
            <span>{account.accountType}</span>
            <span className="tabular-nums">{money(account.balance)}</span>
          </div>
        </td>
      </tr>
      <tr>
        <td
          className="bg-slate-100 px-8 py-2.5 font-bold text-slate-950"
          colSpan={5}
        >
          <div className="flex items-center justify-between gap-4">
            <span>{account.name}</span>
            <span className="tabular-nums">{money(account.balance)}</span>
          </div>
        </td>
      </tr>
      <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
        <th className="px-8 py-2 text-left">Date</th>
        <th className="px-3 py-2 text-left">Transaction Type</th>
        <th className="px-3 py-2 text-left">Description</th>
        <th className="px-3 py-2 text-right">Amount</th>
        <th className="px-3 py-2 text-right">Balance</th>
      </tr>
      <tr className="border-b border-slate-200">
        <td className="px-8 py-3 text-slate-500">Opening Balance</td>
        <td className="px-3 py-3" />
        <td className="px-3 py-3" />
        <td className="px-3 py-3" />
        <td className="px-3 py-3 text-right font-medium tabular-nums">
          {money(account.openingBalance)}
        </td>
      </tr>
      {account.transactions.length > 0 ? (
        account.transactions.map((transaction) => (
          <tr
            className="cursor-pointer border-b border-slate-200 hover:bg-blue-50"
            key={`${account.id}-${transaction.id}`}
            onDoubleClick={() => onOpen(transaction, account)}
            title="Double-click to edit transaction"
          >
            <td className="px-8 py-3 text-slate-600">
              {formatDate(transaction.date)}
            </td>
            <td className="px-3 py-3 font-medium text-slate-800">
              {transaction.transactionType}
            </td>
            <td className="max-w-[420px] truncate px-3 py-3 text-slate-600">
              {transaction.description || transaction.referenceType}
            </td>
            <td className="px-3 py-3 text-right font-medium tabular-nums">
              {money(transaction.signedAmount)}
            </td>
            <td className="px-3 py-3 text-right font-medium tabular-nums">
              {money(transaction.balance)}
            </td>
          </tr>
        ))
      ) : (
        <tr className="border-b border-slate-200">
          <td className="px-8 py-3 text-slate-400" colSpan={5}>
            No transaction in this period.
          </td>
        </tr>
      )}
      <tr>
        <td className="py-4" colSpan={5} />
      </tr>
    </>
  );
}
