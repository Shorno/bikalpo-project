"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarIcon,
  ChevronDownIcon,
  DownloadIcon,
  ExternalLinkIcon,
  Loader2,
  RefreshCcwIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  getDaybookExpensesInRange,
  getDaybookExpenseTotal,
  summarizeDaybookExpensesByCategory,
} from "@/components/dashboard/daybook/daybook-expense-reports";
import {
  getUnsyncedDaybookProductSalesInRange,
  summarizeDaybookProductSales,
} from "@/components/dashboard/daybook/daybook-product-sale-reports";
import {
  useDaybookExpenseScope,
  useDaybookExpenses,
} from "@/components/dashboard/daybook/use-daybook-expenses";
import { useDaybookProductSales } from "@/components/dashboard/daybook/use-daybook-product-sales";
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

type BreakdownRow = {
  amount: string;
  category: string;
  muted?: boolean;
  slug?: string | null;
};

type ReportTotals = {
  cogs: number;
  cogsRows: BreakdownRow[];
  grossProfit: number;
  grossProfitPercent: number;
  income: number;
  incomeRows: BreakdownRow[];
  isProfit: boolean;
  netProfit: number;
  netProfitPercent: number;
  operatingExpenseRows: BreakdownRow[];
  operatingExpenses: number;
};

function money(value: number | string | null | undefined) {
  const numeric = toNumber(value);
  const sign = numeric < 0 ? "-" : "";

  return `${sign}\u09F3${Math.abs(numeric).toLocaleString("en-US", {
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

function toPercent(value: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return (value / total) * 100;
}

function dateValue(date: Date) {
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

function yearFromDate(value: string) {
  const year = Number.parseInt(value.split("-")[0] ?? "", 10);
  return Number.isFinite(year) ? year : null;
}

function normalizeRows(
  rows: BreakdownRow[] | undefined,
  fallback: BreakdownRow,
) {
  if (!rows || rows.length === 0) {
    return [fallback];
  }

  return rows;
}

function addToBreakdownRow(
  rows: BreakdownRow[],
  slug: string,
  fallbackCategory: string,
  amount: number,
) {
  if (amount <= 0) {
    return rows;
  }

  let foundRow = false;
  const adjustedRows = rows.map((row) => {
    if (row.slug !== slug && row.category !== fallbackCategory) {
      return row;
    }

    foundRow = true;
    return {
      ...row,
      amount: String(toNumber(row.amount) + amount),
      muted: false,
    };
  });

  if (foundRow) {
    return adjustedRows;
  }

  return [
    ...adjustedRows,
    {
      amount: String(amount),
      category: fallbackCategory,
      slug,
    },
  ];
}

export function ProfitLossReport() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const daybookScope = useDaybookExpenseScope();
  const daybookExpenses = useDaybookExpenses(daybookScope);
  const daybookProductSales = useDaybookProductSales(daybookScope);
  const [year, setYear] = useState(currentYear);
  const [startDate, setStartDate] = useState(
    dateValueFromParts(currentYear, 1, 1),
  );
  const [endDate, setEndDate] = useState(dateValue(today));

  const {
    data: pnl,
    isFetching,
    isLoading,
    refetch,
  } = useQuery(
    orpc.profitLoss.getMonthlyPnL.queryOptions({
      input: { endDate, reportType: "accrual", startDate, year },
    }),
  );

  const totals = useMemo<ReportTotals>(() => {
    const daybookExpensesInRange = getDaybookExpensesInRange(daybookExpenses, {
      endDate,
      startDate,
    });
    const daybookExpenseRows = summarizeDaybookExpensesByCategory(
      daybookExpensesInRange,
    ).map((row) => ({
      amount: String(row.amount),
      category: row.category,
      slug: `daybook-${row.category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    }));
    const daybookExpenseTotal = getDaybookExpenseTotal(daybookExpensesInRange);
    const unsyncedProductSales = getUnsyncedDaybookProductSalesInRange(
      daybookProductSales,
      {
        endDate,
        startDate,
      },
    );
    const productSaleTotals =
      summarizeDaybookProductSales(unsyncedProductSales);
    const incomeRows = normalizeRows(
      pnl?.income?.breakdown,
      pnl?.revenue
        ? {
            amount: pnl.revenue,
            category: "Product Sales",
            slug: "product-sales",
          }
        : {
            amount: "0",
            category: "Product Sales",
            slug: "product-sales",
          },
    );
    const cogsRows = normalizeRows(
      pnl?.costOfGoods?.breakdown,
      pnl?.cogs
        ? {
            amount: pnl.cogs,
            category: "Product Purchase",
            slug: "product-purchase",
          }
        : {
            amount: "0",
            category: "Product Purchase",
            slug: "product-purchase",
          },
    );
    const adjustedIncomeRows = addToBreakdownRow(
      incomeRows,
      "product-sales",
      "Product Sales",
      productSaleTotals.totalSales,
    );
    const adjustedCogsRows = addToBreakdownRow(
      cogsRows,
      "product-purchase",
      "Product Purchase",
      productSaleTotals.totalCost,
    );
    const operatingExpenseRows = normalizeRows(
      [...(pnl?.expenses?.breakdown ?? []), ...daybookExpenseRows],
      {
        amount: "0",
        category: "No operating expenses",
        muted: true,
        slug: "no-operating-expenses",
      },
    );
    const operatingExpenses =
      toNumber(pnl?.expenses?.total) + daybookExpenseTotal;
    const income =
      toNumber(pnl?.income?.total ?? pnl?.revenue) +
      productSaleTotals.totalSales;
    const cogs =
      toNumber(pnl?.costOfGoods?.total ?? pnl?.cogs) +
      productSaleTotals.totalCost;
    const grossProfit = income - cogs;
    const netProfit = grossProfit - operatingExpenses;

    return {
      cogs,
      cogsRows: adjustedCogsRows,
      grossProfit,
      grossProfitPercent: toNumber(
        pnl?.grossProfitPercent ?? toPercent(grossProfit, income),
      ),
      income,
      incomeRows: adjustedIncomeRows,
      isProfit: netProfit >= 0,
      netProfit,
      netProfitPercent: toPercent(netProfit, income),
      operatingExpenseRows,
      operatingExpenses,
    };
  }, [daybookExpenses, daybookProductSales, endDate, pnl, startDate]);

  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, index) => currentYear - 4 + index),
    [currentYear],
  );

  const handleYearChange = (value: string) => {
    const nextYear = Number.parseInt(value, 10);
    if (!Number.isFinite(nextYear)) {
      return;
    }

    setYear(nextYear);
    setStartDate(dateValueFromParts(nextYear, 1, 1));
    setEndDate(
      nextYear === currentYear
        ? dateValue(today)
        : dateValueFromParts(nextYear, 12, 31),
    );
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    const nextYear = yearFromDate(value);
    if (nextYear) {
      setYear(nextYear);
    }
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    const nextYear = yearFromDate(value);
    if (nextYear) {
      setYear(nextYear);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">
            Profit & Loss Statement
          </h1>
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

      <ReportFilters
        endDate={endDate}
        isFetching={isFetching}
        onEndDateChange={handleEndDateChange}
        onRefresh={() => void refetch()}
        onStartDateChange={handleStartDateChange}
        onYearChange={handleYearChange}
        startDate={startDate}
        year={year}
        yearOptions={yearOptions}
      />

      {isLoading ? (
        <div className="flex min-h-80 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <AccountDetailsTable
          endDate={endDate}
          startDate={startDate}
          totals={totals}
        />
      )}
    </div>
  );
}

function ReportFilters({
  endDate,
  isFetching,
  onEndDateChange,
  onRefresh,
  onStartDateChange,
  onYearChange,
  startDate,
  year,
  yearOptions,
}: {
  endDate: string;
  isFetching: boolean;
  onEndDateChange: (value: string) => void;
  onRefresh: () => void;
  onStartDateChange: (value: string) => void;
  onYearChange: (value: string) => void;
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
        <Button
          className="h-9 rounded-full bg-blue-600 px-5 hover:bg-blue-700"
          disabled={isFetching}
          onClick={onRefresh}
          type="button"
        >
          {isFetching ? (
            <Loader2 className="animate-spin" />
          ) : (
            <RefreshCcwIcon />
          )}
          Update Report
        </Button>
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
    <div className="mx-auto max-w-4xl pt-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-base font-bold text-slate-950">ACCOUNTS</h2>
        <div className="text-right text-sm font-bold text-slate-950">
          <div>{formatReportDate(startDate)}</div>
          <div>to {formatReportDate(endDate)}</div>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <tbody>
            <SectionHeader title="Income" />
            {totals.incomeRows.map((row) => (
              <AccountRow key={row.slug ?? row.category} row={row} />
            ))}
            <TotalRow label="Total Income" value={totals.income} />

            <SpacerRow />
            <SectionHeader title="Cost of Goods Sold" />
            {totals.cogsRows.map((row) => (
              <AccountRow key={row.slug ?? row.category} row={row} />
            ))}
            <TotalRow label="Total Cost of Goods Sold" value={totals.cogs} />

            <SpacerRow />
            <MetricBand
              label="Gross Profit"
              percent={totals.grossProfitPercent}
              value={totals.grossProfit}
            />

            <SpacerRow />
            <SectionHeader title="Operating Expenses" />
            {totals.operatingExpenseRows.map((row) => (
              <AccountRow key={row.slug ?? row.category} row={row} />
            ))}
            <TotalRow
              label="Total Operating Expenses"
              value={totals.operatingExpenses}
            />

            <SpacerRow />
            <MetricBand
              emphasis={totals.isProfit ? "profit" : "loss"}
              label={totals.isProfit ? "Net Profit" : "Net Loss"}
              percent={totals.netProfitPercent}
              value={totals.netProfit}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <tr>
      <td
        className="bg-slate-200 px-3 py-3 font-bold text-slate-950"
        colSpan={2}
      >
        {title}
      </td>
    </tr>
  );
}

function AccountRow({ row }: { row: BreakdownRow }) {
  return (
    <tr className="border-b border-slate-200">
      <td
        className={`px-3 py-3 font-semibold ${
          row.muted ? "text-slate-400" : "text-blue-700 hover:text-blue-800"
        }`}
      >
        {row.muted ? (
          row.category
        ) : (
          <span className="inline-flex items-center gap-1">
            {row.category}
            <ExternalLinkIcon className="size-3" />
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-950">
        {money(row.amount)}
      </td>
    </tr>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <tr className="border-b border-slate-300">
      <td className="px-3 py-3 font-bold text-slate-950">{label}</td>
      <td className="px-3 py-3 text-right font-bold tabular-nums text-slate-950">
        {money(value)}
      </td>
    </tr>
  );
}

function MetricBand({
  emphasis,
  label,
  percent,
  value,
}: {
  emphasis?: "loss" | "profit";
  label: string;
  percent: number;
  value: number;
}) {
  return (
    <tr>
      <td className="bg-slate-200 px-3 py-3" colSpan={2}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
          <div>
            <div className="font-bold text-slate-950">{label}</div>
            <div className="mt-1 text-xs text-slate-600">
              As a percentage of Total Income
            </div>
          </div>
          <div className="text-right">
            <div
              className={`font-bold tabular-nums ${
                emphasis === "profit"
                  ? "text-emerald-700"
                  : emphasis === "loss"
                    ? "text-red-700"
                    : "text-slate-950"
              }`}
            >
              {money(value)}
            </div>
            <div className="mt-1 text-xs tabular-nums text-slate-600">
              {percent.toFixed(2)}%
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function SpacerRow() {
  return (
    <tr>
      <td className="py-5" colSpan={2} />
    </tr>
  );
}
