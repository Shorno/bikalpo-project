"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Package,
  Plus,
  Truck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-700",
  received: "bg-green-100 text-green-700",
  partial: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_TABS = [
  { value: undefined as string | undefined, label: "All" },
  { value: "draft", label: "Draft" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse", "purchases", statusFilter, page],
    queryFn: () =>
      orpc.warehouse.getPurchases.call({
        status: statusFilter as any,
        page,
        limit: 20,
      }),
  });

  const receiveMutation = useMutation({
    mutationFn: (purchaseId: number) =>
      orpc.warehouse.receivePurchase.call({ purchaseId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "purchases"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (purchaseId: number) =>
      orpc.warehouse.cancelPurchase.call({ purchaseId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "purchases"] });
    },
  });

  const purchases = data?.purchases ?? [];
  const pagination = data?.pagination;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="text-emerald-600" size={24} />
            Purchases
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track stock purchases from your suppliers
          </p>
        </div>
        <Link
          href="/warehouse/dashboard/purchases/new"
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          New Purchase
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              statusFilter === tab.value
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Purchase List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Package className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 font-medium">No purchases yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Create a purchase order to add stock to your warehouse
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map((p: any) => (
            <div
              key={p.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-emerald-200 transition-colors"
            >
              {/* Purchase Header Row */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {p.purchaseNumber}
                    </p>
                    <p className="text-xs text-gray-500">
                      {p.supplier?.name || "Unknown Supplier"}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-600"}`}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      ৳{parseFloat(p.total).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {p.items?.length || 0} items •{" "}
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {expandedId === p.id ? (
                    <ChevronUp size={16} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === p.id && (
                <div className="border-t border-gray-100 px-4 pb-4">
                  {/* Items Table */}
                  <table className="w-full mt-3 text-sm">
                    <thead>
                      <tr className="text-xs text-gray-400 uppercase">
                        <th className="text-left py-2">Product</th>
                        <th className="text-right py-2">Qty</th>
                        <th className="text-right py-2">Unit Cost</th>
                        <th className="text-right py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.items?.map((item: any) => (
                        <tr key={item.id} className="border-t border-gray-50">
                          <td className="py-2 text-gray-700">
                            {item.productName}
                          </td>
                          <td className="py-2 text-right text-gray-600">
                            {item.quantity}
                          </td>
                          <td className="py-2 text-right text-gray-600">
                            ৳{parseFloat(item.unitCost).toLocaleString()}
                          </td>
                          <td className="py-2 text-right font-medium text-gray-900">
                            ৳{parseFloat(item.totalCost).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {p.note && (
                    <p className="text-xs text-gray-500 mt-3 bg-gray-50 p-2 rounded">
                      Note: {p.note}
                    </p>
                  )}

                  {/* Actions */}
                  {p.status === "draft" && (
                    <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              "Mark this purchase as received? Stock will be added to your inventory.",
                            )
                          )
                            receiveMutation.mutate(p.id);
                        }}
                        disabled={receiveMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 size={13} />
                        Mark Received
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Cancel this purchase?"))
                            cancelMutation.mutate(p.id);
                        }}
                        disabled={cancelMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 text-xs rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle size={13} />
                        Cancel
                      </button>
                    </div>
                  )}

                  {p.status === "received" && p.receivedAt && (
                    <p className="flex items-center gap-1 text-xs text-green-600 mt-3">
                      <CheckCircle2 size={12} />
                      Received on {new Date(p.receivedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`px-3 py-1 text-sm rounded ${
                page === i + 1
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
