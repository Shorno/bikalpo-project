"use client";

import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  FlagIcon,
  Loader2Icon,
  MapPinIcon,
  PackageIcon,
  PlusCircleIcon,
  ShieldCheckIcon,
  TruckIcon,
  UserIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

type TabId = "pending" | "internal" | "active" | "approval";

interface InvoiceCard {
  id: number;
  invoiceNumber: string;
  fulfillmentMode?: string | null;
  grandTotal: string;
  customer?: {
    id: string;
    name: string;
    phoneNumber: string | null;
    shopName: string | null;
  } | null;
  order?: {
    id: number;
    orderNumber: string;
    shippingName?: string | null;
    shippingPhone?: string | null;
    shippingAddress: string;
    shippingCity: string;
    shippingArea: string;
  } | null;
  items?: Array<{
    id: number;
    productName: string;
    productSku: string | null;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
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
  reconciliation?: {
    expectedTotal: number;
    totalCollected: number;
    difference: number;
    isBalanced: boolean;
  };
}

export default function DeliveryManagementPage() {
  const [activeTab, setActiveTab] = useState<TabId>("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [pendingDeliveryInvoices, setPendingDeliveryInvoices] = useState<InvoiceCard[]>([]);
  const [internalInvoices, setInternalInvoices] = useState<InvoiceCard[]>([]);
  const [activeGroups, setActiveGroups] = useState<DeliveryGroup[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<DeliveryGroup[]>([]);

  const [expandedInvoice, setExpandedInvoice] = useState<number | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [selectedPendingInvoices, setSelectedPendingInvoices] = useState<number[]>([]);
  const [selectedInternalInvoices, setSelectedInternalInvoices] = useState<number[]>([]);
  const [approvalNote, setApprovalNote] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deliverymen, setDeliverymen] = useState<Deliveryman[]>([]);
  const [groupName, setGroupName] = useState("");
  const [selectedDeliveryman, setSelectedDeliveryman] = useState("");
  const [vehicleType, setVehicleType] = useState("bike");

  const apiBase = process.env.NEXT_PUBLIC_AUTH_URL || "";

  const apiFetch = useCallback(
    async (path: string, opts?: RequestInit) => {
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
    },
    [apiBase],
  );

  const fetchPendingDeliveryInvoices = useCallback(async () => {
    const data = await apiFetch("/warehouse/delivery-management/dashboard");
    setPendingDeliveryInvoices(data.pendingDeliveryInvoices || []);
  }, [apiFetch]);

  const fetchInternalInvoices = useCallback(async () => {
    const data = await apiFetch("/delivery/invoices/unassigned");
    setInternalInvoices(data.invoices || []);
  }, [apiFetch]);

  const fetchActiveGroups = useCallback(async () => {
    const data = await apiFetch("/delivery-groups/list");
    setActiveGroups(
      (data.groups || []).filter((group: DeliveryGroup) =>
        ["assigned", "out_for_delivery"].includes(group.status),
      ),
    );
  }, [apiFetch]);

  const fetchPendingApprovals = useCallback(async () => {
    const data = await apiFetch("/delivery/pending-approvals");
    setPendingApprovals(data.groups || []);
  }, [apiFetch]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchPendingDeliveryInvoices(),
        fetchInternalInvoices(),
        fetchActiveGroups(),
        fetchPendingApprovals(),
      ]);
    } catch (error) {
      console.error("Delivery management load failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load delivery data");
    } finally {
      setLoading(false);
    }
  }, [
    fetchActiveGroups,
    fetchInternalInvoices,
    fetchPendingApprovals,
    fetchPendingDeliveryInvoices,
  ]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([
      fetchPendingDeliveryInvoices(),
      fetchInternalInvoices(),
      fetchActiveGroups(),
      fetchPendingApprovals(),
    ]);
  }, [
    fetchActiveGroups,
    fetchInternalInvoices,
    fetchPendingApprovals,
    fetchPendingDeliveryInvoices,
  ]);

  const fetchDeliverymen = async () => {
    const data = await apiFetch("/delivery/for-assignment");
    setDeliverymen(data.deliverymen || []);
  };

  const toggleSelection = (
    id: number,
    _selectedIds: number[],
    setSelectedIds: Dispatch<SetStateAction<number[]>>,
  ) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleMoveToInternalQueue = async () => {
    if (selectedPendingInvoices.length === 0) {
      toast.error("Select at least one invoice");
      return;
    }

    setActionLoading("move-internal");
    try {
      const result = await apiFetch("/warehouse/delivery-management/select-type", {
        method: "POST",
        body: JSON.stringify({
          invoiceIds: selectedPendingInvoices,
          deliveryType: "internal_delivery",
        }),
      });

      toast.success(result.message || "Invoices moved to internal delivery");
      setSelectedPendingInvoices([]);
      setActiveTab("internal");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move invoices");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Enter a group name");
      return;
    }
    if (selectedInternalInvoices.length === 0) {
      toast.error("Select at least one invoice");
      return;
    }
    if (!selectedDeliveryman) {
      toast.error("Select a deliveryman");
      return;
    }

    setActionLoading("create-group");
    try {
      await apiFetch("/delivery-groups/create", {
        method: "POST",
        body: JSON.stringify({
          groupName: groupName.trim(),
          invoiceIds: selectedInternalInvoices,
          deliverymanId: selectedDeliveryman,
          vehicleType,
        }),
      });

      toast.success("Internal delivery group created");
      setShowCreateModal(false);
      setGroupName("");
      setSelectedDeliveryman("");
      setSelectedInternalInvoices([]);
      await refreshAll();
      setActiveTab("active");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create delivery group");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (groupId: number) => {
    setActionLoading(`approve-${groupId}`);
    try {
      await apiFetch(`/delivery-groups/${groupId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          groupId,
          cashReceived: true,
          packReceived: true,
          supervisorNote: approvalNote || undefined,
        }),
      });

      toast.success("Delivery group approved and settled");
      setApprovalNote("");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approval failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleFlag = async (groupId: number) => {
    if (!approvalNote.trim()) {
      toast.error("Enter a note before flagging");
      return;
    }

    setActionLoading(`flag-${groupId}`);
    try {
      await apiFetch(`/delivery-groups/${groupId}/flag`, {
        method: "POST",
        body: JSON.stringify({
          groupId,
          supervisorNote: approvalNote,
        }),
      });

      toast.success("Delivery group flagged for review");
      setApprovalNote("");
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Flag action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const stats = useMemo(
    () => [
      { label: "Pending Delivery", value: pendingDeliveryInvoices.length, tone: "indigo" as const },
      { label: "Internal Queue", value: internalInvoices.length, tone: "sky" as const },
      { label: "Active Groups", value: activeGroups.length, tone: "blue" as const },
      { label: "Approval", value: pendingApprovals.length, tone: "amber" as const },
    ],
    [activeGroups.length, internalInvoices.length, pendingApprovals.length, pendingDeliveryInvoices.length],
  );

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "pending", label: "Pending Delivery", count: pendingDeliveryInvoices.length || undefined },
    { id: "internal", label: "Internal Queue", count: internalInvoices.length || undefined },
    { id: "active", label: "Active", count: activeGroups.length || undefined },
    { id: "approval", label: "Approval", count: pendingApprovals.length || undefined },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Delivery Management</h1>
        <p className="text-sm text-gray-500">
          Delivery invoices move here after dispatch. Choose the delivery type, then
          continue with the internal delivery queue and settlement flow.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <KpiCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        This page follows the delivery-management step from your doc: dispatch hands
        invoices over here, then internal delivery continues through queue, active
        route, and approval.
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  activeTab === tab.id
                    ? "bg-white/15 text-white"
                    : "bg-white text-gray-700"
                }`}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2Icon className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {activeTab === "pending" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                Select one or more pending delivery invoices, then choose the final delivery type.
                Internal Delivery is available now. Third Party stays visible for the next phase.
              </div>

              {pendingDeliveryInvoices.length === 0 ? (
                <EmptyState
                  icon={<PackageIcon className="h-10 w-10 text-indigo-300" />}
                  title="No invoices waiting for delivery management"
                  subtitle="Invoices marked as Delivery from Dispatch Orders will appear here."
                />
              ) : (
                <>
                  <div className="flex items-center justify-between px-1 text-sm text-gray-500">
                    <span>{pendingDeliveryInvoices.length} invoices waiting for delivery selection</span>
                    <button
                      onClick={() => {
                        if (selectedPendingInvoices.length === pendingDeliveryInvoices.length) {
                          setSelectedPendingInvoices([]);
                        } else {
                          setSelectedPendingInvoices(pendingDeliveryInvoices.map((invoice) => invoice.id));
                        }
                      }}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {selectedPendingInvoices.length === pendingDeliveryInvoices.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  {pendingDeliveryInvoices.map((invoice) => {
                    const expanded = expandedInvoice === invoice.id;
                    const selected = selectedPendingInvoices.includes(invoice.id);

                    return (
                      <div
                        key={invoice.id}
                        className={`overflow-hidden rounded-xl border bg-white transition-colors ${
                          selected ? "border-indigo-500 ring-1 ring-indigo-200" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 p-4">
                          <button
                            onClick={() => toggleSelection(invoice.id, selectedPendingInvoices, setSelectedPendingInvoices)}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                              selected
                                ? "border-indigo-600 bg-indigo-600 text-white"
                                : "border-gray-300 text-transparent hover:border-gray-400"
                            }`}
                          >
                            <CheckCircle2Icon className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => setExpandedInvoice(expanded ? null : invoice.id)}
                            className="flex flex-1 items-center justify-between gap-3 text-left"
                          >
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {invoice.customer?.shopName || invoice.customer?.name || invoice.invoiceNumber}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-500">
                                {invoice.invoiceNumber} - {invoice.order?.orderNumber}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-gray-900">
                                Tk {Number(invoice.grandTotal || 0).toLocaleString()}
                              </span>
                              {expanded ? (
                                <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                          </button>
                        </div>

                        {expanded && (
                          <div className="border-t bg-gray-50/70 p-4">
                            <InvoiceMeta invoice={invoice} />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="rounded-xl border bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-gray-900">
                      Selected Invoice: {selectedPendingInvoices.length}
                    </p>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm font-semibold text-emerald-800">Internal Delivery</p>
                        <p className="mt-1 text-sm text-emerald-700">
                          Move the selected invoices into the internal delivery queue for rider grouping.
                        </p>
                        <button
                          onClick={() => void handleMoveToInternalQueue()}
                          disabled={actionLoading === "move-internal" || selectedPendingInvoices.length === 0}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {actionLoading === "move-internal" ? (
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                          ) : (
                            <TruckIcon className="h-4 w-4" />
                          )}
                          Move to Internal Queue
                        </button>
                      </div>

                      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                        <p className="text-sm font-semibold text-gray-700">Third Party Delivery</p>
                        <p className="mt-1 text-sm text-gray-500">
                          This option is intentionally held for the next implementation phase.
                        </p>
                        <button
                          type="button"
                          disabled
                          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-400"
                        >
                          <AlertCircleIcon className="h-4 w-4" />
                          Coming Soon
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "internal" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                These invoices are ready for rider assignment. Select one or more, then create a delivery group.
              </div>

              {selectedInternalInvoices.length > 0 ? (
                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    void fetchDeliverymen();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  <PlusCircleIcon className="h-4 w-4" />
                  Create Group ({selectedInternalInvoices.length})
                </button>
              ) : null}

              {internalInvoices.length === 0 ? (
                <EmptyState
                  icon={<TruckIcon className="h-10 w-10 text-blue-300" />}
                  title="No internal-delivery invoices waiting"
                  subtitle="Invoices moved to internal delivery will appear here until a rider group is created."
                />
              ) : (
                <>
                  <div className="flex items-center justify-between px-1 text-sm text-gray-500">
                    <span>{internalInvoices.length} invoices waiting for rider assignment</span>
                    <button
                      onClick={() => {
                        if (selectedInternalInvoices.length === internalInvoices.length) {
                          setSelectedInternalInvoices([]);
                        } else {
                          setSelectedInternalInvoices(internalInvoices.map((invoice) => invoice.id));
                        }
                      }}
                      className="font-medium text-emerald-600 hover:underline"
                    >
                      {selectedInternalInvoices.length === internalInvoices.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  {internalInvoices.map((invoice) => {
                    const expanded = expandedInvoice === invoice.id;
                    const selected = selectedInternalInvoices.includes(invoice.id);

                    return (
                      <div
                        key={invoice.id}
                        className={`overflow-hidden rounded-xl border bg-white transition-colors ${
                          selected ? "border-emerald-500 ring-1 ring-emerald-200" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3 p-4">
                          <button
                            onClick={() => toggleSelection(invoice.id, selectedInternalInvoices, setSelectedInternalInvoices)}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                              selected
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-gray-300 text-transparent hover:border-gray-400"
                            }`}
                          >
                            <CheckCircle2Icon className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => setExpandedInvoice(expanded ? null : invoice.id)}
                            className="flex flex-1 items-center justify-between gap-3 text-left"
                          >
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {invoice.customer?.shopName || invoice.customer?.name || invoice.invoiceNumber}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-500">
                                {invoice.invoiceNumber} - {invoice.order?.shippingArea || "Area pending"}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-gray-900">
                                Tk {Number(invoice.grandTotal || 0).toLocaleString()}
                              </span>
                              {expanded ? (
                                <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                          </button>
                        </div>

                        {expanded && (
                          <div className="border-t bg-gray-50/70 p-4">
                            <InvoiceMeta invoice={invoice} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {activeTab === "active" && (
            <div className="space-y-3">
              {activeGroups.length === 0 ? (
                <EmptyState
                  icon={<TruckIcon className="h-10 w-10 text-gray-300" />}
                  title="No active delivery groups"
                  subtitle="Assigned and in-progress internal delivery groups will appear here."
                />
              ) : (
                activeGroups.map((group) => (
                  <div key={group.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                    <button
                      onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            group.status === "out_for_delivery" ? "bg-amber-50" : "bg-blue-50"
                          }`}
                        >
                          <TruckIcon
                            className={`h-5 w-5 ${
                              group.status === "out_for_delivery"
                                ? "text-amber-500"
                                : "text-blue-500"
                            }`}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{group.groupName}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {group.deliveryman?.name || "Unassigned"} - {group.completedInvoices}/
                            {group.totalInvoices} done
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                            group.status === "out_for_delivery"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-blue-50 text-blue-600"
                          }`}
                        >
                          {group.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                        {expandedGroup === group.id ? (
                          <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {expandedGroup === group.id && (
                      <div className="border-t">
                        <div className="px-4 py-3">
                          <div className="mb-1 flex justify-between text-xs text-gray-500">
                            <span>Progress</span>
                            <span>
                              {group.totalInvoices > 0
                                ? Math.round((group.completedInvoices / group.totalInvoices) * 100)
                                : 0}
                              %
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100">
                            <div
                              className="h-2 rounded-full bg-emerald-500 transition-all"
                              style={{
                                width: `${
                                  group.totalInvoices > 0
                                    ? (group.completedInvoices / group.totalInvoices) * 100
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="divide-y">
                          {group.invoices.map((deliveryInvoice: any) => (
                            <div key={deliveryInvoice.id} className="flex items-center justify-between px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {deliveryInvoice.invoice?.customer?.shopName ||
                                    deliveryInvoice.invoice?.customer?.name ||
                                    deliveryInvoice.invoice?.invoiceNumber}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Tk {Number(deliveryInvoice.invoice?.grandTotal || 0).toLocaleString()}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  deliveryInvoice.status === "delivered"
                                    ? "bg-emerald-50 text-emerald-600"
                                    : deliveryInvoice.status === "failed"
                                      ? "bg-red-50 text-red-600"
                                      : "bg-amber-50 text-amber-600"
                                }`}
                              >
                                {deliveryInvoice.status.toUpperCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "approval" && (
            <div className="space-y-3">
              {pendingApprovals.length === 0 ? (
                <EmptyState
                  icon={<ShieldCheckIcon className="h-10 w-10 text-gray-300" />}
                  title="No groups pending approval"
                  subtitle="Completed rider groups will appear here for cash and pack settlement."
                />
              ) : (
                pendingApprovals.map((group) => {
                  const totalCash = Number(group.totalCashCollected || 0);
                  const totalDigital = Number(group.totalDigitalCollected || 0);
                  const totalCollected = totalCash + totalDigital;
                  const expected =
                    group.reconciliation?.expectedTotal || Number(group.expectedTotal || 0);
                  const difference = expected - totalCollected;
                  const isBalanced = Math.abs(difference) < 0.01;

                  return (
                    <div key={group.id} className="rounded-xl border bg-white p-4 shadow-sm">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{group.groupName}</p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {group.deliveryman?.name} - Completed{" "}
                              {group.completedAt
                                ? new Date(group.completedAt).toLocaleDateString()
                                : "today"}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                              group.status === "completed"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-orange-50 text-orange-600"
                            }`}
                          >
                            {group.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <StatCard
                            tone="emerald"
                            label="Delivered"
                            value={group.invoices.filter((item: any) => item.status === "delivered").length}
                          />
                          <StatCard
                            tone="red"
                            label="Failed"
                            value={group.invoices.filter((item: any) => item.status === "failed").length}
                          />
                          <StatCard
                            tone={isBalanced ? "emerald" : "amber"}
                            label={isBalanced ? "Balanced" : "Difference"}
                            value={isBalanced ? "OK" : `Tk ${Math.abs(difference).toFixed(0)}`}
                          />
                        </div>

                        <div className="space-y-1.5 rounded-lg bg-gray-50 p-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Expected</span>
                            <span className="font-medium">Tk {expected.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Cash</span>
                            <span className="font-medium text-emerald-700">Tk {totalCash.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Digital</span>
                            <span className="font-medium text-blue-700">Tk {totalDigital.toLocaleString()}</span>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={approvalNote}
                          onChange={(event) => setApprovalNote(event.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          placeholder="Supervisor note (optional)..."
                        />

                        <div className="flex gap-2">
                          <button
                            onClick={() => void handleApprove(group.id)}
                            disabled={!!actionLoading}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {actionLoading === `approve-${group.id}` ? (
                              <Loader2Icon className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldCheckIcon className="h-4 w-4" />
                            )}
                            Approve and Close
                          </button>

                          <button
                            onClick={() => void handleFlag(group.id)}
                            disabled={!!actionLoading}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-60"
                          >
                            {actionLoading === `flag-${group.id}` ? (
                              <Loader2Icon className="h-4 w-4 animate-spin" />
                            ) : (
                              <FlagIcon className="h-4 w-4" />
                            )}
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

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Create Internal Delivery Group</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="e.g. Area-01 Morning Route"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Vehicle Type</label>
              <div className="grid grid-cols-4 gap-2">
                {["bike", "car", "van", "truck"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setVehicleType(type)}
                    className={`rounded-lg border py-2 text-xs font-medium capitalize transition-colors ${
                      vehicleType === type
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Assign Deliveryman ({deliverymen.length} available)
              </label>
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {deliverymen.map((deliveryman) => (
                  <button
                    key={deliveryman.id}
                    onClick={() => setSelectedDeliveryman(deliveryman.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selectedDeliveryman === deliveryman.id
                        ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        deliveryman.hasActiveGroup ? "bg-amber-100" : "bg-emerald-100"
                      }`}
                    >
                      <UserIcon
                        className={`h-4 w-4 ${
                          deliveryman.hasActiveGroup ? "text-amber-600" : "text-emerald-600"
                        }`}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{deliveryman.name}</p>
                      <p className="text-xs text-gray-500">
                        {deliveryman.phoneNumber || deliveryman.email}
                        {deliveryman.hasActiveGroup ? (
                          <span className="ml-1 text-amber-600"> - Busy</span>
                        ) : null}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Selected Invoices</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {selectedInternalInvoices.length} invoices - Tk{" "}
                {internalInvoices
                  .filter((invoice) => selectedInternalInvoices.includes(invoice.id))
                  .reduce((sum, invoice) => sum + Number(invoice.grandTotal || 0), 0)
                  .toLocaleString()}
              </p>
            </div>

            <button
              onClick={() => void handleCreateGroup()}
              disabled={actionLoading === "create-group"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {actionLoading === "create-group" ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <PlusCircleIcon className="h-5 w-5" />
              )}
              Create Group and Assign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceMeta({ invoice }: { invoice: InvoiceCard }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 text-xs text-gray-600">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Customer
          </p>
          <div className="flex items-center gap-2">
            <UserIcon className="h-3.5 w-3.5 text-gray-400" />
            <span>{invoice.customer?.name || "N/A"}</span>
          </div>
          {invoice.customer?.phoneNumber ? (
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-500">Phone</span>
              <span>{invoice.customer.phoneNumber}</span>
            </div>
          ) : null}
          {invoice.customer?.shopName ? (
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-500">Shop</span>
              <span>{invoice.customer.shopName}</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5 text-xs text-gray-600">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Shipping
          </p>
          {invoice.order?.shippingName ? (
            <div className="flex items-center gap-2">
              <UserIcon className="h-3.5 w-3.5 text-gray-400" />
              <span>{invoice.order.shippingName}</span>
            </div>
          ) : null}
          {invoice.order?.shippingPhone ? (
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-500">Phone</span>
              <span>{invoice.order.shippingPhone}</span>
            </div>
          ) : null}
          <div className="flex items-start gap-2">
            <MapPinIcon className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
            <span>
              {invoice.order?.shippingAddress}
              {invoice.order?.shippingArea ? `, ${invoice.order.shippingArea}` : ""}
              {invoice.order?.shippingCity ? `, ${invoice.order.shippingCity}` : ""}
            </span>
          </div>
        </div>
      </div>

      {invoice.items?.length ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Invoice Items
          </p>
          <div className="space-y-1.5">
            {invoice.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-white p-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{item.productName}</p>
                  {item.productSku ? (
                    <p className="text-xs text-gray-400">{item.productSku}</p>
                  ) : null}
                </div>
                <div className="text-right text-xs text-gray-600">
                  <p>
                    {item.quantity} x Tk {Number(item.unitPrice || 0).toLocaleString()}
                  </p>
                  <p className="font-semibold text-gray-900">
                    Tk {Number(item.lineTotal || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-12 text-center">
      <div className="mb-3 flex justify-center">{icon}</div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "emerald" | "red" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "red"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700";

  return (
    <div className={`rounded-lg p-2 text-center ${toneClass}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px]">{label}</p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "indigo" | "sky" | "blue" | "amber";
}) {
  const toneClass =
    tone === "indigo"
      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
      : tone === "sky"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : tone === "blue"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
