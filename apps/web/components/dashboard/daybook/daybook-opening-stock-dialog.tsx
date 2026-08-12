"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarIcon,
  PackagePlusIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type DaybookOpeningStockDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
};

type AccountOption = {
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

function createDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDraftLine(account?: AccountOption): DraftLine {
  return {
    accountId: account?.id ?? "",
    accountName: account?.name ?? "",
    amount: "",
    description: account ? "Inventory introduced by owner" : "",
    id: createDraftId("opening-stock-line"),
  };
}

function dateValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function defaultStockNo() {
  const now = new Date();

  return `OST-${now.getFullYear()}-${String(now.getTime()).slice(-4)}`;
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

export function DaybookOpeningStockDialog({
  onOpenChange,
  open,
}: DaybookOpeningStockDialogProps) {
  const queryClient = useQueryClient();
  const { data: chartAccountsData } = useQuery(
    orpc.finance.getChartOfAccounts.queryOptions({ input: {} }),
  );
  const createOpeningStockMutation = useMutation(
    orpc.finance.createOpeningStock.mutationOptions(),
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
      const categoryName = categoryById.get(account.categoryId) ?? "Account";
      const normalizedName = account.name.trim().toLowerCase();
      const normalizedCategory = categoryName.trim().toLowerCase();

      if (
        account.accountType !== "ASSET" ||
        (normalizedCategory !== "inventory" &&
          !normalizedName.includes("inventory"))
      ) {
        continue;
      }

      const option = {
        amount: account.amount,
        categoryId: account.categoryId,
        categoryName,
        id: account.id,
        name: account.name,
      };
      const key = `${option.categoryId}|${option.name.trim().toLowerCase()}`;

      if (!uniqueAccounts.has(key)) {
        uniqueAccounts.set(key, option);
      }
    }

    return Array.from(uniqueAccounts.values()).toSorted((first, second) =>
      first.name.localeCompare(second.name),
    );
  }, [categoryById, chartAccountsData?.accounts]);
  const [stockNo, setStockNo] = useState(defaultStockNo);
  const [openingDate, setOpeningDate] = useState(dateValue);
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [lines, setLines] = useState<DraftLine[]>(() => [createDraftLine()]);
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + toAmount(line.amount), 0),
    [lines],
  );

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
      currentLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              accountId: account.id,
              accountName: account.name,
              description:
                line.description.trim() || "Inventory introduced by owner",
            }
          : line,
      ),
    );
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
    setStockNo(defaultStockNo());
    setOpeningDate(dateValue());
    setReferenceNo("");
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

  const saveOpeningStock = async (closeAfterSave: boolean) => {
    const stockLines = lines
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

    if (stockLines.length === 0) {
      setMessage({
        text: "Enter at least one inventory amount.",
        tone: "error",
      });
      return;
    }

    try {
      const result = await createOpeningStockMutation.mutateAsync({
        lines: stockLines.map((line) => ({
          accountId: line.account?.id,
          accountName: line.account?.name ?? "",
          amount: line.amount,
          description:
            line.description ||
            `${line.account?.name ?? "Inventory"} introduced by owner`,
        })),
        notes: notes.trim() || undefined,
        openingDate,
        referenceNo: referenceNo.trim() || undefined,
        stockNo: stockNo.trim() || undefined,
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
            : "Opening stock could not be saved.",
        tone: "error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-white p-0 sm:max-w-6xl">
        <DialogHeader className="border-slate-200 border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <PackagePlusIcon className="size-5 text-blue-700" />
            Opening Stock
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_170px]">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FieldBlock id="opening-stock-name" label="Name *">
                <Input
                  className="h-10"
                  id="opening-stock-name"
                  placeholder="Owner / opening balance"
                  value="Owner Capital"
                  readOnly
                />
              </FieldBlock>

              <FieldBlock id="opening-stock-no" label="Stock No">
                <Input
                  className="h-10"
                  id="opening-stock-no"
                  onChange={(event) => setStockNo(event.target.value)}
                  placeholder="OST-2026-001"
                  value={stockNo}
                />
              </FieldBlock>

              <FieldBlock id="opening-stock-date" label="Date">
                <div className="relative">
                  <Input
                    className="h-10"
                    id="opening-stock-date"
                    onChange={(event) => setOpeningDate(event.target.value)}
                    type="date"
                    value={openingDate}
                  />
                  <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                </div>
              </FieldBlock>

              <FieldBlock id="opening-stock-reference" label="Reference No">
                <Input
                  className="h-10"
                  id="opening-stock-reference"
                  onChange={(event) => setReferenceNo(event.target.value)}
                  placeholder="REF-001"
                  value={referenceNo}
                />
              </FieldBlock>

              <FieldBlock label="Method">
                <Input className="h-10" readOnly value="Opening Balance" />
              </FieldBlock>

              <FieldBlock label="Account *">
                <Input className="h-10" readOnly value="Owner Capital" />
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

          <div className="mt-6 rounded-lg border border-slate-200">
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
                  <div className="font-medium text-slate-500">{index + 1}</div>
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
                    placeholder="Inventory introduced by owner"
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
                    aria-label={`Remove opening stock line ${index + 1}`}
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

          <div className="mt-6 grid gap-2 border-slate-200 border-t pt-5">
            <Label htmlFor="opening-stock-notes">Notes</Label>
            <Textarea
              className="min-h-28"
              id="opening-stock-notes"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Short note for opening stock"
              value={notes}
            />
          </div>

          <div className="mt-6 flex justify-end gap-2 border-slate-200 border-t pt-4">
            <Button
              disabled={createOpeningStockMutation.isPending}
              onClick={() => saveOpeningStock(false)}
              type="button"
              variant="outline"
            >
              <SaveIcon data-icon="inline-start" />
              Save
            </Button>
            <Button
              disabled={createOpeningStockMutation.isPending}
              onClick={() => saveOpeningStock(true)}
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

function FieldBlock({
  children,
  id,
  label,
}: {
  children: ReactNode;
  id?: string;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid gap-1">{children}</div>
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

        return `${account.name} ${account.categoryName}`
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
        placeholder="Select inventory account"
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
