"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PackageSearchIcon,
  TruckIcon,
  Loader2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  MapPinIcon,
  PhoneCallIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ClockIcon,
  RefreshCwIcon,
} from "lucide-react";

export default function DeliveryTrackingPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const apiBase = process.env.NEXT_PUBLIC_AUTH_URL || "";

  const apiFetch = useCallback(async (path: string) => {
    const res = await fetch(`${apiBase}${path}`, { credentials: "include" });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }, [apiBase]);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/delivery-groups/list");
      setGroups(data.groups || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const filteredGroups = groups.filter(g => {
    if (filter === "all") return true;
    return g.status === filter;
  });

  const statusCounts = {
    all: groups.length,
    assigned: groups.filter(g => g.status === "assigned").length,
    out_for_delivery: groups.filter(g => g.status === "out_for_delivery").length,
    completed: groups.filter(g => g.status === "completed").length,
    partial: groups.filter(g => g.status === "partial").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Delivery Tracking</h1>
        <button
          onClick={fetchGroups}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCwIcon className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Status filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "all", label: "All", color: "bg-gray-100 text-gray-700" },
          { id: "assigned", label: "Assigned", color: "bg-blue-50 text-blue-700" },
          { id: "out_for_delivery", label: "On Route", color: "bg-amber-50 text-amber-700" },
          { id: "completed", label: "Completed", color: "bg-emerald-50 text-emerald-700" },
          { id: "partial", label: "Partial", color: "bg-orange-50 text-orange-700" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f.id ? `${f.color} border-current` : "bg-white text-gray-500 border-gray-200"
            }`}
          >
            {f.label} ({statusCounts[f.id as keyof typeof statusCounts] || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2Icon className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <PackageSearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No delivery groups found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map(group => {
            const delivered = group.invoices?.filter((i: any) => i.status === "delivered").length || 0;
            const failed = group.invoices?.filter((i: any) => i.status === "failed").length || 0;
            const pending = group.invoices?.filter((i: any) => i.status === "pending").length || 0;
            const total = group.totalInvoices || group.invoices?.length || 0;
            const progress = total > 0 ? ((delivered + failed) / total) * 100 : 0;

            return (
              <div key={group.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                  className="w-full flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      group.status === "out_for_delivery" ? "bg-amber-50" :
                      group.status === "assigned" ? "bg-blue-50" :
                      group.status === "completed" ? "bg-emerald-50" : "bg-orange-50"
                    }`}>
                      <TruckIcon className={`w-5 h-5 ${
                        group.status === "out_for_delivery" ? "text-amber-500" :
                        group.status === "assigned" ? "text-blue-500" :
                        group.status === "completed" ? "text-emerald-500" : "text-orange-500"
                      }`} />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">{group.groupName}</p>
                      <p className="text-xs text-gray-500">
                        {group.deliveryman?.name || "Unassigned"} •{" "}
                        <span className="text-emerald-600">{delivered}✓</span>{" "}
                        <span className="text-red-500">{failed}✗</span>{" "}
                        <span className="text-amber-500">{pending}⏳</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                      group.status === "out_for_delivery" ? "bg-amber-50 text-amber-600" :
                      group.status === "assigned" ? "bg-blue-50 text-blue-600" :
                      group.status === "completed" ? "bg-emerald-50 text-emerald-600" :
                      "bg-orange-50 text-orange-600"
                    }`}>
                      {group.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                    {expandedGroup === group.id ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {/* Progress bar */}
                {group.status === "out_for_delivery" && (
                  <div className="px-4 pb-2">
                    <div className="bg-gray-100 rounded-full h-1.5">
                      <div className="bg-emerald-500 rounded-full h-1.5 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                {expandedGroup === group.id && (
                  <div className="border-t">
                    {/* Deliveryman info */}
                    <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                          <TruckIcon className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{group.deliveryman?.name || "Not assigned"}</p>
                          <p className="text-xs text-gray-500">{group.deliveryman?.phoneNumber || ""}</p>
                        </div>
                      </div>
                      {group.deliveryman?.phoneNumber && (
                        <a
                          href={`tel:${group.deliveryman.phoneNumber}`}
                          className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center"
                        >
                          <PhoneCallIcon className="w-4 h-4 text-blue-600" />
                        </a>
                      )}
                    </div>

                    {/* Invoice list */}
                    <div className="divide-y">
                      {group.invoices?.map((inv: any) => (
                        <div key={inv.id} className="px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold ${
                              inv.status === "delivered" ? "bg-emerald-100 text-emerald-700" :
                              inv.status === "failed" ? "bg-red-100 text-red-700" :
                              "bg-amber-100 text-amber-700"
                            }`}>
                              {inv.status === "delivered" ? "✓" : inv.status === "failed" ? "✗" : (inv.sequence + 1)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {inv.invoice?.customer?.shopName || inv.invoice?.customer?.name || `#${inv.invoice?.invoiceNumber}`}
                              </p>
                              <p className="text-xs text-gray-500">
                                ৳{parseFloat(inv.invoice?.grandTotal || "0").toFixed(0)}
                                {inv.paymentMethod && ` • ${inv.paymentMethod}`}
                                {inv.deliveredAt && ` • ${new Date(inv.deliveredAt).toLocaleTimeString()}`}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            inv.status === "delivered" ? "bg-emerald-50 text-emerald-600" :
                            inv.status === "failed" ? "bg-red-50 text-red-600" :
                            "bg-amber-50 text-amber-600"
                          }`}>
                            {inv.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Summary footer */}
                    {(group.status === "completed" || group.status === "partial") && (
                      <div className="px-4 py-3 bg-gray-50 border-t grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Cash:</span>{" "}
                          <span className="font-medium">৳{parseFloat(group.totalCashCollected || "0").toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Digital:</span>{" "}
                          <span className="font-medium">৳{parseFloat(group.totalDigitalCollected || "0").toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Expected:</span>{" "}
                          <span className="font-medium">৳{parseFloat(group.expectedTotal || "0").toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Approval:</span>{" "}
                          <span className={`font-medium ${
                            group.supervisorApproval === "approved" ? "text-emerald-600" :
                            group.supervisorApproval === "flagged" ? "text-red-600" : "text-amber-600"
                          }`}>
                            {group.supervisorApproval?.toUpperCase() || "PENDING"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
