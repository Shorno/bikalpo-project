"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart3, ChevronLeft, ChevronRight, DollarSign, Loader2, Minus, ShoppingCart, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function WarehouseProfitLossPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: pnl, isLoading } = useQuery(orpc.profitLoss.getMonthlyPnL.queryOptions({ input: { year, month } }));

  const prev = () => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); };
  const next = () => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); };

  const revenue = parseFloat(pnl?.revenue ?? "0");
  const cogs = parseFloat(pnl?.cogs ?? "0");
  const grossProfit = parseFloat(pnl?.grossProfit ?? "0");
  const totalExp = parseFloat(pnl?.expenses?.total ?? "0");
  const netProfit = parseFloat(pnl?.netProfit ?? "0");
  const isProfit = netProfit >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BarChart3 className="w-6 h-6 text-indigo-600" /> Profit & Loss</h1>
        <p className="text-sm text-gray-500 mt-1">Auto-generated monthly financial report</p>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={prev} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={18} /></button>
        <span className="text-lg font-semibold text-gray-900 min-w-[180px] text-center">{MONTHS[month - 1]} {year}</span>
        <button onClick={next} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={18} /></button>
      </div>
      {isLoading ? (<div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4"><div className="flex items-center gap-2 mb-2"><ShoppingCart size={16} className="text-green-500" /><span className="text-xs text-gray-500 uppercase font-medium">Revenue</span></div><p className="text-xl font-bold text-green-700">৳{revenue.toLocaleString()}</p></div>
            <div className="bg-white rounded-xl border p-4"><div className="flex items-center gap-2 mb-2"><DollarSign size={16} className="text-blue-500" /><span className="text-xs text-gray-500 uppercase font-medium">COGS</span></div><p className="text-xl font-bold text-blue-700">৳{cogs.toLocaleString()}</p></div>
            <div className="bg-white rounded-xl border p-4"><div className="flex items-center gap-2 mb-2"><TrendingUp size={16} className="text-purple-500" /><span className="text-xs text-gray-500 uppercase font-medium">Gross Profit</span></div><p className={`text-xl font-bold ${grossProfit >= 0 ? "text-purple-700" : "text-red-700"}`}>৳{grossProfit.toLocaleString()}</p></div>
            <div className={`rounded-xl border p-4 ${isProfit ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}><div className="flex items-center gap-2 mb-2">{isProfit ? <TrendingUp size={16} className="text-emerald-600" /> : <TrendingDown size={16} className="text-red-600" />}<span className={`text-xs uppercase font-medium ${isProfit ? "text-emerald-600" : "text-red-600"}`}>Net {isProfit ? "Profit" : "Loss"}</span></div><p className={`text-xl font-bold ${isProfit ? "text-emerald-700" : "text-red-700"}`}>৳{Math.abs(netProfit).toLocaleString()}</p></div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b"><tr><th className="px-5 py-3 text-left text-gray-600 font-medium">Item</th><th className="px-5 py-3 text-right text-gray-600 font-medium">Amount (৳)</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-green-50/50"><td className="px-5 py-3 font-semibold text-green-800">Revenue</td><td className="px-5 py-3 text-right font-bold text-green-700">{revenue.toLocaleString()}</td></tr>
                <tr><td className="px-5 py-3 text-gray-700 flex items-center gap-1"><Minus size={12} className="text-gray-400" />COGS</td><td className="px-5 py-3 text-right text-red-600">({cogs.toLocaleString()})</td></tr>
                <tr className="bg-purple-50/50 border-t-2 border-purple-200"><td className="px-5 py-3 font-bold text-purple-800">Gross Profit</td><td className="px-5 py-3 text-right font-bold text-purple-700">{grossProfit.toLocaleString()}</td></tr>
                <tr><td colSpan={2} className="py-1 bg-gray-50"></td></tr>
                <tr className="bg-gray-50"><td className="px-5 py-2 font-semibold text-gray-700 text-xs uppercase tracking-wide">Operating Expenses</td><td></td></tr>
                {(pnl?.expenses?.breakdown ?? []).length === 0 ? (<tr><td className="px-5 py-3 text-gray-400 italic pl-8">No expenses</td><td className="px-5 py-3 text-right text-gray-400">0</td></tr>) : (pnl?.expenses?.breakdown ?? []).map((e: any, i: number) => (<tr key={i}><td className="px-5 py-2 text-gray-600 pl-8">• {e.category}</td><td className="px-5 py-2 text-right text-red-500">({Number(e.amount).toLocaleString()})</td></tr>))}
                <tr className="border-t"><td className="px-5 py-3 font-semibold text-gray-700 pl-8">Total Expenses</td><td className="px-5 py-3 text-right font-semibold text-red-600">({totalExp.toLocaleString()})</td></tr>
                <tr className={`border-t-2 ${isProfit ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}><td className={`px-5 py-4 font-bold text-lg ${isProfit ? "text-emerald-800" : "text-red-800"}`}>Net {isProfit ? "Profit" : "Loss"}</td><td className={`px-5 py-4 text-right font-bold text-lg ${isProfit ? "text-emerald-700" : "text-red-700"}`}>{isProfit ? "" : "-"}৳{Math.abs(netProfit).toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
