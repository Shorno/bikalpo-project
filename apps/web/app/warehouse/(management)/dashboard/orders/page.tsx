"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  ShoppingCartIcon,
  Truck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="w-3 h-3" />,
    className: "text-amber-700 bg-amber-50 border-amber-200",
  },
  confirmed: {
    label: "Confirmed",
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: "text-blue-700 bg-blue-50 border-blue-200",
  },
  processing: {
    label: "Processing",
    icon: <Truck className="w-3 h-3" />,
    className: "text-indigo-700 bg-indigo-50 border-indigo-200",
  },
  delivered: {
    label: "Delivered",
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  cancelled: {
    label: "Cancelled",
    icon: <XCircle className="w-3 h-3" />,
    className: "text-red-700 bg-red-50 border-red-200",
  },
};

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "delivered"
  | "cancelled";

export default function WarehouseMyOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["warehouse", "getMyOrders", statusFilter, page],
    queryFn: () =>
      orpc.warehouse.getMyOrders.call({
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit: 15,
      }),
  });

  const orders = data?.orders ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Orders</h1>
          <p className="text-sm text-muted-foreground">
            Orders you&apos;ve placed with other warehouses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/warehouse/dashboard/suppliers">
              <ShoppingCartIcon className="mr-2 h-4 w-4" />
              New Order
            </Link>
          </Button>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
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
          <ShoppingCartIcon className="size-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-lg font-medium">
            No orders yet
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {statusFilter !== "all"
              ? "Try changing the status filter"
              : "Orders you place from other warehouses will appear here."}
          </p>
          <Button asChild className="mt-4">
            <Link href="/warehouse/dashboard/suppliers">
              <ShoppingCartIcon className="mr-2 h-4 w-4" />
              Create Supplier Order
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Order #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Items
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => {
                  const config = statusConfig[o.status] || statusConfig.pending;
                  return (
                    <tr
                      key={o.id}
                      className="border-b last:border-0 hover:bg-gray-50/50"
                    >
                      <td className="px-4 py-3 font-mono text-sm font-medium">
                        {o.orderNumber}
                        {o.requiresBuyerAcceptance ? (
                          <div className="mt-1 text-[10px] font-sans text-orange-600">
                            Approval needed
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <p className="font-medium">
                          {o.supplierWarehouseName || "Unknown Warehouse"}
                        </p>
                        {o.supplierWarehousePhone ? (
                          <p className="text-xs text-gray-400">
                            {o.supplierWarehousePhone}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">
                            {o.items?.length || 0} item
                            {(o.items?.length || 0) !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {o.items?.slice(0, 2).map((item: any, i: number) => (
                          <p
                            key={i}
                            className="text-xs text-gray-400 ml-6 truncate max-w-[200px]"
                          >
                            {item.productName} × {item.quantity}
                            {item.modifiedQty !== null ? ` -> ${item.modifiedQty}` : ""}
                          </p>
                        ))}
                        {(o.items?.length || 0) > 2 && (
                          <p className="text-xs text-gray-400 ml-6">
                            +{o.items.length - 2} more
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-sm">
                        ৳{Number(o.total).toLocaleString("en-BD")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${config.className}`}
                        >
                          {config.icon} {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(o.createdAt).toLocaleDateString("en-BD", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/warehouse/dashboard/orders/${o.id}`}>
                            View
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Page {pagination.page} of {pagination.totalPages} (
                {pagination.totalCount} orders)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
