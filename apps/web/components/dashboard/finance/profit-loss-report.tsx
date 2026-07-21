"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarIcon,
  ChevronDownIcon,
  DownloadIcon,
  Loader2,
  RefreshCcwIcon,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function formatReportDate(value: string) {
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

export function ProfitLossReport() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [reportType, setReportType] = useState("accrual");
  const [view, setView] = useState("details");

  const { data: pnl, isLoading } = useQuery(
    orpc.profitLoss.getMonthlyPnL.queryOptions({
      input: { year, month },
    }),
  );

  const totals = useMemo(() => {
    const income = toNumber(pnl?.revenue);
    const expense = toNumber(pnl?.cogs);
    const netProfit = income - expense;

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
      ],
      expense,
      income,
      isProfit: netProfit >= 0,
      monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
      netProfit,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Profit & Loss</h1>
          <p className="mt-1 text-sm text-slate-500">{totals.monthLabel}</p>
        </div>
        <Button
          className="h-10 w-fit rounded-full border-blue-600 px-5 font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-800"
          variant="outline"
        >
          <DownloadIcon />
          Export
          <ChevronDownIcon />
        </Button>
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
        <>
          <ReportEquation totals={totals} />
          <Tabs className="space-y-6" onValueChange={setView} value={view}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-7">
              <div className="h-px bg-slate-200" />
              <TabsList className="bg-sky-100">
                <TabsTrigger className="px-5" value="summary">
                  Summary
                </TabsTrigger>
                <TabsTrigger className="px-5" value="details">
                  Details
                </TabsTrigger>
              </TabsList>
              <div className="h-px bg-slate-200" />
            </div>

            <TabsContent value="summary">
              <SummaryTable totals={totals} />
            </TabsContent>
            <TabsContent value="details">
              <AccountDetailsTable
                endDate={endDate}
                startDate={startDate}
                totals={totals}
              />
            </TabsContent>
          </Tabs>
        </>
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
        <label className="text-sm font-medium text-slate-900">
          Report Type
        </label>
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

function AccountDetailsTable({
  endDate,
  startDate,
  totals,
}: {
  endDate: string;
  startDate: string;
  totals: ReportTotals;
}) {
  return (
    <div className="pt-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-base font-bold text-slate-950">ACCOUNTS</h2>
        <div className="text-right text-sm font-bold text-slate-950">
          <div>{formatReportDate(startDate)}</div>
          <div>to {formatReportDate(endDate)}</div>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <tbody>
            {totals.accountSections.map((section) => (
              <Fragment key={section.title}>
                <tr>
                  <td
                    className="bg-slate-200 px-4 py-3 font-bold text-slate-950"
                    colSpan={2}
                  >
                    {section.title}
                  </td>
                </tr>
                {section.rows.map((row) => (
                  <tr className="border-b border-slate-200" key={row.label}>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        row.muted
                          ? "text-slate-400"
                          : "text-blue-700 hover:text-blue-800"
                      }`}
                    >
                      {row.label}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-950">
                      {money(row.amount)}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-slate-300">
                  <td className="px-4 py-3 font-bold text-slate-950">
                    {section.totalLabel}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-950">
                    {money(section.total)}
                  </td>
                </tr>
                <tr>
                  <td className="py-5" colSpan={2} />
                </tr>
              </Fragment>
            ))}

            <tr className="border-t-2 border-slate-400">
              <td className="px-4 py-4 text-base font-bold text-slate-950">
                {totals.isProfit ? "Net Profit" : "Net Loss"}
              </td>
              <td
                className={`px-4 py-4 text-right text-base font-bold ${
                  totals.isProfit ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {totals.isProfit ? "" : "-"}
                {money(Math.abs(totals.netProfit))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryTable({ totals }: { totals: ReportTotals }) {
  const rows = [
    { label: "Income", value: totals.income },
    { label: "Expense", value: totals.expense },
  ];

  return (
    <div className="mx-auto max-w-2xl border-y border-slate-200">
      {rows.map((row) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-slate-200 px-2 py-3 last:border-b-0"
          key={row.label}
        >
          <div className="font-semibold text-slate-700">{row.label}</div>
          <div className="font-semibold text-slate-950">{money(row.value)}</div>
        </div>
      ))}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-t-2 border-slate-400 px-2 py-4">
        <div className="font-bold text-slate-950">
          {totals.isProfit ? "Net Profit" : "Net Loss"}
        </div>
        <div
          className={`font-bold ${
            totals.isProfit ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {totals.isProfit ? "" : "-"}
          {money(Math.abs(totals.netProfit))}
        </div>
      </div>
    </div>
  );
}
