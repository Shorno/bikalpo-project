"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CreditCard, DollarSign, History, Loader2, Wallet, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

export default function WarehousePayablePage() {
  const queryClient = useQueryClient();
  const [payingSupplierId, setPayingSupplierId] = useState<number | null>(null);
  const [payingSupplierName, setPayingSupplierName] = useState("");
  const [viewLedgerId, setViewLedgerId] = useState<number | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "cash" as "cash" | "bank" | "mobile_banking", referenceNo: "", note: "" });

  const { data: summary, isLoading } = useQuery(orpc.supplierPayment.getPayableSummary.queryOptions({}));
  const { data: ledgerEntries } = useQuery({
    ...orpc.supplierPayment.getSupplierLedger.queryOptions({ input: { supplierId: viewLedgerId! } }),
    enabled: viewLedgerId !== null,
  });

  const payMutation = useMutation(
    orpc.supplierPayment.paySupplier.mutationOptions({
      onSuccess: (r) => { toast.success(r.message); queryClient.invalidateQueries({ queryKey: orpc.supplierPayment.getPayableSummary.key() }); setPayingSupplierId(null); setPayForm({ amount: "", paymentMethod: "cash", referenceNo: "", note: "" }); },
      onError: (err) => toast.error(err.message),
    }),
  );

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.amount || payingSupplierId === null) return;
    payMutation.mutate({ supplierId: payingSupplierId, amount: payForm.amount, paymentMethod: payForm.paymentMethod, referenceNo: payForm.referenceNo || undefined, note: payForm.note || undefined, ownerType: "warehouse" });
  };

  const suppliers = summary?.suppliers ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Wallet className="w-6 h-6 text-orange-500" /> Supplier Payable</h1>
        <p className="text-sm text-gray-500 mt-1">Outstanding credit balances with suppliers.</p>
      </div>
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5">
        <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Total Outstanding</p>
        <p className="text-2xl font-bold text-orange-700 mt-1">৳{Number(summary?.totalPayable ?? "0").toLocaleString()}</p>
      </div>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (<div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
        ) : suppliers.length === 0 ? (
          <div className="p-12 text-center"><DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-sm text-gray-500">No outstanding payables</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600 text-left"><tr><th className="px-4 py-3 font-medium">Supplier</th><th className="px-4 py-3 font-medium text-right">Credit Limit</th><th className="px-4 py-3 font-medium text-right">Outstanding</th><th className="px-4 py-3 font-medium text-center">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {suppliers.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-right text-gray-600">৳{Number(s.creditLimit).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-orange-600">৳{Number(s.currentPayable).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setPayingSupplierId(s.id); setPayingSupplierName(s.name); }} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">Pay</button>
                      <button onClick={() => setViewLedgerId(viewLedgerId === s.id ? null : s.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"><History size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {viewLedgerId && ledgerEntries && (ledgerEntries as any[]).length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-700">Payment History</h3><button onClick={() => setViewLedgerId(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button></div>
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b text-gray-500 text-left"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-4 py-2 font-medium">Description</th><th className="px-4 py-2 font-medium text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-gray-100">{(ledgerEntries as any[]).map((e: any) => (<tr key={e.id} className="hover:bg-gray-50"><td className="px-4 py-2 text-gray-600">{new Date(e.createdAt).toLocaleDateString()}</td><td className="px-4 py-2 text-gray-700">{e.description}</td><td className="px-4 py-2 text-right font-medium text-green-600">৳{Number(e.amount).toLocaleString()}</td></tr>))}</tbody>
          </table>
        </div>
      )}
      {payingSupplierId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CreditCard size={20} className="text-blue-600" />Pay: {payingSupplierName}</h2><button onClick={() => setPayingSupplierId(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button></div>
            <form onSubmit={handlePay} className="p-5 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount (৳) *</label><input type="number" step="0.01" min="0" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label><select value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value as any })} className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="mobile_banking">Mobile Banking</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Reference No (Optional)</label><input type="text" value={payForm.referenceNo} onChange={(e) => setPayForm({ ...payForm, referenceNo: e.target.value })} className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200"><AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" /><p className="text-xs text-amber-700">This will reduce supplier outstanding and cash/bank balance.</p></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setPayingSupplierId(null)} className="flex-1 px-4 py-2.5 text-sm font-medium border rounded-lg hover:bg-gray-50">Cancel</button><button type="submit" disabled={payMutation.isPending} className="flex-1 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">{payMutation.isPending && <Loader2 size={14} className="animate-spin" />}Pay</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
