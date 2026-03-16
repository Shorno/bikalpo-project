"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpDown,
  BoxesIcon,
  Check,
  Pencil,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

export default function WarehouseInventoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editQty, setEditQty] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse", "getMyInventory", { search, page: 1, limit: 200 }],
    queryFn: () =>
      orpc.warehouse.getMyInventory.call({ search, page: 1, limit: 200 }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      inventoryId: number;
      retailPrice?: string;
      availableQty?: string;
    }) => orpc.warehouse.updateInventoryItem.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["warehouse", "getMyInventory"],
      });
      setEditingId(null);
    },
  });

  const items = data?.items ?? [];

  // Stats
  const totalProducts = items.length;
  const totalStock = items.reduce(
    (sum: number, i: any) => sum + Number(i.availableQty || 0),
    0,
  );
  const lowStockCount = items.filter(
    (i: any) =>
      Number(i.availableQty || 0) <= 5 && Number(i.availableQty || 0) > 0,
  ).length;
  const outOfStockCount = items.filter(
    (i: any) => Number(i.availableQty || 0) === 0,
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BoxesIcon className="text-amber-600" size={24} />
          Inventory
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your warehouse stock levels and pricing
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-400 uppercase font-semibold">
            Products
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {totalProducts}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <div className="text-xs text-gray-400 uppercase font-semibold">
            Total Stock
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {totalStock.toLocaleString()}
          </div>
        </div>
        <div className="bg-white border border-amber-200 rounded-lg px-4 py-3 bg-amber-50/50">
          <div className="text-xs text-amber-600 uppercase font-semibold">
            Low Stock
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {lowStockCount}
          </div>
        </div>
        <div className="bg-white border border-red-200 rounded-lg px-4 py-3 bg-red-50/50">
          <div className="text-xs text-red-500 uppercase font-semibold">
            Out of Stock
          </div>
          <div className="text-2xl font-bold text-red-500 mt-1">
            {outOfStockCount}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Search by product name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Loading inventory...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-gray-50/50">
          <BoxesIcon className="text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 text-lg font-medium">
            No inventory items
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Go to{" "}
            <a
              href="/warehouse/dashboard/products"
              className="text-amber-600 underline font-medium"
            >
              Products
            </a>{" "}
            to add products to your inventory.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Product / Variant
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Category
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Base Price
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Retail Price
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  <span className="flex items-center justify-end gap-1">
                    <ArrowUpDown size={10} /> Stock
                  </span>
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => {
                const product = item.variant?.product;
                const variant = item.variant;
                const qty = Number(item.availableQty || 0);
                const isEditing = editingId === item.id;
                const isLowStock = qty > 0 && qty <= 5;
                const isOutOfStock = qty === 0;

                return (
                  <tr
                    key={item.id}
                    className="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Product */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product?.images?.[0] && (
                          <Image
                            src={product.images[0].imageUrl}
                            alt={product?.name}
                            width={36}
                            height={36}
                            className="w-9 h-9 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <div className="font-medium text-gray-900 line-clamp-1">
                            {product?.name || "Unknown"}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {variant?.unitLabel} — {variant?.weightKg}kg
                            {variant?.sku && ` • ${variant.sku}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {product?.category?.name || "—"}
                    </td>

                    {/* Base Price */}
                    <td className="px-4 py-3 text-right text-gray-500">
                      ৳{Number(variant?.price || 0).toLocaleString()}
                    </td>

                    {/* Retail Price (editable) */}
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-24 px-2 py-1 text-xs text-right border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      ) : (
                        <span className="font-semibold text-emerald-700">
                          ৳{Number(item.retailPrice || 0).toLocaleString()}
                        </span>
                      )}
                    </td>

                    {/* Stock (editable) */}
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="w-20 px-2 py-1 text-xs text-right border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      ) : (
                        <span
                          className={`font-medium ${isOutOfStock ? "text-red-500" : isLowStock ? "text-amber-600" : "text-gray-900"}`}
                        >
                          {qty.toLocaleString()}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      {isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full font-medium">
                          <AlertTriangle size={10} /> Out
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full font-medium">
                          <AlertTriangle size={10} /> Low
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full font-medium">
                          In Stock
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              updateMutation.mutate({
                                inventoryId: item.id,
                                retailPrice: editPrice,
                                availableQty: editQty,
                              });
                            }}
                            disabled={updateMutation.isPending}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setEditPrice(item.retailPrice || "0");
                            setEditQty(item.availableQty || "0");
                          }}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="Edit price & stock"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
