"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  CreditCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

type SupplierForm = {
  name: string;
  company: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  creditLimit: string;
  returnPackAgreement: boolean;
};

const emptyForm: SupplierForm = {
  name: "",
  company: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  creditLimit: "0",
  returnPackAgreement: false,
};

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>({ ...emptyForm });

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse", "suppliers", search],
    queryFn: () =>
      orpc.warehouse.getSuppliers.call({ search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (data: SupplierForm) =>
      orpc.warehouse.createSupplier.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "suppliers"] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: SupplierForm & { id: number }) =>
      orpc.warehouse.updateSupplier.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "suppliers"] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => orpc.warehouse.deleteSupplier.call({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "suppliers"] });
    },
  });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (s: any) => {
    setForm({
      name: s.name,
      company: s.company || "",
      contactPerson: s.contactPerson || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      notes: s.notes || "",
      creditLimit: s.creditLimit || "0",
      returnPackAgreement: s.returnPackAgreement ?? false,
    });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ ...form, id: editingId });
    } else {
      createMutation.mutate(form);
    }
  };

  const suppliers = data?.suppliers ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-emerald-600" size={24} />
            Suppliers
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your external suppliers for stock purchases
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Add Supplier
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            {editingId ? "Edit Supplier" : "New Supplier"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Supplier Name *
              </label>
              <input
                required
                placeholder="e.g. Akbar Rice Mill"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Company Name
              </label>
              <input
                placeholder="e.g. Akbar Industries Ltd."
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Contact Person
              </label>
              <input
                placeholder="e.g. Mr. Karim"
                value={form.contactPerson}
                onChange={(e) =>
                  setForm({ ...form, contactPerson: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Phone
              </label>
              <input
                placeholder="e.g. 01712345678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Email
              </label>
              <input
                placeholder="e.g. supplier@company.com"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Credit Limit (৳)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={form.creditLimit}
                onChange={(e) =>
                  setForm({ ...form, creditLimit: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Address
              </label>
              <input
                placeholder="e.g. Khatunganj, Chittagong"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Notes
              </label>
              <textarea
                placeholder="Any internal notes about this supplier..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.returnPackAgreement}
                  onChange={(e) =>
                    setForm({ ...form, returnPackAgreement: e.target.checked })
                  }
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">
                  Return Pack Agreement (supplier accepts empty pack returns)
                </span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50"
            >
              {editingId ? "Update" : "Create"} Supplier
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          placeholder="Search suppliers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Supplier List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Users className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 font-medium">No suppliers yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Add your first supplier to start creating purchases
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {suppliers.map((s: any) => (
            <div
              key={s.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-200 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{s.name}</h3>
                    {s.status === "suspended" && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">
                        SUSPENDED
                      </span>
                    )}
                  </div>
                  {s.company && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                      <Building2 size={12} /> {s.company}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                    {s.contactPerson && (
                      <span className="flex items-center gap-1">
                        <User size={11} /> {s.contactPerson}
                      </span>
                    )}
                    {s.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={11} /> {s.phone}
                      </span>
                    )}
                    {s.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={11} /> {s.email}
                      </span>
                    )}
                    {s.address && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {s.address}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => handleEdit(s)}
                    className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this supplier?"))
                        deleteMutation.mutate(s.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Financial info row */}
              {(parseFloat(s.creditLimit || "0") > 0 ||
                parseFloat(s.currentPayable || "0") > 0 ||
                s.returnPackAgreement) && (
                <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100 text-xs">
                  {parseFloat(s.creditLimit || "0") > 0 && (
                    <span className="flex items-center gap-1 text-gray-500">
                      <CreditCard size={11} />
                      Credit Limit: ৳
                      {parseFloat(s.creditLimit).toLocaleString()}
                    </span>
                  )}
                  {parseFloat(s.currentPayable || "0") > 0 && (
                    <span className="flex items-center gap-1 text-orange-600 font-medium">
                      <AlertCircle size={11} />
                      Due: ৳{parseFloat(s.currentPayable).toLocaleString()}
                    </span>
                  )}
                  {s.returnPackAgreement && (
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                      📦 Pack Return
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
