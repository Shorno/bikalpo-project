"use client";

import { useState } from "react";
import { orpc } from "@/utils/orpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    InboxIcon,
    Package,
    Clock,
    CheckCircle2,
    XCircle,
    Truck,
    Loader2,
    AlertCircle,
    User,
    MapPin,
    Phone,
} from "lucide-react";

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    pending: { label: "Pending", icon: <Clock className="w-3 h-3" />, className: "text-amber-700 bg-amber-50 border-amber-200" },
    confirmed: { label: "Confirmed", icon: <CheckCircle2 className="w-3 h-3" />, className: "text-blue-700 bg-blue-50 border-blue-200" },
    processing: { label: "Processing", icon: <Truck className="w-3 h-3" />, className: "text-indigo-700 bg-indigo-50 border-indigo-200" },
    delivered: { label: "Delivered", icon: <CheckCircle2 className="w-3 h-3" />, className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    cancelled: { label: "Cancelled", icon: <XCircle className="w-3 h-3" />, className: "text-red-700 bg-red-50 border-red-200" },
};

type OrderStatus = "all" | "pending" | "confirmed" | "processing" | "delivered" | "cancelled";

export default function WarehouseIncomingOrdersPage() {
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState<OrderStatus>("all");
    const [page, setPage] = useState(1);
    const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["warehouse", "getIncomingOrders", statusFilter, page],
        queryFn: () =>
            orpc.warehouse.getIncomingOrders.call({
                status: statusFilter,
                page,
                limit: 20,
            }),
    });

    const updateStatusMutation = useMutation({
        mutationFn: (params: { orderId: number; status: string }) =>
            orpc.warehouse.updateIncomingOrderStatus.call(params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["warehouse", "getIncomingOrders"] });
        },
    });

    const orders = data?.orders ?? [];
    const pagination = data?.pagination;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Incoming Orders</h1>
                    <p className="text-sm text-muted-foreground">Orders from shop owners and other warehouses</p>
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as OrderStatus); setPage(1); }}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
                >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="processing">Processing</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
            ) : isError ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-red-50">
                    <AlertCircle className="size-10 text-red-300 mb-2" />
                    <p className="text-red-600 font-medium">Failed to load orders</p>
                </div>
            ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-muted/30">
                    <InboxIcon className="size-12 text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-lg font-medium">No incoming orders yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {statusFilter !== "all"
                            ? "Try changing the status filter"
                            : "Orders placed by shop owners will appear here."}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {orders.map((o: any) => {
                        const config = statusConfig[o.status] || statusConfig.pending;
                        const isExpanded = expandedOrder === o.id;

                        return (
                            <div key={o.id} className="border rounded-lg bg-white overflow-hidden">
                                {/* Order header */}
                                <div
                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => setExpandedOrder(isExpanded ? null : o.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <span className="font-mono text-sm font-semibold">{o.orderNumber}</span>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                <User className="w-3 h-3" />
                                                <span>{o.buyerShopName || o.buyerWarehouseName || o.buyerName || "Unknown"}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-semibold">৳{Number(o.total).toLocaleString()}</span>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${config.className}`}>
                                            {config.icon} {config.label}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(o.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}
                                        </span>
                                    </div>
                                </div>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-gray-50/50">
                                        {/* Shipping info */}
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="flex items-start gap-2">
                                                <User className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                                                <div>
                                                    <p className="font-medium text-gray-800">{o.shippingName}</p>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Phone className="w-3 h-3" /> {o.shippingPhone}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                                                <div>
                                                    <p className="text-gray-800">{o.shippingAddress}</p>
                                                    <p className="text-xs text-gray-500">{o.shippingCity}{o.shippingArea ? `, ${o.shippingArea}` : ""}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {o.customerNote && (
                                            <p className="text-xs text-gray-500 italic bg-yellow-50 border border-yellow-200 rounded p-2">Note: {o.customerNote}</p>
                                        )}

                                        {/* Order items */}
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-gray-500 uppercase">Items</p>
                                            {o.items?.map((item: any) => (
                                                <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                                                    <div className="flex items-center gap-2">
                                                        <Package className="w-3.5 h-3.5 text-gray-400" />
                                                        <span>{item.productName}</span>
                                                        {item.productSize && <span className="text-xs text-gray-400">({item.productSize})</span>}
                                                    </div>
                                                    <div className="text-xs text-gray-600">
                                                        {item.quantity} × ৳{Number(item.unitPrice).toLocaleString()} = <span className="font-semibold">৳{Number(item.totalPrice).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Action buttons */}
                                        {o.status === "pending" && (
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => updateStatusMutation.mutate({ orderId: o.id, status: "confirmed" })}
                                                    disabled={updateStatusMutation.isPending}
                                                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                                >
                                                    Confirm Order
                                                </button>
                                                <button
                                                    onClick={() => updateStatusMutation.mutate({ orderId: o.id, status: "cancelled" })}
                                                    disabled={updateStatusMutation.isPending}
                                                    className="px-3 py-1.5 bg-white text-red-600 text-xs font-medium rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-50"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                        {o.status === "confirmed" && (
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => updateStatusMutation.mutate({ orderId: o.id, status: "processing" })}
                                                    disabled={updateStatusMutation.isPending}
                                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                                >
                                                    Start Processing
                                                </button>
                                            </div>
                                        )}
                                        {o.status === "processing" && (
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => updateStatusMutation.mutate({ orderId: o.id, status: "delivered" })}
                                                    disabled={updateStatusMutation.isPending}
                                                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    Mark as Delivered
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between text-sm pt-2">
                            <span className="text-gray-500">Page {pagination.page} of {pagination.totalPages}</span>
                            <div className="flex gap-2">
                                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50">Previous</button>
                                <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50">Next</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
