"use client";

import { useEffect, useState, useCallback } from "react";
import {
  WalletIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  Loader2Icon,
  ArrowRightIcon,
} from "lucide-react";

interface ReconciliationData {
  groupId: number;
  groupName: string;
  status: string;
  supervisorApproval: string;
  deliveries: {
    total: number;
    delivered: number;
    failed: number;
    pending: number;
  };
  payment: {
    expectedTotal: number;
    totalCashCollected: number;
    totalDigitalCollected: number;
    totalCollected: number;
    difference: number;
    isBalanced: boolean;
  };
  emptyPacks: {
    totalCollected: number;
    items: any[];
  };
  timestamps: {
    startedAt: string | null;
    completedAt: string | null;
  };
}

export default function ReconciliationPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconcLoading, setReconcLoading] = useState(false);
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

  const fetchReconciliation = useCallback(async (groupId: number) => {
    try {
      setReconcLoading(true);
      const data = await apiFetch(`/deliveries/${groupId}/reconciliation?groupId=${groupId}`);
      setReconciliation(data);
    } catch (err) {
      console.error(err);
    } finally {
      setReconcLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (selectedGroupId) fetchReconciliation(selectedGroupId);
  }, [selectedGroupId, fetchReconciliation]);

  const handleSubmitPacks = async () => {
    if (!selectedGroupId) return;
    setSubmitLoading(true);
    try {
      await apiFetch(`/deliveries/${selectedGroupId}/submit-packs`, {
        method: "POST",
        body: JSON.stringify({ groupId: selectedGroupId }),
      });
      alert("Packs submitted successfully!");
      fetchReconciliation(selectedGroupId);
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

  // Show completed/partial groups only
  const completedGroups = groups.filter(g =>
    ["completed", "partial", "out_for_delivery"].includes(g.status)
  );

  return (
    <div className="p-3 space-y-4">
      <h1 className="text-lg font-bold text-gray-900 px-1">Reconciliation</h1>

      {/* Group selector */}
      {completedGroups.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center">
          <WalletIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No delivery groups to reconcile.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {completedGroups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                  selectedGroupId === g.id
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {g.groupName}
              </button>
            ))}
          </div>

          {reconcLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2Icon className="w-6 h-6 text-emerald-600 animate-spin" />
            </div>
          )}

          {reconciliation && !reconcLoading && (
            <div className="space-y-3">
              {/* Delivery stats */}
              <div className="bg-white rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Delivery Summary</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 rounded-lg p-2">
                    <p className="text-xl font-bold text-emerald-700">{reconciliation.deliveries.delivered}</p>
                    <p className="text-[10px] text-emerald-600">Delivered</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <p className="text-xl font-bold text-red-700">{reconciliation.deliveries.failed}</p>
                    <p className="text-[10px] text-red-600">Failed</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2">
                    <p className="text-xl font-bold text-amber-700">{reconciliation.deliveries.pending}</p>
                    <p className="text-[10px] text-amber-600">Pending</p>
                  </div>
                </div>
              </div>

              {/* Payment reconciliation */}
              <div className={`rounded-xl p-4 space-y-3 ${
                reconciliation.payment.isBalanced ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"
              }`}>
                <div className="flex items-center gap-2">
                  {reconciliation.payment.isBalanced ? (
                    <CheckCircle2Icon className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangleIcon className="w-5 h-5 text-amber-600" />
                  )}
                  <h3 className="text-sm font-semibold">
                    {reconciliation.payment.isBalanced ? "Payment Balanced ✓" : "Payment Mismatch"}
                  </h3>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expected Total</span>
                    <span className="font-semibold">৳{reconciliation.payment.expectedTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cash Collected</span>
                    <span className="font-medium text-emerald-700">৳{reconciliation.payment.totalCashCollected.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Digital Collected</span>
                    <span className="font-medium text-blue-700">৳{reconciliation.payment.totalDigitalCollected.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total Collected</span>
                    <span>৳{reconciliation.payment.totalCollected.toLocaleString()}</span>
                  </div>
                  {!reconciliation.payment.isBalanced && (
                    <div className="flex justify-between text-amber-700 font-bold">
                      <span>Difference</span>
                      <span>৳{Math.abs(reconciliation.payment.difference).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Empty packs */}
              <div className="bg-white rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Empty Packs ({reconciliation.emptyPacks.totalCollected} collected)
                </h3>
                {reconciliation.emptyPacks.items.length === 0 ? (
                  <p className="text-xs text-gray-400">No packs collected</p>
                ) : (
                  <div className="space-y-2">
                    {reconciliation.emptyPacks.items.map((pack: any) => (
                      <div key={pack.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">{pack.packDescription || `Pack #${pack.id}`}</p>
                          <p className="text-[10px] text-gray-500">Status: {pack.status}</p>
                        </div>
                        <span className="text-sm font-bold text-gray-700">×{pack.quantityCollected}</span>
                      </div>
                    ))}
                  </div>
                )}
                {reconciliation.emptyPacks.totalCollected > 0 && reconciliation.supervisorApproval === "pending" && (
                  <button
                    onClick={handleSubmitPacks}
                    disabled={submitLoading}
                    className="w-full bg-teal-600 text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 active:bg-teal-700 disabled:opacity-50"
                  >
                    {submitLoading ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <ArrowRightIcon className="w-4 h-4" />}
                    Submit Packs to Supervisor
                  </button>
                )}
              </div>

              {/* Approval status */}
              <div className={`rounded-xl p-4 text-center ${
                reconciliation.supervisorApproval === "approved" ? "bg-emerald-100" :
                reconciliation.supervisorApproval === "flagged" ? "bg-red-100" : "bg-gray-100"
              }`}>
                <p className="text-xs font-medium text-gray-500 mb-1">Supervisor Approval</p>
                <p className={`text-lg font-bold ${
                  reconciliation.supervisorApproval === "approved" ? "text-emerald-700" :
                  reconciliation.supervisorApproval === "flagged" ? "text-red-700" : "text-amber-700"
                }`}>
                  {reconciliation.supervisorApproval.toUpperCase()}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
