"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PackageIcon,
  PlusCircleIcon,
  Loader2Icon,
  XCircleIcon,
  CameraIcon,
} from "lucide-react";

export default function EmptyPacksPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<number | null>(null); // deliveryGroupInvoiceId
  const [packDescription, setPackDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_AUTH_URL || "";

  const apiFetch = useCallback(async (path: string, opts?: RequestInit) => {
    const res = await fetch(`${apiBase}${path}`, {
      ...opts,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...opts?.headers },
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }, [apiBase]);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await apiFetch("/my-deliveries");
      setGroups(data.groups || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const handleCollectPack = async () => {
    if (!showModal || !packDescription.trim()) return alert("Enter pack description");
    setSubmitLoading(true);
    try {
      await apiFetch("/deliveries/collect-empty-pack", {
        method: "POST",
        body: JSON.stringify({
          deliveryGroupInvoiceId: showModal,
          packDescription: packDescription.trim(),
          quantityCollected: parseInt(quantity) || 1,
          notes: notes || undefined,
        }),
      });
      setShowModal(null);
      setPackDescription("");
      setQuantity("1");
      setNotes("");
      alert("Empty pack recorded!");
      fetchGroups();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2Icon className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  const activeGroups = groups.filter(g =>
    ["out_for_delivery", "assigned", "completed", "partial"].includes(g.status)
  );

  return (
    <div className="p-3 space-y-4">
      <h1 className="text-lg font-bold text-gray-900 px-1">Empty Pack Collection</h1>

      {activeGroups.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <PackageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No active delivery groups.</p>
        </div>
      ) : (
        activeGroups.map(group => (
          <div key={group.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <p className="font-semibold text-sm text-gray-800">{group.groupName}</p>
              <p className="text-xs text-gray-500">{group.invoices.length} stops</p>
            </div>
            <div className="divide-y">
              {group.invoices.filter((inv: any) => inv.status === "delivered").map((inv: any) => (
                <div key={inv.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {inv.invoice.customer?.shopName || inv.invoice.customer?.name || `#${inv.invoice.invoiceNumber}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      Stop #{inv.sequence + 1} • ৳{parseFloat(inv.invoice.grandTotal).toFixed(0)}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(inv.id)}
                    className="flex items-center gap-1 px-3 py-2 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium active:bg-teal-100"
                  >
                    <PlusCircleIcon className="w-4 h-4" />
                    Collect Pack
                  </button>
                </div>
              ))}
              {group.invoices.filter((inv: any) => inv.status === "delivered").length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-gray-400">
                  No delivered stops yet — deliver first to collect packs
                </div>
              )}
            </div>
          </div>
        ))
      )}

      {/* Collect Pack Modal */}
      {showModal !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 space-y-4 animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">Collect Empty Pack</h3>
              <button onClick={() => setShowModal(null)} className="text-gray-400 p-1">
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Pack Type / Description</label>
              <input
                type="text"
                value={packDescription}
                onChange={(e) => setPackDescription(e.target.value)}
                className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                placeholder="e.g., 5L Jar, 1L Bottle, 12kg Drum"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Quantity</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(String(Math.max(1, parseInt(quantity) - 1)))}
                  className="w-10 h-10 rounded-lg border text-lg font-bold flex items-center justify-center active:bg-gray-100"
                >−</button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="flex-1 border rounded-xl px-4 py-3 text-center text-lg font-semibold focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  min="1"
                />
                <button
                  onClick={() => setQuantity(String(parseInt(quantity) + 1))}
                  className="w-10 h-10 rounded-lg border text-lg font-bold flex items-center justify-center active:bg-gray-100"
                >+</button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                placeholder="e.g., Damaged lid, partially dirty"
              />
            </div>

            <button
              onClick={handleCollectPack}
              disabled={submitLoading}
              className="w-full bg-teal-600 text-white rounded-xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2 active:bg-teal-700 disabled:opacity-50"
            >
              {submitLoading ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <PackageIcon className="w-5 h-5" />}
              Record Collection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
