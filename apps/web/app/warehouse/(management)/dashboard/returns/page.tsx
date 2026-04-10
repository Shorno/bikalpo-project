"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  InboxIcon,
  MapPin,
  Package,
  Phone,
  RotateCcw,
  Truck,
  User,
} from "lucide-react";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

/* ─── Status badge ─── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    returned: { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", label: "Returned" },
    confirmed: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "Re-confirmed" },
    pending: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "Pending" },
    delivered: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Re-delivered" },
  };
  const s = map[status] || map.returned;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 border rounded-full font-semibold ${s.bg} ${s.text}`}>
      <RotateCcw size={12} />
      {s.label}
    </span>
  );
}

/* ─── Return card ─── */
function ReturnCard({
  order: o,
  expanded,
  onToggle,
}: {
  order: any;
  expanded: boolean;
  onToggle: () => void;
}) {
  const itemCount = o.items?.length ?? 0;
  const date = new Date(o.createdAt);
  const formattedDate = date.toLocaleDateString("en-BD", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start justify-between p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <RotateCcw size={18} className="text-orange-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 text-sm">{o.orderNumber}</span>
              <StatusBadge status={o.status} />
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User size={12} />
                {o.buyerShopName || o.buyerWarehouseName || o.buyerName || "Unknown"}
              </span>
              <span>{formattedDate}</span>
              <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <div className="text-right">
            <div className="font-bold text-gray-900">
              ৳{Number(o.total).toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-400 uppercase">{o.paymentMethod?.replace(/_/g, " ")}</div>
          </div>
          {expanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Items */}
          <div className="px-4 py-3 bg-gray-50/50">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Returned Items
            </div>
            <div className="space-y-2">
              {(o.items || []).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-100">
                  <div className="flex items-center gap-3">
                    {item.productImage ? (
                      <img src={item.productImage} alt="" className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                        <Package size={14} className="text-gray-400" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.productName}
                      </div>
                      <div className="text-xs text-gray-500">{item.productSize}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold">{item.quantity}×</div>
                      <div className="text-xs text-gray-500">৳{Number(item.unitPrice).toLocaleString()} each</div>
                    </div>
                    <div className="text-sm font-bold text-gray-900 min-w-[60px] text-right">
                      ৳{Number(item.totalPrice).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping info */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex items-center gap-1.5">
                <User size={12} /> {o.shippingName}
              </div>
              <div className="flex items-center gap-1.5">
                <Phone size={12} /> {o.shippingPhone}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={12} /> {o.shippingAddress}, {o.shippingCity} {o.shippingArea ? `(${o.shippingArea})` : ""}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function WarehouseReturnsPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Fetch returned orders
  const { data, isLoading, error } = useQuery({
    queryKey: ["warehouse", "incoming-orders", "returned"],
    queryFn: () =>
      orpc.warehouse.getIncomingOrders.call({
        status: "returned" as any,
        page: 1,
        limit: 50,
      }),
  });

  const orders = data?.orders ?? [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <RotateCcw className="text-orange-500" size={24} />
          Returns
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Returned orders from delivery. Review and decide to re-dispatch or cancel.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-2xl font-bold text-orange-600">{orders.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Returns</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-2xl font-bold text-gray-900">
            ৳{orders.reduce((s: number, o: any) => s + Number(o.total || 0), 0).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">Total Value</div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="bg-white rounded-xl border p-12 flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-gray-500">Loading returns...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-xl border border-red-200 p-6 text-center">
          <p className="text-red-600 text-sm">Failed to load returns: {(error as any)?.message}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
            <RotateCcw className="w-8 h-8 text-orange-300" />
          </div>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">No returned orders</h2>
          <p className="text-sm text-gray-500 max-w-md">
            When deliverymen mark orders as returned, they will appear here for review.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{orders.length} return{orders.length !== 1 ? "s" : ""}</span>
            <span>Total: ৳{orders.reduce((s: number, o: any) => s + Number(o.total || 0), 0).toLocaleString()}</span>
          </div>

          {/* Return cards */}
          {orders.map((o: any) => (
            <ReturnCard
              key={o.id}
              order={o}
              expanded={expandedId === o.id}
              onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
