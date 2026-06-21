"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  FileTextIcon,
  Loader2Icon,
  MapPinIcon,
  PackageIcon,
  PlusIcon,
  ReceiptTextIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

type TabId = "ready" | "partial" | "invoiced";

interface DispatchOrderItem {
  orderItemId: number;
  productId: number;
  productName: string;
  productSku: string;
  approvedQty: number;
  invoicedQty: number;
  remainingQty: number;
  unitPrice: string;
  lineTotal: string;
}

interface DispatchOrder {
  id: number;
  orderNumber: string;
  status: "ready_for_dispatch" | "partially_invoiced" | "invoiced";
  createdAt: string;
  readyAt: string | null;
  customer: {
    id: string;
    name: string;
    phoneNumber: string | null;
    shopName: string | null;
    warehouseName: string | null;
  };
  shipping: {
    name: string;
    phone: string;
    address: string;
    city: string;
    area: string | null;
  };
  progress: {
    approvedQty: number;
    invoicedQty: number;
    remainingQty: number;
    approvedTotal: string;
    invoicedTotal: string;
    remainingTotal: string;
  };
  items: DispatchOrderItem[];
  invoices: Array<{
    id: number;
    invoiceNumber: string;
    invoiceType: "main" | "split";
    splitSequence: number | null;
    grandTotal: string;
    deliveryStatus: string;
    createdAt: string;
  }>;
}

interface DispatchDashboardResponse {
  readyOrders: DispatchOrder[];
  partiallyInvoicedOrders: DispatchOrder[];
  invoicedOrders: DispatchOrder[];
}

function formatMoney(value: string | number) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD")}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: DispatchOrder["status"]) {
  if (status === "invoiced") return "Invoiced";
  if (status === "partially_invoiced") return "Partially Invoiced";
  return "Ready for Dispatch";
}

export default function DispatchOrdersPage() {
  const [activeTab, setActiveTab] = useState<TabId>("ready");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [readyOrders, setReadyOrders] = useState<DispatchOrder[]>([]);
  const [partialOrders, setPartialOrders] = useState<DispatchOrder[]>([]);
  const [invoicedOrders, setInvoicedOrders] = useState<DispatchOrder[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [partialInvoiceOrder, setPartialInvoiceOrder] =
    useState<DispatchOrder | null>(null);
  const [partialQuantities, setPartialQuantities] = useState<
    Record<number, number>
  >({});

  const apiBase = process.env.NEXT_PUBLIC_AUTH_URL || "";

  const apiFetch = useCallback(
    async <T,>(path: string, opts?: RequestInit): Promise<T> => {
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
    const data = await apiFetch<DispatchDashboardResponse>(
      "/warehouse/dispatch/dashboard",
    );
    setReadyOrders(data.readyOrders || []);
    setPartialOrders(data.partiallyInvoicedOrders || []);
    setInvoicedOrders(data.invoicedOrders || []);
  }, [apiFetch]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await fetchDispatchDashboard();
    } catch (error) {
      console.error("Dispatch load failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load dispatch data",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchDispatchDashboard]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentOrders = useMemo(() => {
    if (activeTab === "partial") return partialOrders;
    if (activeTab === "invoiced") return invoicedOrders;
    return readyOrders;
  }, [activeTab, invoicedOrders, partialOrders, readyOrders]);

  const tabs: Array<{ id: TabId; label: string; count: number }> = [
    { id: "ready", label: "Ready for Dispatch", count: readyOrders.length },
    {
      id: "partial",
      label: "Partially Invoiced",
      count: partialOrders.length,
    },
    { id: "invoiced", label: "Invoiced", count: invoicedOrders.length },
  ];

  const handleCreateFullInvoice = async (order: DispatchOrder) => {
    setActionLoading(`full-${order.id}`);
    try {
      const result = await apiFetch<{ message?: string }>(
        "/warehouse/dispatch/orders/full-invoice",
        {
          method: "POST",
          body: JSON.stringify({ orderId: order.id }),
        },
      );

      toast.success(result.message || "Invoice created");
      await fetchDispatchDashboard();
      setActiveTab("invoiced");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create invoice");
    } finally {
      setActionLoading(null);
    }
  };

  const openPartialInvoice = (order: DispatchOrder) => {
    setPartialInvoiceOrder(order);
    setPartialQuantities({});
  };

  const handlePartialQuantity = (
    item: DispatchOrderItem,
    nextQuantity: number,
  ) => {
    setPartialQuantities((current) => ({
      ...current,
      [item.orderItemId]: Math.max(
        0,
        Math.min(item.remainingQty, Number.isFinite(nextQuantity) ? nextQuantity : 0),
      ),
    }));
  };

  const handleCreatePartialInvoice = async () => {
    if (!partialInvoiceOrder) return;
    const items = partialInvoiceOrder.items
      .map((item) => ({
        orderItemId: item.orderItemId,
        quantity: partialQuantities[item.orderItemId] ?? 0,
      }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      toast.error("Select at least one item quantity");
      return;
    }

    setActionLoading(`partial-${partialInvoiceOrder.id}`);
    try {
      const result = await apiFetch<{ message?: string; status?: string }>(
        "/warehouse/dispatch/orders/partial-invoice",
        {
          method: "POST",
          body: JSON.stringify({ orderId: partialInvoiceOrder.id, items }),
        },
      );

      toast.success(result.message || "Partial invoice created");
      setPartialInvoiceOrder(null);
      setPartialQuantities({});
      await fetchDispatchDashboard();
      setActiveTab(result.status === "invoiced" ? "invoiced" : "partial");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create partial invoice",
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/warehouse/dashboard/order-management"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition-colors hover:bg-gray-50"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Dispatch Orders
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Create full or partial invoices for approved warehouse orders.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          label="Ready for Dispatch"
          value={readyOrders.length}
          tone="violet"
        />
        <SummaryCard
          label="Partially Invoiced"
          value={partialOrders.length}
          tone="amber"
        />
        <SummaryCard label="Invoiced" value={invoicedOrders.length} tone="emerald" />
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
        This phase stops at invoice creation. Delivery, self pickup, rider assignment,
        and settlement stay out of this flow until the next lifecycle is confirmed.
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
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                activeTab === tab.id
                  ? "bg-white/15 text-white"
                  : "bg-white text-gray-700"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2Icon className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : currentOrders.length === 0 ? (
        <EmptyState
          icon={<PackageIcon className="h-10 w-10 text-violet-300" />}
          title={`No ${tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()} orders`}
          subtitle="Orders will appear here automatically as they move through the strict approval and invoicing flow."
        />
      ) : (
        <div className="space-y-3">
          {currentOrders.map((order) => {
            const expanded = expandedOrder === order.id;
            return (
              <OrderCard
                key={order.id}
                actionLoading={actionLoading}
                expanded={expanded}
                onCreateFullInvoice={handleCreateFullInvoice}
                onOpenPartialInvoice={openPartialInvoice}
                onToggle={() => setExpandedOrder(expanded ? null : order.id)}
                order={order}
              />
            );
          })}
        </div>
      )}

      {partialInvoiceOrder ? (
        <PartialInvoiceModal
          actionLoading={actionLoading}
          onClose={() => {
            setPartialInvoiceOrder(null);
            setPartialQuantities({});
          }}
          onCreate={handleCreatePartialInvoice}
          onQuantityChange={handlePartialQuantity}
          order={partialInvoiceOrder}
          quantities={partialQuantities}
        />
      ) : null}
    </div>
  );
}

function OrderCard({
  actionLoading,
  expanded,
  onCreateFullInvoice,
  onOpenPartialInvoice,
  onToggle,
  order,
}: {
  actionLoading: string | null;
  expanded: boolean;
  onCreateFullInvoice: (order: DispatchOrder) => Promise<void>;
  onOpenPartialInvoice: (order: DispatchOrder) => void;
  onToggle: () => void;
  order: DispatchOrder;
}) {
  const canInvoice = order.status !== "invoiced" && order.progress.remainingQty > 0;
  const customerName =
    order.customer.warehouseName ||
    order.customer.shopName ||
    order.customer.name ||
    order.shipping.name;

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50">
            <ReceiptTextIcon className="h-5 w-5 text-violet-600" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-gray-900">
                {customerName}
              </p>
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                {statusLabel(order.status)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              {order.orderNumber} · Ready {formatDate(order.readyAt)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-bold text-gray-900">
              {formatMoney(order.progress.remainingTotal)}
            </p>
            <p className="text-xs text-gray-500">
              {order.progress.remainingQty} remaining
            </p>
          </div>
          {expanded ? (
            <ChevronUpIcon className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {expanded ? (
        <div className="border-t bg-gray-50/70 p-4">
          <OrderMeta order={order} />

          {canInvoice ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => void onCreateFullInvoice(order)}
                disabled={!!actionLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {actionLoading === `full-${order.id}` ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <FileTextIcon className="h-4 w-4" />
                )}
                {order.status === "partially_invoiced"
                  ? "Invoice Remaining"
                  : "Create Full Invoice"}
              </button>
              <button
                onClick={() => onOpenPartialInvoice(order)}
                disabled={!!actionLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-60"
              >
                <PlusIcon className="h-4 w-4" />
                Create Partial Invoice
              </button>
            </div>
          ) : (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <CheckCircle2Icon className="h-4 w-4" />
              All approved quantities are invoiced.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function OrderMeta({ order }: { order: DispatchOrder }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <InfoPanel label="Customer">
          <div className="flex items-center gap-2">
            <UserIcon className="h-3.5 w-3.5 text-gray-400" />
            <span>
              {order.customer.warehouseName ||
                order.customer.shopName ||
                order.customer.name}
            </span>
          </div>
          {order.customer.phoneNumber ? <span>{order.customer.phoneNumber}</span> : null}
        </InfoPanel>
        <InfoPanel label="Shipping">
          <div className="flex items-start gap-2">
            <MapPinIcon className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
            <span>
              {order.shipping.address}
              {order.shipping.area ? `, ${order.shipping.area}` : ""}
              {order.shipping.city ? `, ${order.shipping.city}` : ""}
            </span>
          </div>
        </InfoPanel>
        <InfoPanel label="Progress">
          <span>Approved: {order.progress.approvedQty}</span>
          <span>Invoiced: {order.progress.invoicedQty}</span>
          <span>Remaining: {order.progress.remainingQty}</span>
        </InfoPanel>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Order Items
        </p>
        <div className="overflow-hidden rounded-lg border bg-white">
          {order.items.map((item) => (
            <div
              key={item.orderItemId}
              className="grid gap-2 border-b p-3 text-sm last:border-0 md:grid-cols-[1fr_auto_auto_auto]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">
                  {item.productName}
                </p>
                <p className="text-xs text-gray-400">{item.productSku}</p>
              </div>
              <Metric label="Approved" value={item.approvedQty} />
              <Metric label="Invoiced" value={item.invoicedQty} />
              <Metric label="Remaining" value={item.remainingQty} strong />
            </div>
          ))}
        </div>
      </div>

      {order.invoices.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Created Invoices
          </p>
          <div className="flex flex-wrap gap-2">
            {order.invoices.map((invoice) => (
              <span
                key={invoice.id}
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs"
              >
                <ReceiptTextIcon className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-mono font-semibold">
                  {invoice.invoiceNumber}
                </span>
                <span className="text-gray-500">
                  {formatMoney(invoice.grandTotal)}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PartialInvoiceModal({
  actionLoading,
  onClose,
  onCreate,
  onQuantityChange,
  order,
  quantities,
}: {
  actionLoading: string | null;
  onClose: () => void;
  onCreate: () => Promise<void>;
  onQuantityChange: (item: DispatchOrderItem, quantity: number) => void;
  order: DispatchOrder;
  quantities: Record<number, number>;
}) {
  const selectedTotal = order.items.reduce((sum, item) => {
    const quantity = quantities[item.orderItemId] ?? 0;
    return sum + quantity * Number(item.unitPrice);
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white">
        <div className="border-b p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Create Partial Invoice
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Select quantities to invoice for {order.orderNumber}.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="overflow-hidden rounded-xl border">
            {order.items.map((item) => {
              const quantity = quantities[item.orderItemId] ?? 0;
              const disabled = item.remainingQty <= 0;
              return (
                <div
                  key={item.orderItemId}
                  className="grid gap-3 border-b p-4 last:border-0 md:grid-cols-[1fr_120px_140px_130px]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {item.productName}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Remaining {item.remainingQty} of {item.approvedQty}
                    </p>
                  </div>
                  <Metric label="Invoiced" value={item.invoicedQty} />
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      Invoice Qty
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={item.remainingQty}
                      value={quantity}
                      disabled={disabled}
                      onChange={(event) =>
                        onQuantityChange(item, Number(event.target.value))
                      }
                      className="h-9 w-full rounded-lg border bg-white px-3 text-right text-sm tabular-nums outline-none transition-colors focus:border-violet-400 focus:ring-2 focus:ring-violet-100 disabled:bg-gray-100"
                    />
                  </label>
                  <Metric
                    label="Line Total"
                    value={formatMoney(quantity * Number(item.unitPrice))}
                    strong
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t bg-gray-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Partial Invoice Total
            </p>
            <p className="text-2xl font-bold text-gray-950">
              {formatMoney(selectedTotal)}
            </p>
          </div>
          <button
            onClick={() => void onCreate()}
            disabled={actionLoading === `partial-${order.id}` || selectedTotal <= 0}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
          >
            {actionLoading === `partial-${order.id}` ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <ReceiptTextIcon className="h-4 w-4" />
            )}
            Create Partial Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoPanel({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="space-y-1.5 rounded-lg border bg-white p-3 text-xs text-gray-600">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Metric({
  label,
  strong,
  value,
}: {
  label: string;
  strong?: boolean;
  value: ReactNode;
}) {
  return (
    <div className="text-right tabular-nums">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className={strong ? "font-bold text-gray-950" : "font-medium text-gray-700"}>
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "violet" | "amber" | "emerald";
  value: number;
}) {
  const toneClass =
    tone === "violet"
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function EmptyState({
  icon,
  subtitle,
  title,
}: {
  icon: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-12 text-center">
      <div className="mb-3 flex justify-center">{icon}</div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}
