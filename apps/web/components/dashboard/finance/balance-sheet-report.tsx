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
import {
  useDaybookExpenseScope,
  useDaybookExpenses,
} from "@/components/dashboard/daybook/use-daybook-expenses";
import { useDaybookProductSales } from "@/components/dashboard/daybook/use-daybook-product-sales";
import {
  applyDaybookExpensesToBalanceSheet,
  applyUnsyncedDaybookProductSalesToBalanceSheet,
} from "@/components/dashboard/finance/balance-sheet-daybook-adjustments";
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

type ReportType = "accrual" | "cash";

type AccountRow = {
  amount: string;
  label: string;
  muted?: boolean;
};

type AccountGroup = {
  rows: AccountRow[];
  title: string;
  total: string;
  totalLabel: string;
};

type AccountSection = {
  groups: AccountGroup[];
  title: string;
  total: string;
  totalLabel: string;
};

type BalanceSheetData = {
  period: {
    asOfDate: string;
    asOfLabel: string;
    endDate: string;
    reportType: ReportType;
    startDate: string;
    year: number;
  };
  sections: AccountSection[];
  summary: {
    cashAndBank: string;
    customerAdvance: string;
    inventory: string;
    netAssets: string;
    payable: string;
    receivable: string;
    retainedEarnings: string;
    supplierAdvance: string;
    totalAssets: string;
    totalEquity: string;
    totalLiabilities: string;
  };
};

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasReportBalance(value: number | string | null | undefined) {
  return Math.abs(toNumber(value)) > 0.000_001;
}

function filterZeroBalanceReport(report: BalanceSheetData): BalanceSheetData {
  return {
    ...report,
    sections: report.sections
      .map((section) => ({
        ...section,
        groups: section.groups
          .map((group) => ({
            ...group,
            rows: group.rows.filter((row) => hasReportBalance(row.amount)),
          }))
          .filter(
            (group) => hasReportBalance(group.total) && group.rows.length > 0,
          ),
      }))
      .filter(
        (section) =>
          hasReportBalance(section.total) && section.groups.length > 0,
      ),
  };
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

function yearFromDate(value: string) {
  const year = Number.parseInt(value.split("-")[0] ?? "", 10);
  return Number.isFinite(year) ? year : null;
}

export function BalanceSheetReport() {
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
  const [reportType, setReportType] = useState<ReportType>("accrual");

  const {
    data: report,
    isFetching,
    isLoading,
    refetch,
  } = useQuery(
    orpc.balanceSheet.getBalanceSheet.queryOptions({
      input: { endDate, reportType, startDate, year },
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    }),
  );
  const adjustedReport = useMemo(
    () =>
      report
        ? applyUnsyncedDaybookProductSalesToBalanceSheet(
            applyDaybookExpensesToBalanceSheet(report, daybookExpenses, {
              endDate,
              startDate,
            }),
            daybookProductSales,
            {
              endDate,
              startDate,
            },
          )
        : null,
    [daybookExpenses, daybookProductSales, endDate, report, startDate],
  );
  const visibleReport = useMemo(
    () => (adjustedReport ? filterZeroBalanceReport(adjustedReport) : null),
    [adjustedReport],
  );

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
          <h1 className="text-3xl font-bold text-slate-950">Balance Sheet</h1>
          <p className="mt-1 text-sm text-slate-500">
            As of {adjustedReport?.period.asOfLabel ?? endDate}
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

      <ReportFilters
        endDate={endDate}
        isFetching={isFetching}
        onEndDateChange={handleEndDateChange}
        onRefresh={() => void refetch()}
        onReportTypeChange={(value) => setReportType(value as ReportType)}
        onStartDateChange={handleStartDateChange}
        onYearChange={handleYearChange}
        reportType={reportType}
        startDate={startDate}
        year={year}
        yearOptions={yearOptions}
      />

      {isLoading ? (
        <div className="flex min-h-80 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-slate-400" />
        </div>
      ) : visibleReport ? (
        <AccountDetailsTable report={visibleReport} />
      ) : null}
    </div>
  );
}

function ReportFilters({
  endDate,
  isFetching,
  onEndDateChange,
  onRefresh,
  onReportTypeChange,
  onStartDateChange,
  onYearChange,
  reportType,
  startDate,
  year,
  yearOptions,
}: {
  endDate: string;
  isFetching: boolean;
  onEndDateChange: (value: string) => void;
  onRefresh: () => void;
  onReportTypeChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onYearChange: (value: string) => void;
  reportType: ReportType;
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
            ariaLabel="Balance sheet start date"
            onChange={onStartDateChange}
            value={startDate}
          />
          <DateInput
            ariaLabel="Balance sheet end date"
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

function AccountDetailsTable({ report }: { report: BalanceSheetData }) {
  return (
    <div className="pt-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-base font-bold text-slate-950">ACCOUNTS</h2>
        <div className="text-right text-sm font-bold text-slate-950">
          {report.period.asOfLabel}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <tbody>
            {report.sections.map((section) => (
              <Fragment key={section.title}>
                <tr>
                  <td
                    className="bg-slate-300 px-4 py-3 font-bold text-slate-950"
                    colSpan={2}
                  >
                    {section.title}
                  </td>
                </tr>
                {section.groups.map((group) => (
                  <Fragment key={group.title}>
                    <tr>
                      <td
                        className="bg-slate-100 px-8 py-2.5 font-bold text-slate-950"
                        colSpan={2}
                      >
                        {group.title}
                      </td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr
                        className="border-b border-slate-200"
                        key={`${group.title}-${row.label}`}
                      >
                        <td
                          className={`px-10 py-3 font-semibold ${
                            row.muted
                              ? "text-slate-400"
                              : "text-blue-700 hover:text-blue-800"
                          }`}
                        >
                          {row.label}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums text-slate-950">
                          {money(row.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-b border-slate-300">
                      <td className="px-8 py-3 font-bold text-slate-950">
                        {group.totalLabel}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-950">
                        {money(group.total)}
                      </td>
                    </tr>
                  </Fragment>
                ))}
                <tr className="border-b border-slate-300">
                  <td className="px-4 py-3 font-bold text-slate-950">
                    {section.totalLabel}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-slate-950">
                    {money(section.total)}
                  </td>
                </tr>
                <tr>
                  <td className="py-5" colSpan={2} />
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
