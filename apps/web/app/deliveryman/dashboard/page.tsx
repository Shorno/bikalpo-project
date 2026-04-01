"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PhoneCallIcon,
  NavigationIcon,
  CheckCircle2Icon,
  XCircleIcon,
  PlayCircleIcon,
  PackageIcon,
  MapPinIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Loader2Icon,
  TruckIcon,
  AlertCircleIcon,
} from "lucide-react";

interface DeliveryGroup {
  id: number;
  groupName: string;
  status: string;
  totalInvoices: number;
  completedInvoices: number;
  vehicleType: string | null;
  startedAt: string | null;
  invoices: DeliveryInvoice[];
}

interface DeliveryInvoice {
  id: number;
  invoiceId: number;
  sequence: number;
  status: string;
  deliveryOtp: string | null;
  deliveredAt: string | null;
  failedReason: string | null;
  amountCollected: string;
  paymentMethod: string | null;
  invoice: {
    id: number;
    invoiceNumber: string;
    grandTotal: string;
    order?: {
      id: number;
      orderNumber: string;
      shippingName: string;
      shippingPhone: string;
      shippingAddress: string;
      shippingCity: string;
      shippingArea: string;
    } | null;
    customer?: {
      id: string;
      name: string;
      phoneNumber: string | null;
      shopName: string | null;
    } | null;
  };
}

export default function DeliverymanDashboard() {
  const [groups, setGroups] = useState<DeliveryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [expandedInvoice, setExpandedInvoice] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Delivery modals
  const [otpInput, setOtpInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [txnId, setTxnId] = useState("");
  const [failReason, setFailReason] = useState("");
  const [showDeliverModal, setShowDeliverModal] = useState<number | null>(null);
  const [showFailModal, setShowFailModal] = useState<number | null>(null);

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

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/api/my-deliveries");
      setGroups(data.groups || []);
      if (data.groups?.length === 1) setExpandedGroup(data.groups[0].id);
    } catch (err) {
      console.error("Failed to fetch groups:", err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // Get current GPS position
  const getPosition = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  };

  // Start delivery trip
  const handleStartDelivery = async (groupId: number) => {
    setActionLoading(`start-${groupId}`);
    try {
      const pos = await getPosition();
      await apiFetch(`/api/deliveries/${groupId}/start`, {
        method: "POST",
        body: JSON.stringify({ id: groupId, lat: pos?.lat, lng: pos?.lng }),
      });
      await fetchGroups();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Mark delivered
  const handleMarkDelivered = async (deliveryInvoiceId: number) => {
    if (!otpInput || otpInput.length !== 4) return alert("Enter 4-digit OTP");
    setActionLoading(`deliver-${deliveryInvoiceId}`);
    try {
      const pos = await getPosition();
      await apiFetch("/api/deliveries/mark-delivered", {
        method: "POST",
        body: JSON.stringify({
          deliveryInvoiceId,
          deliveryOtp: otpInput,
          lat: pos?.lat,
          lng: pos?.lng,
          paymentMethod: paymentMethod || undefined,
          amountCollected: paymentAmount ? parseFloat(paymentAmount) : undefined,
          transactionId: txnId || undefined,
        }),
      });
      setShowDeliverModal(null);
      setOtpInput("");
      setPaymentAmount("");
      setTxnId("");
      await fetchGroups();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Mark failed
  const handleMarkFailed = async (deliveryInvoiceId: number) => {
    if (!failReason.trim()) return alert("Enter failure reason");
    setActionLoading(`fail-${deliveryInvoiceId}`);
    try {
      const pos = await getPosition();
      await apiFetch("/api/deliveries/mark-failed", {
        method: "POST",
        body: JSON.stringify({
          deliveryInvoiceId,
          failedReason: failReason,
          lat: pos?.lat,
          lng: pos?.lng,
        }),
      });
      setShowFailModal(null);
      setFailReason("");
      await fetchGroups();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // End route
  const handleEndRoute = async (groupId: number) => {
    if (!confirm("End route? Make sure all deliveries are completed/failed.")) return;
    setActionLoading(`end-${groupId}`);
    try {
      const pos = await getPosition();
      const data = await apiFetch(`/api/deliveries/${groupId}/end-route`, {
        method: "POST",
        body: JSON.stringify({ groupId, lat: pos?.lat, lng: pos?.lng }),
      });
      alert(`Route ended!\n\nExpected: ৳${data.reconciliation?.expectedTotal?.toFixed(0)}\nCollected: ৳${data.reconciliation?.totalCollected?.toFixed(0)}\nDifference: ৳${data.reconciliation?.difference?.toFixed(0)}`);
      await fetchGroups();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2Icon className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
          <TruckIcon className="w-10 h-10 text-emerald-300" />
        </div>
        <h2 className="text-lg font-semibold text-gray-700 mb-1">No Active Tasks</h2>
        <p className="text-sm text-gray-500">You have no assigned delivery groups right now.</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "Pending",
            value: groups.reduce((s, g) => s + g.invoices.filter(i => i.status === "pending").length, 0),
            color: "text-amber-600 bg-amber-50",
          },
          {
            label: "Delivered",
            value: groups.reduce((s, g) => s + g.invoices.filter(i => i.status === "delivered").length, 0),
            color: "text-emerald-600 bg-emerald-50",
          },
          {
            label: "Failed",
            value: groups.reduce((s, g) => s + g.invoices.filter(i => i.status === "failed").length, 0),
            color: "text-red-600 bg-red-50",
          },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.color} rounded-xl p-3 text-center`}>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Delivery groups */}
      {groups.map((group) => (
        <div key={group.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {/* Group header */}
          <button
            onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                group.status === "assigned" ? "bg-blue-50" :
                group.status === "out_for_delivery" ? "bg-amber-50" : "bg-emerald-50"
              }`}>
                <TruckIcon className={`w-5 h-5 ${
                  group.status === "assigned" ? "text-blue-500" :
                  group.status === "out_for_delivery" ? "text-amber-500" : "text-emerald-500"
                }`} />
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm text-gray-900">{group.groupName}</p>
                <p className="text-xs text-gray-500">
                  {group.completedInvoices}/{group.totalInvoices} completed •{" "}
                  <span className={`font-medium ${
                    group.status === "assigned" ? "text-blue-600" :
                    group.status === "out_for_delivery" ? "text-amber-600" :
                    group.status === "completed" ? "text-emerald-600" : "text-orange-600"
                  }`}>
                    {group.status.replace(/_/g, " ").toUpperCase()}
                  </span>
                </p>
              </div>
            </div>
            {expandedGroup === group.id ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400" />}
          </button>

          {expandedGroup === group.id && (
            <div className="border-t">
              {/* Group actions */}
              <div className="p-3 flex gap-2">
                {group.status === "assigned" && (
                  <button
                    onClick={() => handleStartDelivery(group.id)}
                    disabled={actionLoading === `start-${group.id}`}
                    className="flex-1 bg-emerald-600 text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 active:bg-emerald-700 disabled:opacity-50"
                  >
                    {actionLoading === `start-${group.id}` ? (
                      <Loader2Icon className="w-4 h-4 animate-spin" />
                    ) : (
                      <PlayCircleIcon className="w-5 h-5" />
                    )}
                    Start Delivery
                  </button>
                )}
                {group.status === "out_for_delivery" && (
                  <button
                    onClick={() => handleEndRoute(group.id)}
                    disabled={!!actionLoading}
                    className="flex-1 bg-gray-800 text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 active:bg-gray-900 disabled:opacity-50"
                  >
                    End Route
                  </button>
                )}
              </div>

              {/* Invoice list */}
              <div className="divide-y">
                {group.invoices.map((inv) => (
                  <div key={inv.id} className="px-3 py-3">
                    {/* Invoice header */}
                    <button
                      onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)}
                      className="w-full flex items-center gap-3"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        inv.status === "pending" ? "bg-amber-100 text-amber-700" :
                        inv.status === "delivered" ? "bg-emerald-100 text-emerald-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {inv.sequence + 1}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm text-gray-900">
                          {inv.invoice.customer?.shopName || inv.invoice.customer?.name || `Invoice #${inv.invoice.invoiceNumber}`}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {inv.invoice.order?.shippingAddress || "No address"} • ৳{parseFloat(inv.invoice.grandTotal).toFixed(0)}
                        </p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                        inv.status === "pending" ? "bg-amber-50 text-amber-600" :
                        inv.status === "delivered" ? "bg-emerald-50 text-emerald-600" :
                        "bg-red-50 text-red-600"
                      }`}>
                        {inv.status.toUpperCase()}
                      </div>
                    </button>

                    {/* Expanded invoice */}
                    {expandedInvoice === inv.id && (
                      <div className="mt-3 ml-11 space-y-2">
                        {/* Customer details */}
                        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                          <p className="text-xs font-medium text-gray-700">
                            <span className="text-gray-400">Customer:</span> {inv.invoice.customer?.name || "N/A"}
                          </p>
                          <p className="text-xs text-gray-600">
                            <span className="text-gray-400">Phone:</span> {inv.invoice.customer?.phoneNumber || inv.invoice.order?.shippingPhone || "N/A"}
                          </p>
                          <p className="text-xs text-gray-600">
                            <span className="text-gray-400">Address:</span> {inv.invoice.order?.shippingAddress || "N/A"}, {inv.invoice.order?.shippingArea || ""}, {inv.invoice.order?.shippingCity || ""}
                          </p>
                          <p className="text-xs font-semibold text-gray-800">
                            <span className="text-gray-400">Amount:</span> ৳{parseFloat(inv.invoice.grandTotal).toLocaleString()}
                          </p>
                        </div>

                        {/* Action buttons */}
                        {inv.status === "pending" && group.status === "out_for_delivery" && (
                          <div className="flex gap-2">
                            {/* Call button */}
                            {(inv.invoice.customer?.phoneNumber || inv.invoice.order?.shippingPhone) && (
                              <a
                                href={`tel:${inv.invoice.customer?.phoneNumber || inv.invoice.order?.shippingPhone}`}
                                className="flex items-center justify-center gap-1 px-3 py-2.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium"
                              >
                                <PhoneCallIcon className="w-4 h-4" />
                                Call
                              </a>
                            )}
                            <button
                              onClick={() => {
                                setShowDeliverModal(inv.id);
                                setPaymentAmount(parseFloat(inv.invoice.grandTotal).toFixed(0));
                              }}
                              className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold active:bg-emerald-700"
                            >
                              <CheckCircle2Icon className="w-4 h-4" />
                              Deliver
                            </button>
                            <button
                              onClick={() => setShowFailModal(inv.id)}
                              className="flex items-center justify-center gap-1 px-3 py-2.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium"
                            >
                              <XCircleIcon className="w-4 h-4" />
                              Fail
                            </button>
                          </div>
                        )}

                        {/* Delivered details */}
                        {inv.status === "delivered" && (
                          <div className="bg-emerald-50 rounded-lg p-3 text-xs text-emerald-800 space-y-1">
                            <p className="font-semibold flex items-center gap-1">
                              <CheckCircle2Icon className="w-4 h-4" /> Delivered
                            </p>
                            {inv.paymentMethod && <p>Payment: {inv.paymentMethod} — ৳{parseFloat(inv.amountCollected).toFixed(0)}</p>}
                            {inv.deliveredAt && <p>Time: {new Date(inv.deliveredAt).toLocaleTimeString()}</p>}
                          </div>
                        )}

                        {/* Failed details */}
                        {inv.status === "failed" && (
                          <div className="bg-red-50 rounded-lg p-3 text-xs text-red-800 space-y-1">
                            <p className="font-semibold flex items-center gap-1">
                              <XCircleIcon className="w-4 h-4" /> Failed
                            </p>
                            <p>Reason: {inv.failedReason}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Deliver Modal */}
      {showDeliverModal !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 space-y-4 animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">Confirm Delivery</h3>
              <button onClick={() => setShowDeliverModal(null)} className="text-gray-400 p-1">
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            {/* OTP */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Customer OTP (4 digits)</label>
              <input
                type="text"
                maxLength={4}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                className="w-full border rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder="• • • •"
                autoFocus
              />
            </div>

            {/* Payment */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {["cash", "bkash", "nagad"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                      paymentMethod === m
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-gray-700 border-gray-200"
                    }`}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Amount Collected (৳)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full border rounded-xl px-4 py-3 text-lg font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            {paymentMethod !== "cash" && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Transaction ID</label>
                <input
                  type="text"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="Enter transaction ID"
                />
              </div>
            )}

            <button
              onClick={() => handleMarkDelivered(showDeliverModal)}
              disabled={!!actionLoading}
              className="w-full bg-emerald-600 text-white rounded-xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2 active:bg-emerald-700 disabled:opacity-50"
            >
              {actionLoading ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <CheckCircle2Icon className="w-5 h-5" />}
              Confirm Delivery
            </button>
          </div>
        </div>
      )}

      {/* Fail Modal */}
      {showFailModal !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 space-y-4 animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">Report Failed Delivery</h3>
              <button onClick={() => setShowFailModal(null)} className="text-gray-400 p-1">
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Reason for failure</label>
              <textarea
                value={failReason}
                onChange={(e) => setFailReason(e.target.value)}
                rows={3}
                className="w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                placeholder="e.g., Shop closed, Customer unavailable, Wrong address..."
                autoFocus
              />
            </div>

            <button
              onClick={() => handleMarkFailed(showFailModal)}
              disabled={!!actionLoading}
              className="w-full bg-red-600 text-white rounded-xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2 active:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <AlertCircleIcon className="w-5 h-5" />}
              Report Failed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
