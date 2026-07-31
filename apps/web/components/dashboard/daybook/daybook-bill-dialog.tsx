"use client";

import {
  CalendarIcon,
  FileTextIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  addDaybookBill,
  createDaybookBillId,
  type DaybookBillLine,
  type DaybookBillPartyType,
} from "@/components/dashboard/daybook/daybook-bill-ledger";
import {
  buildDaybookBillPayeeOptions,
  filterDaybookBillPayees,
} from "@/components/dashboard/daybook/daybook-bill-payees";
import type { DaybookExpenseScope } from "@/components/dashboard/daybook/daybook-expense-ledger";
import { useDaybookBills } from "@/components/dashboard/daybook/use-daybook-bills";
import { useDaybookProductPurchases } from "@/components/dashboard/daybook/use-daybook-product-purchases";
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

type DaybookBillDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  scope: DaybookExpenseScope;
};

type DraftBillLine = {
  amount: string;
  category: string;
  description: string;
  id: string;
};

const BILL_CATEGORIES = [
  "Bills / Utilities",
  "Purchase Bill",
  "Service Bill",
  "Rent",
  "Miscellaneous",
] as const;

function createDraftLine(): DraftBillLine {
  return {
    amount: "",
    category: BILL_CATEGORIES[0] ?? "Bills / Utilities",
    description: "",
    id: createDaybookBillId("bill-line"),
  };
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

export function DaybookBillDialog({
  onOpenChange,
  open,
  scope,
}: DaybookBillDialogProps) {
  const savedBills = useDaybookBills(scope);
  const savedProductPurchases = useDaybookProductPurchases(scope);
  const savedProductSales = useDaybookProductSales(scope);
  const [partyType, setPartyType] = useState<DaybookBillPartyType>("supplier");
  const [payeeName, setPayeeName] = useState("");
  const [selectedPayeeId, setSelectedPayeeId] = useState("");
  const [payeeFocused, setPayeeFocused] = useState(false);
  const [issueDate, setIssueDate] = useState(dateValue);
  const [dueDate, setDueDate] = useState(dateValue);
  const [billNo, setBillNo] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [lines, setLines] = useState<DraftBillLine[]>(() => [
    createDraftLine(),
  ]);
  const scopeLabel = scope === "warehouse" ? "Warehouse" : "Retailer";
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + toAmount(line.amount), 0),
    [lines],
  );
  const payeeOptions = useMemo(
    () =>
      buildDaybookBillPayeeOptions({
        bills: savedBills,
        partyType,
        productPurchases: savedProductPurchases,
        productSales: savedProductSales,
      }),
    [partyType, savedBills, savedProductPurchases, savedProductSales],
  );
  const filteredPayees = useMemo(
    () => filterDaybookBillPayees(payeeOptions, payeeName).slice(0, 6),
    [payeeName, payeeOptions],
  );
  const selectedPayee = useMemo(
    () => payeeOptions.find((option) => option.id === selectedPayeeId),
    [payeeOptions, selectedPayeeId],
  );
  const matchingPayee = useMemo(
    () =>
      payeeOptions.find(
        (option) =>
          option.name.trim().toLowerCase() === payeeName.trim().toLowerCase(),
      ),
    [payeeName, payeeOptions],
  );
  const activePayee = selectedPayee ?? matchingPayee;
  const previousBillAmount = activePayee?.previousBillAmount ?? 0;
  const changePartyType = (nextPartyType: DaybookBillPartyType) => {
    setPartyType(nextPartyType);
    setPayeeName("");
    setSelectedPayeeId("");
    setPayeeFocused(false);
  };
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
  const buildBillLines = () => {
    const billLines: DaybookBillLine[] = [];

    for (const line of lines) {
      const amount = toAmount(line.amount);

      if (amount <= 0) {
        continue;
      }

      billLines.push({
        amount,
        category: line.category,
        description: line.description.trim(),
        id: createDaybookBillId("saved-bill-line"),
      });
    }

    return billLines;
  };
  const resetForm = () => {
    setPayeeName("");
    setSelectedPayeeId("");
    setPayeeFocused(false);
    setIssueDate(dateValue());
    setDueDate(dateValue());
    setBillNo("");
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
  const saveBill = (closeAfterSave: boolean) => {
    const partyName = payeeName.trim();
    const billLines = buildBillLines();
    const nextTotal = billLines.reduce((sum, line) => sum + line.amount, 0);

    if (!partyName) {
      setMessage({ text: "Select or enter a payee.", tone: "error" });
      return;
    }

    if (nextTotal <= 0 || billLines.length === 0) {
      setMessage({ text: "Enter at least one bill amount.", tone: "error" });
      return;
    }

    addDaybookBill({
      billNo: billNo.trim(),
      createdAt: new Date().toISOString(),
      dueDate,
      id: createDaybookBillId("daybook-bill"),
      issueDate,
      lines: billLines,
      notes: notes.trim(),
      partyId: activePayee?.id ?? `${partyType}-${partyName}`,
      partyName,
      partyType,
      previousBillAmount,
      referenceNo: referenceNo.trim(),
      scope,
      total: nextTotal,
    });

    resetForm();

    if (closeAfterSave) {
      setMessage(null);
      onOpenChange(false);
      return;
    }

    setMessage({ text: "Bill saved.", tone: "success" });
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-slate-50 p-0 sm:max-w-5xl">
        <DialogHeader className="border-slate-200 border-b bg-white px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <FileTextIcon className="size-5 text-blue-700" />
            Bill
          </DialogTitle>
          <DialogDescription>
            Record an unpaid supplier or customer bill for {scopeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Payee type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => changePartyType("supplier")}
                    type="button"
                    variant={partyType === "supplier" ? "default" : "outline"}
                  >
                    Supplier
                  </Button>
                  <Button
                    onClick={() => changePartyType("customer")}
                    type="button"
                    variant={partyType === "customer" ? "default" : "outline"}
                  >
                    Customer
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="daybook-bill-payee">Payee</Label>
                <div className="relative">
                  <Input
                    autoComplete="off"
                    id="daybook-bill-payee"
                    onBlur={() =>
                      window.setTimeout(() => setPayeeFocused(false), 120)
                    }
                    onChange={(event) => {
                      setPayeeName(event.target.value);
                      setSelectedPayeeId("");
                      setPayeeFocused(true);
                    }}
                    onFocus={() => setPayeeFocused(true)}
                    placeholder={`Type ${partyType} name`}
                    value={payeeName}
                  />
                  {payeeFocused && filteredPayees.length > 0 ? (
                    <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                      {filteredPayees.map((payee) => (
                        <button
                          className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
                          key={payee.id}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setPayeeName(payee.name);
                            setSelectedPayeeId(payee.id);
                            setPayeeFocused(false);
                          }}
                          type="button"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">
                              {payee.name}
                            </span>
                            <span className="block text-slate-500 text-xs">
                              {payee.subtitle}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-700 text-xs">
                            Prev {money(payee.previousBillAmount)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
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
              <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 font-semibold text-amber-700 text-sm">
                Previous bill {money(previousBillAmount)}
              </div>
              <div className="mt-2 rounded-md bg-blue-50 px-3 py-2 font-semibold text-blue-700 text-sm">
                After this bill {money(previousBillAmount + total)}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="daybook-bill-issue-date">Bill Date</Label>
              <div className="relative">
                <Input
                  id="daybook-bill-issue-date"
                  onChange={(event) => setIssueDate(event.target.value)}
                  type="date"
                  value={issueDate}
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="daybook-bill-due-date">Due Date</Label>
              <div className="relative">
                <Input
                  id="daybook-bill-due-date"
                  onChange={(event) => setDueDate(event.target.value)}
                  type="date"
                  value={dueDate}
                />
                <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="daybook-bill-no">Bill no.</Label>
              <Input
                id="daybook-bill-no"
                onChange={(event) => setBillNo(event.target.value)}
                placeholder="BILL-2026-001"
                value={billNo}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="daybook-bill-reference">Ref no.</Label>
              <Input
                id="daybook-bill-reference"
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="Reference"
                value={referenceNo}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-2">
            <Label htmlFor="daybook-bill-notes">Notes</Label>
            <Textarea
              id="daybook-bill-notes"
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Short note for this bill"
              value={notes}
            />
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-[52px_minmax(180px,0.9fr)_minmax(220px,1fr)_minmax(150px,0.7fr)_52px] border-slate-200 border-b bg-slate-50 px-4 py-3 font-semibold text-slate-700 text-xs uppercase">
              <div>#</div>
              <div>Category</div>
              <div>Description</div>
              <div className="text-right">Amount</div>
              <div />
            </div>
            {lines.map((line, index) => (
              <div
                className="grid grid-cols-[52px_minmax(180px,0.9fr)_minmax(220px,1fr)_minmax(150px,0.7fr)_52px] items-center border-slate-200 border-b px-4 py-3 last:border-b-0"
                key={line.id}
              >
                <div className="font-medium text-slate-500">{index + 1}</div>
                <Select
                  onValueChange={(value) =>
                    updateLine(line.id, "category", value)
                  }
                  value={line.category}
                >
                  <SelectTrigger className="h-9 w-full bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILL_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-9"
                  onChange={(event) =>
                    updateLine(line.id, "description", event.target.value)
                  }
                  placeholder="Description"
                  value={line.description}
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
                  aria-label={`Remove bill line ${index + 1}`}
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

          <div className="mt-6 flex justify-end gap-2">
            <Button
              onClick={() => handleDialogOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button onClick={() => saveBill(false)} type="button">
              <SaveIcon data-icon="inline-start" />
              Save
            </Button>
            <Button onClick={() => saveBill(true)} type="button">
              <PlusIcon data-icon="inline-start" />
              Save and close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
