"use client";

import { useState } from "react";
import { orpc } from "@/utils/orpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    PackageIcon,
    Plus,
    Search,
    Tag,
    Check,
    ShoppingBag,
    X,
} from "lucide-react";

export default function WarehouseProductsPage() {
    const queryClient = useQueryClient();
    const [showPicker, setShowPicker] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<number | undefined>(undefined);
    const [addingVariant, setAddingVariant] = useState<number | null>(null);
    const [retailPrice, setRetailPrice] = useState("");
    const [initialStock, setInitialStock] = useState("0");

    // Active inventory
    const { data: inventoryData, isLoading: loadingInventory } = useQuery({
        queryKey: ["warehouse", "getMyInventory", { search: "", page: 1, limit: 100 }],
        queryFn: () => orpc.warehouse.getMyInventory.call({ search: "", page: 1, limit: 100 }),
    });

    // Assigned products for picker
    const { data: assignedData, isLoading: loadingAssigned } = useQuery({
        queryKey: ["warehouse", "getAssignedProducts", { search, categoryId: selectedCategory }],
        queryFn: () =>
            orpc.warehouse.getAssignedProducts.call({
                search: search || undefined,
                categoryId: selectedCategory,
            }),
        enabled: showPicker,
    });

    const addMutation = useMutation({
        mutationFn: (data: { variantId: number; retailPrice: string; initialStock: string }) =>
            orpc.warehouse.addToInventory.call(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["warehouse", "getMyInventory"] });
            queryClient.invalidateQueries({ queryKey: ["warehouse", "getAssignedProducts"] });
            setAddingVariant(null);
            setRetailPrice("");
            setInitialStock("0");
        },
    });

    const removeMutation = useMutation({
        mutationFn: (inventoryId: number) =>
            orpc.warehouse.removeFromInventory.call({ inventoryId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["warehouse", "getMyInventory"] });
            queryClient.invalidateQueries({ queryKey: ["warehouse", "getAssignedProducts"] });
        },
    });

    const inventoryItems = inventoryData?.items ?? [];
    const assignedProducts = assignedData?.products ?? [];
    const assignedCategories = assignedData?.assignedCategories ?? [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <PackageIcon className="text-emerald-600" size={24} />
                        My Products
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Products in your warehouse inventory ({inventoryItems.length} items)
                    </p>
                </div>
                <button
                    onClick={() => setShowPicker(!showPicker)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                >
                    <Plus size={16} />
                    Add Product
                </button>
            </div>

            {/* Product Picker */}
            {showPicker && (
                <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-gray-800">
                            Browse Products from Assigned Categories
                        </h2>
                        <button
                            onClick={() => setShowPicker(false)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-3 mb-4">
                        <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                            />
                        </div>
                        <select
                            value={selectedCategory ?? ""}
                            onChange={(e) => setSelectedCategory(e.target.value ? Number(e.target.value) : undefined)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none"
                        >
                            <option value="">All Categories</option>
                            {assignedCategories.map((cat: any) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Product List */}
                    {loadingAssigned ? (
                        <div className="text-center py-8 text-gray-400 text-sm">Loading products...</div>
                    ) : assignedProducts.length === 0 ? (
                        <div className="text-center py-8">
                            <Tag className="mx-auto text-gray-300 mb-3" size={32} />
                            <p className="text-sm text-gray-500 font-medium">No products found</p>
                            <p className="text-xs text-gray-400 mt-1">
                                Ask admin to assign categories to your warehouse, then products from those categories will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="max-h-[400px] overflow-y-auto space-y-3">
                            {assignedProducts.map((product: any) => (
                                <div key={product.id} className="border border-gray-100 rounded-lg p-3">
                                    <div className="flex items-center gap-3 mb-2">
                                        {product.images?.[0] && (
                                            <img
                                                src={product.images[0].imageUrl}
                                                alt={product.name}
                                                className="w-10 h-10 rounded-lg object-cover"
                                            />
                                        )}
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                            <div className="flex gap-2 mt-0.5">
                                                {product.category && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                                        {product.category.name}
                                                    </span>
                                                )}
                                                {product.brand && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded">
                                                        {product.brand.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Variants */}
                                    <div className="ml-0 space-y-1.5">
                                        {product.variants.map((variant: any) => (
                                            <div
                                                key={variant.id}
                                                className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                                                    variant.inInventory
                                                        ? "bg-emerald-50 border border-emerald-100"
                                                        : "bg-gray-50 border border-gray-100"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 flex-1">
                                                    <span className="font-medium text-gray-700">
                                                        {variant.unitLabel} — {variant.weightKg}kg
                                                    </span>
                                                    {variant.sku && (
                                                        <span className="text-gray-400">SKU: {variant.sku}</span>
                                                    )}
                                                    <span className="text-gray-500">
                                                        Base: ৳{Number(variant.price).toLocaleString()}
                                                    </span>
                                                </div>

                                                {variant.inInventory ? (
                                                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                                        <Check size={12} />
                                                        In Inventory
                                                    </span>
                                                ) : addingVariant === variant.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            placeholder="Retail Price"
                                                            value={retailPrice}
                                                            onChange={(e) => setRetailPrice(e.target.value)}
                                                            className="w-24 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                                                        />
                                                        <input
                                                            type="number"
                                                            placeholder="Stock"
                                                            value={initialStock}
                                                            onChange={(e) => setInitialStock(e.target.value)}
                                                            className="w-16 px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                if (!retailPrice) return;
                                                                addMutation.mutate({
                                                                    variantId: variant.id,
                                                                    retailPrice,
                                                                    initialStock: initialStock || "0",
                                                                });
                                                            }}
                                                            disabled={addMutation.isPending || !retailPrice}
                                                            className="px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-medium hover:bg-emerald-700 disabled:opacity-50"
                                                        >
                                                            {addMutation.isPending ? "..." : "Confirm"}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setAddingVariant(null);
                                                                setRetailPrice("");
                                                                setInitialStock("0");
                                                            }}
                                                            className="px-1.5 py-1 text-gray-400 hover:text-gray-600"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setAddingVariant(variant.id);
                                                            setRetailPrice(variant.price);
                                                            setInitialStock("0");
                                                        }}
                                                        className="px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded text-[10px] font-medium hover:bg-emerald-100"
                                                    >
                                                        + Add
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {product.variants.length === 0 && (
                                            <div className="text-xs text-gray-400 py-1 px-3">
                                                No active variants for this product
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Current Inventory */}
            {loadingInventory ? (
                <div className="text-center py-12 text-gray-400 text-sm">Loading inventory...</div>
            ) : inventoryItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center border rounded-lg bg-gray-50/50">
                    <ShoppingBag className="text-gray-300 mb-3" size={48} />
                    <p className="text-gray-500 text-lg font-medium">No products in inventory</p>
                    <p className="text-sm text-gray-400 mt-1 max-w-sm">
                        Click "Add Product" above to browse products from your assigned categories and add them to your warehouse inventory.
                    </p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {/* Table header */}
                    <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-semibold text-gray-400 uppercase">
                        <div className="col-span-4">Product</div>
                        <div className="col-span-2">Base Price</div>
                        <div className="col-span-2">Retail Price</div>
                        <div className="col-span-2">Stock</div>
                        <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {inventoryItems.map((item: any) => {
                        const product = item.variant?.product;
                        const variant = item.variant;
                        return (
                            <div
                                key={item.id}
                                className="grid grid-cols-12 gap-3 items-center bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-300 transition-colors"
                            >
                                {/* Product info */}
                                <div className="col-span-4 flex items-center gap-3">
                                    {product?.images?.[0] && (
                                        <img
                                            src={product.images[0].imageUrl}
                                            alt={product.name}
                                            className="w-10 h-10 rounded-lg object-cover"
                                        />
                                    )}
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 line-clamp-1">
                                            {product?.name || "Unknown"}
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            {variant?.unitLabel} — {variant?.weightKg}kg
                                            {variant?.sku && ` • ${variant.sku}`}
                                        </div>
                                    </div>
                                </div>

                                {/* Base price */}
                                <div className="col-span-2 text-sm text-gray-500">
                                    ৳{Number(variant?.price || 0).toLocaleString()}
                                </div>

                                {/* Retail price */}
                                <div className="col-span-2">
                                    <span className="text-sm font-semibold text-emerald-700">
                                        ৳{Number(item.retailPrice || 0).toLocaleString()}
                                    </span>
                                </div>

                                {/* Stock */}
                                <div className="col-span-2">
                                    <span className={`text-sm font-medium ${
                                        Number(item.availableQty) > 0 ? "text-gray-900" : "text-red-500"
                                    }`}>
                                        {Number(item.availableQty).toLocaleString()}
                                    </span>
                                    <span className="text-xs text-gray-400 ml-1">qty</span>
                                </div>

                                {/* Actions */}
                                <div className="col-span-2 flex justify-end">
                                    <button
                                        onClick={() => {
                                            if (confirm("Remove this product from your inventory?")) {
                                                removeMutation.mutate(item.id);
                                            }
                                        }}
                                        className="text-[10px] px-2 py-1 text-red-500 hover:bg-red-50 border border-red-200 rounded"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
