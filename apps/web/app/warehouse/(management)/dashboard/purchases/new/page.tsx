"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Plus, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

type PurchaseItemRow = {
  variantId: number;
  productName: string;
  quantity: string;
  unitCost: string;
  batchNo: string;
  expiryDate: string;
};

export default function NewPurchasePage() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [transportCost, setTransportCost] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "credit">("cash");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<PurchaseItemRow[]>([
    {
      variantId: 0,
      productName: "",
      quantity: "",
      unitCost: "",
      batchNo: "",
      expiryDate: "",
    },
  ]);
  const [variantSearch, setVariantSearch] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);

  // Fetch suppliers
  const { data: suppliersData } = useQuery({
    queryKey: ["warehouse", "suppliers"],
    queryFn: () => orpc.warehouse.getSuppliers.call({}),
  });

  // Search variants for the dropdown — filtered by supplier's category
  const { data: variantsData } = useQuery({
    queryKey: ["warehouse", "searchVariants", variantSearch, supplierId],
    queryFn: () =>
      orpc.warehouse.searchVariants.call({
        search: variantSearch || undefined,
        supplierId: supplierId ?? undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => orpc.warehouse.createPurchase.call(data),
    onSuccess: () => {
      router.push("/warehouse/dashboard/purchases");
    },
  });

  const suppliers = suppliersData?.suppliers ?? [];
  const variants = variantsData?.variants ?? [];

  const addItem = () => {
    setItems([
      ...items,
      {
        variantId: 0,
        productName: "",
        quantity: "",
        unitCost: "",
        batchNo: "",
        expiryDate: "",
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const selectVariant = (index: number, variant: any) => {
    const updated = [...items];
    updated[index] = {
      variantId: variant.variantId,
      productName: `${variant.productName} — ${variant.unitLabel} (${variant.weightKg}kg)`,
      quantity: "",
      unitCost: variant.price,
      batchNo: updated[index]?.batchNo || "",
      expiryDate: updated[index]?.expiryDate || "",
    };
    setItems(updated);
    setActiveDropdown(null);
    setVariantSearch("");
  };

  const updateItem = (
    index: number,
    field: keyof PurchaseItemRow,
    value: string | number,
  ) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  const subtotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const cost = parseFloat(item.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  const transport = parseFloat(transportCost) || 0;
  const grandTotal = subtotal + transport;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return alert("Please select a supplier");

    const validItems = items.filter(
      (item) =>
        item.variantId > 0 &&
        parseFloat(item.quantity) > 0 &&
        parseFloat(item.unitCost) > 0,
    );

    if (validItems.length === 0)
      return alert("Please add at least one item with a valid product");

    createMutation.mutate({
      supplierId,
      supplierInvoiceNo: supplierInvoiceNo || undefined,
      purchaseDate: purchaseDate || undefined,
      transportCost: transportCost || undefined,
      paymentType,
      note: note || undefined,
      items: validItems,
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/warehouse/dashboard/purchases"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="text-emerald-600" size={24} />
            New Purchase Order
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create a purchase entry from a supplier
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Purchase Info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Purchase Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supplier */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Supplier *
              </label>
              {suppliers.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No suppliers.{" "}
                  <Link
                    href="/warehouse/dashboard/suppliers"
                    className="text-emerald-600 hover:underline"
                  >
                    Add one first
                  </Link>
                </div>
              ) : (
                <select
                  required
                  value={supplierId ?? ""}
                  onChange={(e) => setSupplierId(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Choose supplier --</option>
                  {suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.company ? `(${s.company})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Invoice No */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Supplier Invoice No
              </label>
              <input
                placeholder="e.g. INV-2024-0012"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Purchase Date */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Purchase Date *
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Payment Type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Payment Type
              </label>
              <select
                value={paymentType}
                onChange={(e) =>
                  setPaymentType(e.target.value as "cash" | "credit")
                }
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="cash">💵 Cash</option>
                <option value="credit">📋 Credit (add to payable)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Purchase Items
            </h2>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50"
            >
              <Plus size={14} />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div
                key={index}
                className="border border-gray-100 rounded-lg p-3 bg-gray-50"
              >
                <div className="grid grid-cols-12 gap-2 items-start">
                  {/* Product Variant Picker */}
                  <div className="col-span-5 relative">
                    <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                      Product
                    </label>
                    {item.variantId > 0 ? (
                      <div
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-emerald-50 border-emerald-200 cursor-pointer flex items-center justify-between"
                        onClick={() => {
                          const updated = [...items];
                          updated[index] = {
                            ...updated[index]!,
                            variantId: 0,
                            productName: "",
                          };
                          setItems(updated);
                          setActiveDropdown(index);
                          setVariantSearch("");
                        }}
                      >
                        <span className="truncate text-emerald-800 text-xs font-medium">
                          {item.productName}
                        </span>
                        <ChevronDown
                          size={12}
                          className="text-emerald-400 shrink-0"
                        />
                      </div>
                    ) : (
                      <>
                        <input
                          placeholder="Search product..."
                          value={activeDropdown === index ? variantSearch : ""}
                          onFocus={() => {
                            setActiveDropdown(index);
                            setVariantSearch("");
                          }}
                          onChange={(e) => setVariantSearch(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        {activeDropdown === index && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {variants.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-gray-400">
                                No products found
                              </p>
                            ) : (
                              variants.map((v: any) => (
                                <button
                                  key={v.variantId}
                                  type="button"
                                  onClick={() => selectVariant(index, v)}
                                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm border-b border-gray-50 last:border-0"
                                >
                                  <span className="font-medium text-gray-900">
                                    {v.productName}
                                  </span>
                                  <span className="text-xs text-gray-500 ml-1">
                                    — {v.unitLabel} ({v.weightKg}kg) • ৳
                                    {parseFloat(v.price).toLocaleString()}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Qty */}
                  <div className="col-span-2">
                    <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, "quantity", e.target.value)
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Unit Cost */}
                  <div className="col-span-2">
                    <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                      Unit Cost
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0"
                      value={item.unitCost}
                      onChange={(e) =>
                        updateItem(index, "unitCost", e.target.value)
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Total + Delete */}
                  <div className="col-span-2 text-right pt-6 text-sm font-medium text-gray-700">
                    ৳
                    {(
                      (parseFloat(item.quantity) || 0) *
                      (parseFloat(item.unitCost) || 0)
                    ).toLocaleString()}
                  </div>
                  <div className="col-span-1 flex justify-center pt-5">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Batch + Expiry row */}
                <div className="grid grid-cols-12 gap-2 mt-2">
                  <div className="col-span-5">
                    <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                      Batch No
                    </label>
                    <input
                      placeholder="e.g. B-2024-001"
                      value={item.batchNo}
                      onChange={(e) =>
                        updateItem(index, "batchNo", e.target.value)
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[10px] uppercase text-gray-400 font-semibold mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={item.expiryDate}
                      onChange={(e) =>
                        updateItem(index, "expiryDate", e.target.value)
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-400">Subtotal</span>
              <span className="text-sm text-gray-700">
                ৳{subtotal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Transport Cost</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={transportCost}
                  onChange={(e) => setTransportCost(e.target.value)}
                  className="w-24 px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <span className="text-sm text-gray-700">
                ৳{transport.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-xs text-gray-500 uppercase font-semibold">
                Grand Total
              </span>
              <span className="text-xl font-bold text-gray-900">
                ৳{grandTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Any notes about this purchase..."
            rows={3}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create Purchase Order"}
          </button>
          <Link
            href="/warehouse/dashboard/purchases"
            className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Click-away overlay */}
      {activeDropdown !== null && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </div>
  );
}
