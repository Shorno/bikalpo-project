"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, Loader2, RefreshCcwIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/utils/orpc";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type ExpenseLine = {
  amount: number | string;
  category: string;
  slug?: string | null;
};

type AccountLine = {
  amount: number;
  label: string;
  muted?: boolean;
};

type AccountSection = {
  rows: AccountLine[];
  title: string;
  total: number;
  totalLabel: string;
};

type ReportTotals = {
  accountSections: AccountSection[];
  expense: number;
  income: number;
  isProfit: boolean;
  monthLabel: string;
  netProfit: number;
  operatingExpenses: number;
};

function money(value: number) {
  return `\u09F3${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0",
  )}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getDateParts(value: string) {
  const [rawYear, rawMonth] = value.split("-");
  const nextYear = Number.parseInt(rawYear ?? "", 10);
  const nextMonth = Number.parseInt(rawMonth ?? "", 10);

  if (!Number.isFinite(nextYear) || !Number.isFinite(nextMonth)) {
    return null;
  }

  return {
    month: Math.min(Math.max(nextMonth, 1), 12),
    year: nextYear,
  };
}

export function ProfitLossReport() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [reportType, setReportType] = useState("accrual");

  const { data: pnl, isLoading } = useQuery(
    orpc.profitLoss.getMonthlyPnL.queryOptions({
      input: { year, month },
    }),
  );

  const totals = useMemo(() => {
    const income = toNumber(pnl?.revenue);
    const expense = toNumber(pnl?.cogs);
    const operatingExpenses = toNumber(pnl?.expenses?.total);
    const netProfit = toNumber(pnl?.netProfit);
    const operatingExpenseRows = (
      (pnl?.expenses?.breakdown ?? []) as ExpenseLine[]
    ).map((line) => ({
      amount: toNumber(line.amount),
      label: line.category,
    }));

    return {
      accountSections: [
        {
          rows: [{ amount: income, label: "Product Sales" }],
          title: "Income",
          total: income,
          totalLabel: "Total Income",
        },
        {
          rows: [{ amount: expense, label: "Product Purchase" }],
          title: "Expense",
          total: expense,
          totalLabel: "Total Expense",
        },
        {
          rows:
            operatingExpenseRows.length > 0
              ? operatingExpenseRows
              : [
                  {
                    amount: 0,
                    label: "No operating expenses",
                    muted: true,
                  },
                ],
          title: "Operating Expenses",
          total: operatingExpenses,
          totalLabel: "Total Operating Expenses",
        },
      ],
      expense,
      income,
      isProfit: netProfit >= 0,
      monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
      netProfit,
      operatingExpenses,
    };
  }, [month, pnl, year]);

  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, index) => currentYear - 4 + index),
    [currentYear],
  );
  const startDate = dateValue(year, month, 1);
  const endDate = dateValue(year, month, daysInMonth(year, month));

  const updateFromDate = (value: string) => {
    const next = getDateParts(value);

    if (!next) {
      return;
    }

    setYear(next.year);
    setMonth(next.month);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-950">Profit & Loss</h1>
        <p className="mt-1 text-sm text-slate-500">{totals.monthLabel}</p>
      </div>

      <ReportFilters
        endDate={endDate}
        onEndDateChange={updateFromDate}
        onReportTypeChange={setReportType}
        onStartDateChange={updateFromDate}
        onYearChange={(value) => setYear(Number.parseInt(value, 10))}
        reportType={reportType}
        startDate={startDate}
        year={year}
        yearOptions={yearOptions}
      />

      {isLoading ? (
        <div className="flex min-h-80 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <ReportEquation totals={totals} />
      )}
    </div>
  );
}

function ReportEquation({ totals }: { totals: ReportTotals }) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-x-5 gap-y-4 py-2 text-center">
      <EquationMetric label="Income" value={money(totals.income)} />
      <EquationOperator value="-" />
      <EquationMetric label="Expense" value={money(totals.expense)} />
      <EquationOperator value="-" />
      <EquationMetric
        label="Operating Expenses"
        value={money(totals.operatingExpenses)}
      />
      <EquationOperator value="=" />
      <EquationMetric
        emphasis={totals.isProfit ? "profit" : "loss"}
        label={totals.isProfit ? "Net Profit" : "Net Loss"}
        value={money(Math.abs(totals.netProfit))}
      />
    </div>
  );
}

function ReportFilters({
  endDate,
  onEndDateChange,
  onReportTypeChange,
  onStartDateChange,
  onYearChange,
  reportType,
  startDate,
  year,
  yearOptions,
}: {
  endDate: string;
  onEndDateChange: (value: string) => void;
  onReportTypeChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onYearChange: (value: string) => void;
  reportType: string;
  startDate: string;
  year: number;
  yearOptions: number[];
}) {
  return (
    <div className="rounded-lg bg-slate-100 p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        <label className="text-sm font-medium text-slate-900">Date Range</label>
        <div className="grid gap-3 sm:grid-cols-[minmax(150px,215px)_minmax(140px,1fr)_minmax(140px,1fr)]">
          <Select onValueChange={onYearChange} value={String(year)}>
            <SelectTrigger className="h-9 w-full border-blue-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DateInput
            ariaLabel="Profit and loss start date"
            onChange={onStartDateChange}
            value={startDate}
          />
          <DateInput
            ariaLabel="Profit and loss end date"
            onChange={onEndDateChange}
            value={endDate}
          />
        </div>
        <Button className="h-9 rounded-full bg-blue-600 px-5 hover:bg-blue-700">
          <RefreshCcwIcon />
          Update Report
        </Button>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
        <div />
        <button
          className="w-fit text-sm font-semibold text-blue-600 hover:text-blue-700"
          type="button"
        >
          Compare to a prior period
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[auto_minmax(180px,235px)] sm:items-center">
        <label className="text-sm font-medium text-slate-900">Report Type</label>
        <Select onValueChange={onReportTypeChange} value={reportType}>
          <SelectTrigger className="h-9 w-full border-blue-200 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="accrual">Accrual (Paid & Unpaid)</SelectItem>
            <SelectItem value="cash">Cash Basis (Paid)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function DateInput({
  ariaLabel,
  onChange,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="relative">
      <Input
        aria-label={ariaLabel}
        className="h-9 border-blue-200 bg-white pr-9"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
      <CalendarIcon className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

function EquationMetric({
  emphasis,
  label,
  value,
}: {
  emphasis?: "loss" | "profit";
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-36">
      <div className="text-xs font-bold text-slate-600">{label}</div>
      <div
        className={`mt-3 text-3xl font-medium tracking-normal ${
          emphasis === "profit"
            ? "text-emerald-700"
            : emphasis === "loss"
              ? "text-red-700"
              : "text-slate-950"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function EquationOperator({ value }: { value: "-" | "=" }) {
  return (
    <div className="pb-1 text-3xl font-semibold leading-none text-slate-950">
      {value}
    </div>
  );
}
