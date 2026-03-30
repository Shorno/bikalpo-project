"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Loader2, Phone, Plus, Trash2, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

export default function WarehousePayeesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "", contactPerson: "", phone: "", email: "", address: "", notes: "",
  });

  const { data: payees, isLoading } = useQuery(
    orpc.payee.getAll.queryOptions({ input: { search: search || undefined } }),
  );

  const createMutation = useMutation(
    orpc.payee.create.mutationOptions({
      onSuccess: (r) => { toast.success(r.message); queryClient.invalidateQueries({ queryKey: orpc.payee.getAll.key() }); resetForm(); },
      onError: (err) => toast.error(err.message),
    }),
  );

  const updateMutation = useMutation(
    orpc.payee.update.mutationOptions({
      onSuccess: (r) => { toast.success(r.message); queryClient.invalidateQueries({ queryKey: orpc.payee.getAll.key() }); resetForm(); },
      onError: (err) => toast.error(err.message),
    }),
  );

  const deleteMutation = useMutation(
    orpc.payee.delete.mutationOptions({
      onSuccess: (r) => { toast.success(r.message); queryClient.invalidateQueries({ queryKey: orpc.payee.getAll.key() }); },
      onError: (err) => toast.error(err.message),
    }),
  );

  const resetForm = () => { setForm({ name: "", contactPerson: "", phone: "", email: "", address: "", notes: "" }); setShowForm(false); setEditingId(null); };

  const handleEdit = (p: any) => {
    setForm({ name: p.name, contactPerson: p.contactPerson || "", phone: p.phone, email: p.email || "", address: p.address || "", notes: p.notes || "" });
    setEditingId(p.id); setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) { toast.error("Name and phone are required"); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, name: form.name, contactPerson: form.contactPerson || undefined, phone: form.phone, email: form.email || undefined, address: form.address || undefined, notes: form.notes || undefined });
    } else {
      createMutation.mutate({ name: form.name, contactPerson: form.contactPerson || undefined, phone: form.phone, email: form.email || undefined, address: form.address || undefined, notes: form.notes || undefined });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" /> Payee Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage payees — landlords, service providers, and other payment recipients.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
          <Plus size={16} /> Add Payee
        </button>
      </div>

      <div className="relative max-w-xs">
        <input type="text" placeholder="Search payees..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-3 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
        ) : (payees ?? []).length === 0 ? (
          <div className="p-12 text-center"><Users className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-sm text-gray-500">No payees added yet</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact Person</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(payees ?? []).map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.contactPerson || "—"}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-1 text-gray-600"><Phone size={12} className="text-gray-400" />{p.phone}</span></td>
                  <td className="px-4 py-3 text-gray-600">{p.email || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"><Edit2 size={14} /></button>
                      <button onClick={() => { if (confirm(`Deactivate "${p.name}"?`)) deleteMutation.mutate({ id: p.id }); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? "Edit Payee" : "Add Payee"}</h2>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Payee Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. City Electric Company"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX"
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Address / Location</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
                  {editingId ? "Update Payee" : "Add Payee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
