"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  ClipboardList,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

interface LineItem {
  variantId: number;
  productName: string;
  variantLabel: string;
  quantity: string;
  unitCost: string;
}

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Queries
  const { data: purchases, isLoading } = useQuery(
    orpc.purchase.list.queryOptions({ input: {} }),
  );

  const { data: suppliers } = useQuery(
    orpc.purchase.getSuppliers.queryOptions({ input: {} }),
  );

  const { data: products } = useQuery(
    orpc.purchase.getProducts.queryOptions({
      input: { search: productSearch || undefined },
    }),
  );

  // Form state
  const [form, setForm] = useState({
    supplierId: 0,
    purchaseDate: new Date().toISOString().slice(0, 10),
    supplierInvoiceNo: "",
    paymentType: "cash" as "cash" | "credit",
    transportCost: "",
    discount: "",
    note: "",
  });
  const [items, setItems] = useState<LineItem[]>([]);

  const createMutation = useMutation(
    orpc.purchase.create.mutationOptions({
      onSuccess: (result) => {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: orpc.purchase.list.key() });
        queryClient.invalidateQueries({ queryKey: orpc.supplierPayment.getPayableSummary.key() });
        setShowForm(false);
        resetForm();
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  const resetForm = () => {
    setForm({ supplierId: 0, purchaseDate: new Date().toISOString().slice(0, 10), supplierInvoiceNo: "", paymentType: "cash", transportCost: "", discount: "", note: "" });
    setItems([]);
  };

  const addProduct = (productName: string, variant: any) => {
    // Check if already added
    if (items.some(i => i.variantId === variant.id)) {
      toast.error("This variant is already added");
      return;
    }
    setItems([...items, {
      variantId: variant.id,
      productName,
      variantLabel: `${variant.weightKg}kg ${variant.unitLabel} (${variant.packagingType})`,
      quantity: "1",
      unitCost: variant.price,
    }]);
    setShowProductPicker(false);
    setProductSearch("");
  };

  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: "quantity" | "unitCost", val: string) => {
    const updated = [...items];
    updated[i] = { ...updated[i]!, [field]: val };
    setItems(updated);
  };

  const subtotal = items.reduce((sum, item) => {
    const q = parseFloat(item.quantity) || 0;
    const c = parseFloat(item.unitCost) || 0;
    return sum + q * c;
  }, 0);
  const discount = parseFloat(form.discount) || 0;
  const transport = parseFloat(form.transportCost) || 0;
  const total = subtotal - discount + transport;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.supplierId === 0) { toast.error("Select a supplier"); return; }
    if (items.length === 0) { toast.error("Add at least one product"); return; }

    createMutation.mutate({
      supplierId: form.supplierId,
      purchaseDate: form.purchaseDate,
      supplierInvoiceNo: form.supplierInvoiceNo || undefined,
      paymentType: form.paymentType,
      transportCost: form.transportCost || undefined,
      discount: form.discount || undefined,
      note: form.note || undefined,
      items: items.map(i => ({
        productName: `${i.productName} — ${i.variantLabel}`,
        variantId: i.variantId,
        quantity: i.quantity,
        unitCost: i.unitCost,
      })),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-600" /> Purchases
          </h1>
          <p className="text-sm text-gray-500 mt-1">Record stock purchases from suppliers. Credit purchases create payables.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
          <Plus size={16} /> New Purchase
        </button>
      </div>

      {/* Purchase List */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
        ) : (purchases ?? []).length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No purchases recorded yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Purchase #</th>
                <th className="px-4 py-3 font-medium">Supplier</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(purchases ?? []).map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{p.purchaseNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.supplier?.name}</td>
                  <td className="px-4 py-3 text-gray-600"><div className="flex items-center gap-1"><Calendar size={12} className="text-gray-400" />{p.purchaseDate}</div></td>
                  <td className="px-4 py-3 text-gray-600">{p.items?.length ?? 0} items</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${p.paymentType === "credit" ? "bg-orange-50 text-orange-700" : "bg-green-50 text-green-700"}`}>
                      {p.paymentType === "credit" ? "Credit" : "Cash"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">৳{Number(p.total).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Purchase Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList size={20} className="text-blue-600" /> New Purchase Entry
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Supplier + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                  <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                    <option value={0}>Select supplier</option>
                    {(suppliers ?? []).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}{s.company ? ` (${s.company})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                  <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Payment Type + Invoice */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type *</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setForm({ ...form, paymentType: "cash" })}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg border transition ${form.paymentType === "cash" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                      💵 Cash
                    </button>
                    <button type="button" onClick={() => setForm({ ...form, paymentType: "credit" })}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg border transition ${form.paymentType === "credit" ? "bg-orange-600 text-white border-orange-600" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                      📝 Credit
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Invoice No</label>
                  <input type="text" value={form.supplierInvoiceNo} onChange={(e) => setForm({ ...form, supplierInvoiceNo: e.target.value })}
                    placeholder="Optional" className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {form.paymentType === "credit" && (
                <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <AlertCircle size={14} className="text-orange-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-orange-700">Credit purchase will add to <strong>Outstanding Payable</strong>. Pay later from Finance → Payable.</p>
                </div>
              )}

              {/* Product Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-gray-700">Products *</label>
                  <button type="button" onClick={() => setShowProductPicker(true)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <Plus size={12} /> Add Product
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No products added yet</p>
                    <button type="button" onClick={() => setShowProductPicker(true)}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                      + Select from catalog
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_70px_90px_28px] gap-2 text-xs text-gray-500 font-medium px-1">
                      <span>Product</span><span>Qty</span><span>Cost (৳)</span><span></span>
                    </div>
                    {items.map((item, i) => (
                      <div key={item.variantId} className="grid grid-cols-[1fr_70px_90px_28px] gap-2 items-center bg-gray-50 rounded-lg p-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.variantLabel}</p>
                        </div>
                        <input type="number" step="1" min="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)}
                          className="px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                        <input type="number" step="any" min="0" value={item.unitCost} onChange={(e) => updateItem(i, "unitCost", e.target.value)}
                          className="px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                        <button type="button" onClick={() => removeItem(i)} className="p-1 text-gray-400 hover:text-red-500 rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transport + Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transport Cost (৳)</label>
                  <input type="number" step="any" min="0" value={form.transportCost} onChange={(e) => setForm({ ...form, transportCost: e.target.value })}
                    placeholder="0" className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount (৳)</label>
                  <input type="number" step="any" min="0" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })}
                    placeholder="0" className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2}
                  className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              {/* Totals */}
              {items.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>৳{subtotal.toLocaleString()}</span></div>
                  {discount > 0 && <div className="flex justify-between text-gray-600"><span>Discount</span><span className="text-green-600">-৳{discount.toLocaleString()}</span></div>}
                  {transport > 0 && <div className="flex justify-between text-gray-600"><span>Transport</span><span>+৳{transport.toLocaleString()}</span></div>}
                  <div className="flex justify-between font-bold text-gray-900 border-t pt-1"><span>Total</span><span>৳{total.toLocaleString()}</span></div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button type="submit" disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition">
                  {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Save Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Picker Modal */}
      {showProductPicker && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-base font-bold text-gray-900">Select Product from Catalog</h3>
              <button onClick={() => { setShowProductPicker(false); setProductSearch(""); }} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input type="text" placeholder="Search products..." value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {(products ?? []).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No products found</p>
              ) : (
                (products ?? []).map((prod: any) => (
                  <div key={prod.id} className="border rounded-lg p-3">
                    <p className="text-sm font-semibold text-gray-900 mb-2">{prod.name}</p>
                    {(prod.variants ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400">No variants</p>
                    ) : (
                      <div className="space-y-1">
                        {(prod.variants ?? []).map((v: any) => (
                          <button key={v.id} type="button"
                            onClick={() => addProduct(prod.name, v)}
                            disabled={items.some(i => i.variantId === v.id)}
                            className="w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-lg border hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-40 disabled:cursor-not-allowed">
                            <div>
                              <span className="font-medium text-gray-800">{v.weightKg}kg {v.unitLabel}</span>
                              <span className="text-xs text-gray-500 ml-2">({v.packagingType})</span>
                              {v.sku && <span className="text-xs text-gray-400 ml-2">{v.sku}</span>}
                            </div>
                            <span className="text-sm font-semibold text-blue-600">৳{Number(v.price).toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
