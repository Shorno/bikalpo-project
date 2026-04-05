"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  InboxIcon,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  Save,
  Trash2,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import { useState, useCallback } from "react";
import { orpc } from "@/utils/orpc";

/* ─── Status tab definitions ─── */
const TABS = [
  { key: "all", label: "All Orders" },
  { key: "pending", label: "Pending", color: "text-amber-600" },
  { key: "confirmed", label: "Confirmed", color: "text-blue-600" },
  { key: "delivered", label: "Delivered", color: "text-emerald-600" },
  { key: "cancelled", label: "Cancelled", color: "text-red-600" },
] as const;

/* ─── Status badge ─── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "Pending" },
    confirmed: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: "Confirmed" },
    processing: { bg: "bg-purple-50 border-purple-200", text: "text-purple-700", label: "Processing" },
    delivered: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", label: "Delivered" },
    cancelled: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "Cancelled" },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 border rounded-full font-semibold ${s.bg} ${s.text}`}>
      {status === "pending" && <Clock size={12} />}
      {status === "confirmed" && <CheckCircle size={12} />}
      {status === "delivered" && <Truck size={12} />}
      {status === "cancelled" && <XCircle size={12} />}
      {s.label}
    </span>
  );
}

/* ─── Action buttons ─── */
function OrderActions({
  orderId,
  status,
  onAction,
  loading,
}: {
  orderId: number;
  status: string;
  onAction: (orderId: number, newStatus: string) => void;
  loading: boolean;
}) {
  if (status === "delivered" || status === "cancelled") return null;

  return (
    <div className="flex items-center gap-2 mt-3 sm:mt-0">
      {status === "pending" && (
        <>
          <button
            onClick={() => onAction(orderId, "confirmed")}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle size={14} /> Confirm
          </button>
          <button
            onClick={() => onAction(orderId, "cancelled")}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <XCircle size={14} /> Cancel
          </button>
        </>
      )}
      {status === "confirmed" && (
        <button
          onClick={() => onAction(orderId, "delivered")}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          <Truck size={14} /> Mark Delivered
        </button>
      )}
    </div>
  );
}

/* ─── Editable item row ─── */
function EditableItemRow({
  item,
  isEditing,
  editQty,
  onQtyChange,
}: {
  item: any;
  isEditing: boolean;
  editQty: number;
  onQtyChange: (qty: number) => void;
}) {
  const unitPrice = Number(item.unitPrice);
  const displayQty = isEditing ? editQty : item.quantity;
  const displayTotal = isEditing ? (unitPrice * editQty).toFixed(2) : item.totalPrice;
  const isRemoved = isEditing && editQty === 0;

  return (
    <div className={`flex items-center justify-between bg-white rounded-lg p-3 border transition-all ${
      isRemoved ? "border-red-200 bg-red-50/50 opacity-60" : "border-gray-100"
    }`}>
      <div className="flex items-center gap-3">
        {item.productImage ? (
          <img src={item.productImage} alt="" className="w-8 h-8 rounded object-cover" />
        ) : (
          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
            <Package size={14} className="text-gray-400" />
          </div>
        )}
        <div>
          <div className={`text-sm font-medium ${isRemoved ? "line-through text-gray-400" : "text-gray-900"}`}>
            {item.productName}
          </div>
          <div className="text-xs text-gray-500">{item.productSize}</div>
        </div>
      </div>

      {isEditing ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => onQtyChange(Math.max(0, editQty - 1))}
              className="px-2 py-1.5 hover:bg-gray-100 transition-colors text-gray-600"
            >
              {editQty === 1 ? <Trash2 size={14} className="text-red-500" /> : <Minus size={14} />}
            </button>
            <input
              type="number"
              min={0}
              value={editQty}
              onChange={(e) => onQtyChange(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-12 text-center text-sm font-semibold border-x border-gray-200 py-1.5 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => onQtyChange(editQty + 1)}
              className="px-2 py-1.5 hover:bg-gray-100 transition-colors text-gray-600"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="text-xs text-gray-500 min-w-[60px] text-right">
            × ৳{unitPrice.toLocaleString()}
          </div>
          <div className={`text-sm font-bold min-w-[70px] text-right ${
            isRemoved ? "text-red-500 line-through" : "text-gray-900"
          }`}>
            ৳{Number(displayTotal).toLocaleString()}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold">{displayQty}×</div>
            <div className="text-xs text-gray-500">৳{unitPrice.toLocaleString()} each</div>
          </div>
          <div className="text-sm font-bold text-gray-900 min-w-[60px] text-right">
            ৳{Number(displayTotal).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Order card ─── */
function OrderCard({
  order: o,
  expanded,
  onToggle,
  onAction,
  loading,
  onSaveItems,
  savingItems,
}: {
  order: any;
  expanded: boolean;
  onToggle: () => void;
  onAction: (orderId: number, newStatus: string) => void;
  loading: boolean;
  onSaveItems: (orderId: number, items: { itemId: number; quantity: number }[]) => void;
  savingItems: boolean;
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

  const [isEditing, setIsEditing] = useState(false);
  const [editQuantities, setEditQuantities] = useState<Record<number, number>>({});

  const startEditing = useCallback(() => {
    const initial: Record<number, number> = {};
    (o.items || []).forEach((item: any) => {
      initial[item.id] = item.quantity;
    });
    setEditQuantities(initial);
    setIsEditing(true);
  }, [o.items]);

  const cancelEditing = () => {
    setIsEditing(false);
    setEditQuantities({});
  };

  const hasChanges = (o.items || []).some(
    (item: any) => editQuantities[item.id] !== undefined && editQuantities[item.id] !== item.quantity
  );

  const editedTotal = isEditing
    ? (o.items || []).reduce((sum: number, item: any) => {
        const qty = editQuantities[item.id] ?? item.quantity;
        return sum + Number(item.unitPrice) * qty;
      }, 0)
    : Number(o.total);

  const handleSave = () => {
    const items = (o.items || [])
      .filter((item: any) => editQuantities[item.id] !== undefined && editQuantities[item.id] !== item.quantity)
      .map((item: any) => ({ itemId: item.id, quantity: editQuantities[item.id]! }));

    if (items.length > 0) {
      onSaveItems(o.id, items);
      setIsEditing(false);
      setEditQuantities({});
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start justify-between p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Package size={18} className="text-orange-600" />
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
            <div className={`font-bold ${isEditing && hasChanges ? "text-blue-600" : "text-gray-900"}`}>
              ৳{editedTotal.toLocaleString()}
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
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Order Items
              </div>
              {o.status === "pending" && !isEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); startEditing(); }}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                >
                  <Edit3 size={12} /> Edit Quantities
                </button>
              )}
              {isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelEditing}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges || savingItems}
                    className="flex items-center gap-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <Save size={12} /> Save Changes
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {(o.items || []).map((item: any) => (
                <EditableItemRow
                  key={item.id}
                  item={item}
                  isEditing={isEditing}
                  editQty={editQuantities[item.id] ?? item.quantity}
                  onQtyChange={(qty) =>
                    setEditQuantities((prev) => ({ ...prev, [item.id]: qty }))
                  }
                />
              ))}
            </div>

            {/* Edited total summary */}
            {isEditing && hasChanges && (
              <div className="mt-3 flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-xs font-medium text-blue-700">Updated Total</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-gray-400 line-through">৳{Number(o.total).toLocaleString()}</span>
                  <span className="text-sm font-bold text-blue-700">৳{editedTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Shipping + Actions */}
          <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100">
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

            <OrderActions
              orderId={o.id}
              status={o.status}
              onAction={onAction}
              loading={loading}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function SupplyOrdersPage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Fetch orders
  const { data, isLoading, error } = useQuery({
    queryKey: ["warehouse", "incoming-orders", activeTab],
    queryFn: () =>
      orpc.warehouse.getIncomingOrders.call({
        status: activeTab as any,
        page: 1,
        limit: 50,
      }),
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: ({ orderId, status }: { orderId: number; status: string }) =>
      orpc.warehouse.updateIncomingOrderStatus.call({
        orderId,
        status: status as any,
      }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "incoming-orders"] });
      alert(result.message || "Order updated!");
    },
    onError: (err: any) => {
      alert(`Error: ${err.message || "Failed to update order"}`);
    },
  });

  // Update items mutation
  const updateItems = useMutation({
    mutationFn: ({ orderId, items }: { orderId: number; items: { itemId: number; quantity: number }[] }) =>
      orpc.warehouse.updateIncomingOrderItems.call({ orderId, items }),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "incoming-orders"] });
      alert(result.message || "Items updated!");
    },
    onError: (err: any) => {
      alert(`Error: ${err.message || "Failed to update items"}`);
    },
  });

  const handleAction = (orderId: number, newStatus: string) => {
    const confirmMsg =
      newStatus === "delivered"
        ? "Mark as delivered? This will convert trade inventory → shop retail inventory."
        : newStatus === "cancelled"
          ? "Cancel this order? This cannot be undone."
          : `Set order to ${newStatus}?`;

    if (confirm(confirmMsg)) {
      updateStatus.mutate({ orderId, status: newStatus });
    }
  };

  const handleSaveItems = (orderId: number, items: { itemId: number; quantity: number }[]) => {
    updateItems.mutate({ orderId, items });
  };

  const orders = data?.orders ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="text-orange-500" size={24} />
          Supply Orders
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Incoming B2B orders from shop owners. Confirm and deliver to auto-convert trade stock → retail inventory.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="bg-white rounded-xl border p-12 flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-gray-500">Loading orders...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-xl border border-red-200 p-6 text-center">
          <p className="text-red-600 text-sm">Failed to load orders: {(error as any)?.message}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <InboxIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-700 mb-1">No orders found</h2>
          <p className="text-sm text-gray-500">
            {activeTab === "all"
              ? "No supply orders received yet. Orders from shop owners will appear here."
              : `No ${activeTab} orders.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{pagination?.totalCount ?? orders.length} order{orders.length !== 1 ? "s" : ""}</span>
            <span>Total: ৳{orders.reduce((s: number, o: any) => s + Number(o.total || 0), 0).toLocaleString()}</span>
          </div>

          {/* Order cards */}
          {orders.map((o: any) => (
            <OrderCard
              key={o.id}
              order={o}
              expanded={expandedId === o.id}
              onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)}
              onAction={handleAction}
              loading={updateStatus.isPending}
              onSaveItems={handleSaveItems}
              savingItems={updateItems.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
