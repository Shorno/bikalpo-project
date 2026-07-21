"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
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

export function ProfitLossReport() {
  const today = new Date();
  const [year] = useState(today.getFullYear());
  const [month] = useState(today.getMonth() + 1);

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

    return {
      expense,
      income,
      isProfit: netProfit >= 0,
      monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
      netProfit,
      operatingExpenses,
    };
  }, [month, pnl, year]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-950">Profit & Loss</h1>
        <p className="mt-1 text-sm text-slate-500">{totals.monthLabel}</p>
      </div>

      {isLoading ? (
        <div className="flex min-h-80 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportAmount label="Income" value={money(totals.income)} />
            <ReportAmount label="Expense" value={money(totals.expense)} />
            <ReportAmount
              label="Operating Expenses"
              value={money(totals.operatingExpenses)}
            />
            <ReportAmount
              emphasis={totals.isProfit ? "profit" : "loss"}
              label={totals.isProfit ? "Net Profit" : "Net Loss"}
              value={money(Math.abs(totals.netProfit))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ReportAmount({
  emphasis,
  label,
  value,
}: {
  emphasis?: "loss" | "profit";
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div
        className={`mt-2 text-2xl font-semibold ${
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
