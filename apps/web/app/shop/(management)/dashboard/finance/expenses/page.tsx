"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CreditCard,
  FileText,
  Loader2,
  Plus,
  Receipt,
  Search,
  Trash2,
  TrendingDown,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

type ExpenseCategory = { id: number; name: string; slug: string };

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<number | undefined>();

  // Queries
  const { data: expensesData, isLoading } = useQuery(
    orpc.expense.getExpenses.queryOptions({
      input: { search: search || undefined, categoryId: filterCategoryId, limit: 50 },
    }),
  );

  const { data: categories } = useQuery(
    orpc.expense.getCategories.queryOptions(),
  );

  const { data: payees } = useQuery(
    orpc.payee.getAll.queryOptions({ input: {} }),
  );

  // Add expense form state
  const [form, setForm] = useState({
    title: "",
    categoryId: 0,
    payeeId: null as number | null,
    amount: "",
    paymentMethod: "cash" as "cash" | "bank" | "mobile_banking",
    referenceNo: "",
    note: "",
  });

  const createMutation = useMutation(
    orpc.expense.createExpense.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: orpc.expense.getExpenses.key() });
        setShowAddForm(false);
        setForm({ title: "", categoryId: 0, payeeId: null, amount: "", paymentMethod: "cash", referenceNo: "", note: "" });
      },
      onError: (err) => toast.error(err.message || "Failed to create expense"),
    }),
  );

  const voidMutation = useMutation(
    orpc.expense.voidExpense.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: orpc.expense.getExpenses.key() });
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.amount || form.categoryId === 0) {
      toast.error("Please fill all required fields");
      return;
    }
    createMutation.mutate({
      title: form.title,
      categoryId: form.categoryId,
      payeeId: form.payeeId,
      amount: form.amount,
      paymentMethod: form.paymentMethod,
      referenceNo: form.referenceNo || undefined,
      note: form.note || undefined,
      ownerType: "shop",
    });
  };

  const handleVoid = (id: number, title: string) => {
    const reason = prompt(`Void reason for "${title}":`);
    if (reason) voidMutation.mutate({ id, reason });
  };

  const expenses = expensesData?.expenses ?? [];
  const totalAmount = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingDown className="w-6 h-6 text-red-500" />
            Expenses
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage all your expenses. Every entry is immediately paid.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          Add Expense
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Total Expenses</p>
            <p className="text-2xl font-bold text-red-700 mt-1">৳{totalAmount.toLocaleString()}</p>
          </div>
          <div className="text-xs text-gray-500">
            {expenses.length} entries
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterCategoryId ?? ""}
          onChange={(e) => setFilterCategoryId(e.target.value ? Number(e.target.value) : undefined)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {(categories ?? []).map((c: ExpenseCategory) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No expenses recorded yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Expense #</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map((exp: any) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-gray-400" />
                      {exp.paymentDate}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{exp.expenseNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{exp.title}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                      {exp.category?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-gray-600">
                      <CreditCard size={12} />
                      {exp.paymentMethod === "mobile_banking" ? "Mobile" : exp.paymentMethod}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">
                    ৳{Number(exp.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleVoid(exp.id, exp.title)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                      title="Void expense"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Expense Dialog */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                Add Expense / Bill Payment
              </h2>
              <button onClick={() => setShowAddForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expense Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. March Electricity Bill"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value={0}>Select category</option>
                  {(categories ?? []).map((c: ExpenseCategory) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount + Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (৳) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="mobile_banking">Mobile Banking</option>
                  </select>
                </div>
              </div>

              {/* Payee (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payee (Optional)</label>
                <select
                  value={form.payeeId ?? ""}
                  onChange={(e) => setForm({ ...form, payeeId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No payee</option>
                  {(payees ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Reference No */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference No (Optional)</label>
                <input
                  type="text"
                  value={form.referenceNo}
                  onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
                  placeholder="e.g. TXN-12345"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Additional notes..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Info Banner */}
              <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <AlertCircle size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-700">
                  This expense will be recorded as <strong>Paid</strong> immediately. Cash/Bank balance will be reduced.
                </p>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition"
                >
                  {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
