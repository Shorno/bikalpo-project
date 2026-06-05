"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  Copy,
  KeyRound,
  Loader2Icon,
  MapPinIcon,
  PackageIcon,
  TruckIcon,
  UserIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

type TabId = "ready" | "pickup";

interface InvoiceCard {
  id: number;
  invoiceNumber: string;
  fulfillmentMode?: string | null;
  completionOtp?: string | null;
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

export default function DispatchOrdersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("ready");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [readyInvoices, setReadyInvoices] = useState<InvoiceCard[]>([]);
  const [selfPickupInvoices, setSelfPickupInvoices] = useState<InvoiceCard[]>([]);
  const [deliveryQueueCount, setDeliveryQueueCount] = useState(0);
  const [expandedInvoice, setExpandedInvoice] = useState<number | null>(null);
  const [showVerifyPickupModal, setShowVerifyPickupModal] = useState<{
    invoiceId: number;
    invoiceNumber: string;
  } | null>(null);
  const [pickupOtpInput, setPickupOtpInput] = useState("");

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

  const fetchDispatchDashboard = useCallback(async () => {
    const data = await apiFetch("/warehouse/dispatch/dashboard");
    setReadyInvoices(data.readyInvoices || []);
    setSelfPickupInvoices(data.selfPickupInvoices || []);
    setDeliveryQueueCount(data.deliveryQueueCount || 0);
  }, [apiFetch]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await fetchDispatchDashboard();
    } catch (error) {
      console.error("Dispatch load failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load dispatch data");
    } finally {
      setLoading(false);
    }
  }, [fetchDispatchDashboard]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSelectMode = async (
    invoiceId: number,
    invoiceNumber: string,
    fulfillmentMode: "self_pickup" | "delivery",
  ) => {
    setActionLoading(`mode-${invoiceId}-${fulfillmentMode}`);
    try {
      const result = await apiFetch("/warehouse/dispatch/configure", {
        method: "POST",
        body: JSON.stringify({ invoiceId, fulfillmentMode }),
      });

      if (fulfillmentMode === "self_pickup" && result.completionOtp) {
        toast.success(`${invoiceNumber} is ready for self pickup. OTP: ${result.completionOtp}`);
        setActiveTab("pickup");
      } else {
        toast.success(result.message || "Invoice moved to delivery management");
        router.push("/warehouse/dashboard/delivery-management");
      }

      await fetchDispatchDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update dispatch mode");
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyPickup = async () => {
    if (!showVerifyPickupModal) return;
    if (pickupOtpInput.length !== 4) {
      toast.error("Enter the 4-digit pickup OTP");
      return;
    }

    setActionLoading(`pickup-${showVerifyPickupModal.invoiceId}`);
    try {
      const result = await apiFetch("/warehouse/dispatch/self-pickup/verify", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: showVerifyPickupModal.invoiceId,
          otp: pickupOtpInput,
        }),
      });

      toast.success(result.message || "Self pickup completed");
      setShowVerifyPickupModal(null);
      setPickupOtpInput("");
      await fetchDispatchDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pickup verification failed");
    } finally {
      setActionLoading(null);
    }
  };

  const copyOtp = async (otp: string) => {
    try {
      await navigator.clipboard.writeText(otp);
      toast.success("OTP copied");
    } catch {
      toast.error("Could not copy OTP");
    }
  };

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: "ready", label: "Ready", count: readyInvoices.length || undefined },
    { id: "pickup", label: "Self Pickup", count: selfPickupInvoices.length || undefined },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispatch Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            Dispatch decides whether an invoice completes by self pickup or moves into
            Delivery Management.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/warehouse/dashboard/delivery-management")}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
        >
          Open Delivery Management
          <ArrowRightIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Self pickup completes and settles from this page with OTP. Delivery invoices
        continue in Delivery Management for internal delivery handling.
      </div>

      {deliveryQueueCount > 0 ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          {deliveryQueueCount} invoice{deliveryQueueCount > 1 ? "s are" : " is"} already waiting in
          Delivery Management.
        </div>
      ) : null}

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
      ) : activeTab === "ready" ? (
        <div className="space-y-3">
          {readyInvoices.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2Icon className="h-10 w-10 text-emerald-300" />}
              title="No invoices waiting for dispatch"
              subtitle="Prepare a warehouse invoice first, then choose self pickup or delivery here."
            />
          ) : (
            readyInvoices.map((invoice) => {
              const expanded = expandedInvoice === invoice.id;
              return (
                <div key={invoice.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                  <button
                    onClick={() => setExpandedInvoice(expanded ? null : invoice.id)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50">
                        <PackageIcon className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {invoice.customer?.shopName || invoice.customer?.name || invoice.invoiceNumber}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {invoice.invoiceNumber} - {invoice.order?.orderNumber}
                        </p>
                      </div>
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

                  {expanded && (
                    <div className="border-t bg-gray-50/70 p-4">
                      <InvoiceMeta invoice={invoice} />

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() =>
                            void handleSelectMode(invoice.id, invoice.invoiceNumber, "self_pickup")
                          }
                          disabled={!!actionLoading}
                          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                        >
                          {actionLoading === `mode-${invoice.id}-self_pickup` ? (
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4" />
                          )}
                          Self Pickup
                        </button>

                        <button
                          onClick={() =>
                            void handleSelectMode(invoice.id, invoice.invoiceNumber, "delivery")
                          }
                          disabled={!!actionLoading}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {actionLoading === `mode-${invoice.id}-delivery` ? (
                            <Loader2Icon className="h-4 w-4 animate-spin" />
                          ) : (
                            <TruckIcon className="h-4 w-4" />
                          )}
                          Delivery
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {selfPickupInvoices.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="h-10 w-10 text-amber-300" />}
              title="No self pickup handovers pending"
              subtitle="Invoices marked for pickup will appear here with their completion OTP."
            />
          ) : (
            selfPickupInvoices.map((invoice) => (
              <div key={invoice.id} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {invoice.customer?.shopName || invoice.customer?.name || invoice.invoiceNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {invoice.invoiceNumber} - {invoice.order?.orderNumber}
                      </p>
                    </div>

                    <div className="space-y-1 text-xs text-gray-600">
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

                  <div className="min-w-[260px] rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                        Pickup OTP
                      </span>
                      {invoice.completionOtp ? (
                        <button
                          type="button"
                          onClick={() => void copyOtp(invoice.completionOtp!)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-3 rounded-lg bg-white px-4 py-3 text-center font-mono text-3xl font-bold tracking-[0.35em] text-amber-700">
                      {invoice.completionOtp || "----"}
                    </div>

                    <p className="mt-3 text-xs text-amber-800">
                      Verify this code from the retailer at handover to settle the invoice
                      immediately.
                    </p>

                    <button
                      onClick={() =>
                        setShowVerifyPickupModal({
                          invoiceId: invoice.id,
                          invoiceNumber: invoice.invoiceNumber,
                        })
                      }
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                    >
                      <CheckCircle2Icon className="h-4 w-4" />
                      Verify Pickup
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showVerifyPickupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Verify Self Pickup</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Confirm OTP for {showVerifyPickupModal.invoiceNumber}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowVerifyPickupModal(null);
                  setPickupOtpInput("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Pickup OTP
              </label>
              <input
                type="text"
                maxLength={4}
                value={pickupOtpInput}
                onChange={(event) => setPickupOtpInput(event.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border px-4 py-3 text-center font-mono text-2xl tracking-[0.45em] outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                placeholder="0000"
                autoFocus
              />
            </div>

            <button
              onClick={() => void handleVerifyPickup()}
              disabled={actionLoading === `pickup-${showVerifyPickupModal.invoiceId}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
            >
              {actionLoading === `pickup-${showVerifyPickupModal.invoiceId}` ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2Icon className="h-4 w-4" />
              )}
              Complete Pickup
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
