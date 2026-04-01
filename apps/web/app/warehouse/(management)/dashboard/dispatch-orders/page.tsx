"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TruckIcon,
  PlusCircleIcon,
  Loader2Icon,
  CheckCircle2Icon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PackageIcon,
  UserIcon,
  MapPinIcon,
  ClockIcon,
  AlertTriangleIcon,
  EyeIcon,
  ShieldCheckIcon,
  FlagIcon,
} from "lucide-react";

type TabId = "unassigned" | "active" | "approval";

interface UnassignedInvoice {
  id: number;
  invoiceNumber: string;
  grandTotal: string;
  customer?: { id: string; name: string; phoneNumber: string | null; shopName: string | null } | null;
  order?: { id: number; orderNumber: string; shippingAddress: string; shippingCity: string; shippingArea: string } | null;
}

interface Deliveryman {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  serviceArea: string | null;
  hasActiveGroup: boolean;
}

interface DeliveryGroup {
  id: number;
  groupName: string;
  status: string;
  totalInvoices: number;
  completedInvoices: number;
  supervisorApproval: string;
  totalCashCollected: string;
  totalDigitalCollected: string;
  expectedTotal: string;
  completedAt: string | null;
  deliveryman: { id: string; name: string; phoneNumber: string | null } | null;
  invoices: any[];
  reconciliation?: { expectedTotal: number; totalCollected: number; difference: number; isBalanced: boolean };
}

export default function DispatchOrdersPage() {
  const [activeTab, setActiveTab] = useState<TabId>("unassigned");
  const [loading, setLoading] = useState(true);

  // Unassigned tab
  const [unassignedInvoices, setUnassignedInvoices] = useState<UnassignedInvoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<number[]>([]);

  // Create group modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deliverymen, setDeliverymen] = useState<Deliveryman[]>([]);
  const [groupName, setGroupName] = useState("");
  const [selectedDeliveryman, setSelectedDeliveryman] = useState("");
  const [vehicleType, setVehicleType] = useState("bike");
  const [createLoading, setCreateLoading] = useState(false);

  // Active groups
  const [activeGroups, setActiveGroups] = useState<DeliveryGroup[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  // Approval tab
  const [pendingApprovals, setPendingApprovals] = useState<DeliveryGroup[]>([]);
  const [approvalNote, setApprovalNote] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_AUTH_URL || "";

  const apiFetch = useCallback(async (path: string, opts?: RequestInit) => {
    const res = await fetch(`${apiBase}${path}`, {
      ...opts,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...opts?.headers },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || `API error ${res.status}`);
    }
    return res.json();
  }, [apiBase]);

  // Fetch data based on active tab
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "unassigned") {
        const data = await apiFetch("/delivery/invoices/unassigned");
        setUnassignedInvoices(data.invoices || []);
      } else if (activeTab === "active") {
        const data = await apiFetch("/delivery-groups/list");
        setActiveGroups((data.groups || []).filter((g: any) =>
          ["assigned", "out_for_delivery"].includes(g.status)
        ));
      } else if (activeTab === "approval") {
        const data = await apiFetch("/delivery/pending-approvals");
        setPendingApprovals(data.groups || []);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, apiFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch deliverymen for assignment
  const fetchDeliverymen = async () => {
    try {
      const data = await apiFetch("/delivery/for-assignment");
      setDeliverymen(data.deliverymen || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle invoice selection
  const toggleInvoice = (id: number) => {
    setSelectedInvoices(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Create delivery group
  const handleCreateGroup = async () => {
    if (!groupName.trim()) return alert("Enter group name");
    if (selectedInvoices.length === 0) return alert("Select at least one invoice");
    if (!selectedDeliveryman) return alert("Select a deliveryman");

    setCreateLoading(true);
    try {
      await apiFetch("/delivery-groups/create", {
        method: "POST",
        body: JSON.stringify({
          groupName: groupName.trim(),
          invoiceIds: selectedInvoices,
          deliverymanId: selectedDeliveryman,
          vehicleType,
        }),
      });
      setShowCreateModal(false);
      setGroupName("");
      setSelectedInvoices([]);
      setSelectedDeliveryman("");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Approve group
  const handleApprove = async (groupId: number) => {
    setActionLoading(`approve-${groupId}`);
    try {
      await apiFetch(`/delivery-groups/${groupId}/approve`, {
        method: "POST",
        body: JSON.stringify({ groupId, cashReceived: true, packReceived: true, supervisorNote: approvalNote || undefined }),
      });
      setApprovalNote("");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Flag group
  const handleFlag = async (groupId: number) => {
    if (!approvalNote.trim()) return alert("Enter a note for the flag");
    setActionLoading(`flag-${groupId}`);
    try {
      await apiFetch(`/delivery-groups/${groupId}/flag`, {
        method: "POST",
        body: JSON.stringify({ groupId, supervisorNote: approvalNote }),
      });
      setApprovalNote("");
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: "unassigned", label: "Unassigned", icon: PackageIcon },
    { id: "active", label: "Active", icon: TruckIcon },
    { id: "approval", label: "Approval", icon: ShieldCheckIcon },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dispatch Orders</h1>
        {activeTab === "unassigned" && selectedInvoices.length > 0 && (
          <button
            onClick={() => { setShowCreateModal(true); fetchDeliverymen(); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <PlusCircleIcon className="w-4 h-4" />
            Create Group ({selectedInvoices.length})
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2Icon className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* ==================== UNASSIGNED TAB ==================== */}
          {activeTab === "unassigned" && (
            <div className="space-y-2">
              {unassignedInvoices.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                  <CheckCircle2Icon className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">All invoices are assigned!</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm text-gray-500 px-1">
                    <span>{unassignedInvoices.length} invoices waiting</span>
                    <button
                      onClick={() => {
                        if (selectedInvoices.length === unassignedInvoices.length) {
                          setSelectedInvoices([]);
                        } else {
                          setSelectedInvoices(unassignedInvoices.map(i => i.id));
                        }
                      }}
                      className="text-emerald-600 font-medium hover:underline"
                    >
                      {selectedInvoices.length === unassignedInvoices.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  {unassignedInvoices.map(inv => (
                    <div
                      key={inv.id}
                      onClick={() => toggleInvoice(inv.id)}
                      className={`bg-white rounded-lg border p-4 cursor-pointer transition-colors ${
                        selectedInvoices.includes(inv.id) ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-200" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedInvoices.includes(inv.id) ? "bg-emerald-600 border-emerald-600" : "border-gray-300"
                        }`}>
                          {selectedInvoices.includes(inv.id) && <CheckCircle2Icon className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm text-gray-900">
                              {inv.customer?.shopName || inv.customer?.name || `Invoice #${inv.invoiceNumber}`}
                            </p>
                            <span className="font-semibold text-sm text-gray-800">৳{parseFloat(inv.grandTotal).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {inv.order?.shippingArea || ""} {inv.order?.shippingCity ? `• ${inv.order.shippingCity}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ==================== ACTIVE TAB ==================== */}
          {activeTab === "active" && (
            <div className="space-y-3">
              {activeGroups.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                  <TruckIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No active delivery groups.</p>
                </div>
              ) : (
                activeGroups.map(group => (
                  <div key={group.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <button
                      onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                      className="w-full flex items-center justify-between p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          group.status === "out_for_delivery" ? "bg-amber-50" : "bg-blue-50"
                        }`}>
                          <TruckIcon className={`w-5 h-5 ${
                            group.status === "out_for_delivery" ? "text-amber-500" : "text-blue-500"
                          }`} />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-sm">{group.groupName}</p>
                          <p className="text-xs text-gray-500">
                            {group.deliveryman?.name || "Unassigned"} • {group.completedInvoices}/{group.totalInvoices} done
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                          group.status === "out_for_delivery" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                        }`}>
                          {group.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                        {expandedGroup === group.id ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>

                    {expandedGroup === group.id && (
                      <div className="border-t divide-y">
                        {/* Progress bar */}
                        <div className="px-4 py-3">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress</span>
                            <span>{Math.round((group.completedInvoices / group.totalInvoices) * 100)}%</span>
                          </div>
                          <div className="bg-gray-100 rounded-full h-2">
                            <div className="bg-emerald-500 rounded-full h-2 transition-all" style={{ width: `${(group.completedInvoices / group.totalInvoices) * 100}%` }} />
                          </div>
                        </div>

                        {/* Invoice list */}
                        {group.invoices.map((inv: any) => (
                          <div key={inv.id} className="px-4 py-2.5 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {inv.invoice?.customer?.shopName || inv.invoice?.customer?.name || `#${inv.invoice?.invoiceNumber}`}
                              </p>
                              <p className="text-xs text-gray-500">৳{parseFloat(inv.invoice?.grandTotal || "0").toFixed(0)}</p>
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
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ==================== APPROVAL TAB ==================== */}
          {activeTab === "approval" && (
            <div className="space-y-3">
              {pendingApprovals.length === 0 ? (
                <div className="bg-white rounded-lg border p-12 text-center">
                  <ShieldCheckIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No groups pending approval.</p>
                </div>
              ) : (
                pendingApprovals.map(group => {
                  const totalCash = parseFloat(group.totalCashCollected || "0");
                  const totalDigital = parseFloat(group.totalDigitalCollected || "0");
                  const totalCollected = totalCash + totalDigital;
                  const expected = group.reconciliation?.expectedTotal || parseFloat(group.expectedTotal || "0");
                  const diff = expected - totalCollected;
                  const isBalanced = Math.abs(diff) < 0.01;

                  return (
                    <div key={group.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                      <div className="p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">{group.groupName}</p>
                            <p className="text-xs text-gray-500">{group.deliveryman?.name} • Completed {group.completedAt ? new Date(group.completedAt).toLocaleDateString() : ""}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                            group.status === "completed" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                          }`}>
                            {group.status.toUpperCase()}
                          </span>
                        </div>

                        {/* Summary cards */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-emerald-50 rounded-lg p-2">
                            <p className="text-lg font-bold text-emerald-700">{group.invoices.filter((i: any) => i.status === "delivered").length}</p>
                            <p className="text-[10px] text-emerald-600">Delivered</p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-2">
                            <p className="text-lg font-bold text-red-700">{group.invoices.filter((i: any) => i.status === "failed").length}</p>
                            <p className="text-[10px] text-red-600">Failed</p>
                          </div>
                          <div className={`rounded-lg p-2 ${isBalanced ? "bg-emerald-50" : "bg-amber-50"}`}>
                            <p className={`text-lg font-bold ${isBalanced ? "text-emerald-700" : "text-amber-700"}`}>
                              {isBalanced ? "✓" : `৳${Math.abs(diff).toFixed(0)}`}
                            </p>
                            <p className={`text-[10px] ${isBalanced ? "text-emerald-600" : "text-amber-600"}`}>
                              {isBalanced ? "Balanced" : "Difference"}
                            </p>
                          </div>
                        </div>

                        {/* Payment breakdown */}
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Expected</span>
                            <span className="font-medium">৳{expected.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Cash</span>
                            <span className="font-medium text-emerald-700">৳{totalCash.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Digital</span>
                            <span className="font-medium text-blue-700">৳{totalDigital.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Note input */}
                        <input
                          type="text"
                          value={approvalNote}
                          onChange={(e) => setApprovalNote(e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="Supervisor note (optional)..."
                        />

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(group.id)}
                            disabled={!!actionLoading}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === `approve-${group.id}` ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <ShieldCheckIcon className="w-4 h-4" />}
                            Approve & Close
                          </button>
                          <button
                            onClick={() => handleFlag(group.id)}
                            disabled={!!actionLoading}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === `flag-${group.id}` ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <FlagIcon className="w-4 h-4" />}
                            Flag
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* ==================== CREATE GROUP MODAL ==================== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">Create Delivery Group</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder="e.g., Route A - Mohammadpur"
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Vehicle Type</label>
              <div className="grid grid-cols-4 gap-2">
                {["bike", "car", "van", "truck"].map(v => (
                  <button
                    key={v}
                    onClick={() => setVehicleType(v)}
                    className={`py-2 rounded-lg text-xs font-medium border transition-colors capitalize ${
                      vehicleType === v ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700 border-gray-200"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Assign Deliveryman ({deliverymen.length} available)
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {deliverymen.map(dm => (
                  <button
                    key={dm.id}
                    onClick={() => setSelectedDeliveryman(dm.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                      selectedDeliveryman === dm.id ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      dm.hasActiveGroup ? "bg-amber-100" : "bg-emerald-100"
                    }`}>
                      <UserIcon className={`w-4 h-4 ${dm.hasActiveGroup ? "text-amber-600" : "text-emerald-600"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{dm.name}</p>
                      <p className="text-xs text-gray-500">
                        {dm.phoneNumber || dm.email}
                        {dm.hasActiveGroup && <span className="text-amber-600 ml-1">• Busy</span>}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Selected Invoices</p>
              <p className="text-sm font-semibold">{selectedInvoices.length} invoices • ৳{
                unassignedInvoices
                  .filter(i => selectedInvoices.includes(i.id))
                  .reduce((sum, i) => sum + parseFloat(i.grandTotal), 0)
                  .toLocaleString()
              }</p>
            </div>

            <button
              onClick={handleCreateGroup}
              disabled={createLoading}
              className="w-full bg-emerald-600 text-white rounded-lg py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {createLoading ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <PlusCircleIcon className="w-5 h-5" />}
              Create Group & Assign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
