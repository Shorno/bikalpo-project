"use client";

import { useState } from "react";
import { orpc } from "@/utils/orpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Warehouse,
    Search,
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    Package,
    Loader2,
    CheckCircle2,
    AlertCircle,
    MapPin,
    ArrowRight,
} from "lucide-react";

type CartItem = {
    variantId: number;
    quantity: number;
    productName: string;
    unitLabel: string;
    weightKg: string;
    retailPrice: string;
    productImage: string;
};

export default function OrderFromWarehousePage() {
    const queryClient = useQueryClient();

    // Step tracking
    const [step, setStep] = useState<"connect" | "browse" | "checkout" | "success">("connect");

    // Connect step
    const [warehouseInput, setWarehouseInput] = useState("");
    const [warehouseSlug, setWarehouseSlug] = useState<string | null>(null);

    // Browse step
    const [search, setSearch] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);

    // Checkout step
    const [shippingName, setShippingName] = useState("");
    const [shippingPhone, setShippingPhone] = useState("");
    const [shippingAddress, setShippingAddress] = useState("");
    const [shippingCity, setShippingCity] = useState("");
    const [customerNote, setCustomerNote] = useState("");

    // Success
    const [orderResult, setOrderResult] = useState<any>(null);

    // Parse slug from URL or direct input
    function parseSlug(input: string): string | null {
        const trimmed = input.trim();
        if (!trimmed) return null;
        if (!trimmed.includes("/")) return trimmed;
        const match = trimmed.match(/\/(?:warehouse|w)\/([^/?#]+)/);
        return match ? match[1] : null;
    }

    // Warehouse info query
    const { data: warehouseInfo, isLoading: loadingWarehouse, error: warehouseError } = useQuery({
        queryKey: ["warehouse", "getStorefrontBySlug", warehouseSlug],
        queryFn: () => orpc.warehouse.getStorefrontBySlug.call({ slug: warehouseSlug! }),
        enabled: !!warehouseSlug,
    });

    // Products query
    const { data: productsData, isLoading: loadingProducts } = useQuery({
        queryKey: ["warehouse", "getStorefrontProducts", warehouseSlug, search],
        queryFn: () =>
            orpc.warehouse.getStorefrontProducts.call({
                slug: warehouseSlug!,
                search: search || undefined,
                page: "1",
                limit: "50",
            }),
        enabled: !!warehouseSlug && step === "browse",
    });

    // Place order mutation
    const orderMutation = useMutation({
        mutationFn: (data: any) => orpc.shopOwner.placeWarehouseOrder.call(data),
        onSuccess: (result) => {
            setOrderResult(result);
            setStep("success");
            setCart([]);
            queryClient.invalidateQueries({ queryKey: ["shopOwner", "getMyWarehouseOrders"] });
        },
    });

    // Cart helpers
    function addToCart(item: CartItem) {
        setCart((prev) => {
            const existing = prev.find((c) => c.variantId === item.variantId);
            if (existing) {
                return prev.map((c) =>
                    c.variantId === item.variantId ? { ...c, quantity: c.quantity + 1 } : c
                );
            }
            return [...prev, item];
        });
    }

    function updateQty(variantId: number, delta: number) {
        setCart((prev) =>
            prev
                .map((c) =>
                    c.variantId === variantId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c
                )
                .filter((c) => c.quantity > 0)
        );
    }

    function removeFromCart(variantId: number) {
        setCart((prev) => prev.filter((c) => c.variantId !== variantId));
    }

    const cartTotal = cart.reduce((sum, c) => sum + Number(c.retailPrice) * c.quantity, 0);
    const products = productsData?.products ?? [];

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Warehouse className="text-blue-600" size={24} />
                    Order from Warehouse
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Connect to a warehouse, browse products, and place your order
                </p>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2 text-xs">
                {["connect", "browse", "checkout", "success"].map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                        <span
                            className={`px-2.5 py-1 rounded-full font-medium ${
                                step === s
                                    ? "bg-blue-100 text-blue-700"
                                    : ["connect", "browse", "checkout", "success"].indexOf(step) > i
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-gray-100 text-gray-400"
                            }`}
                        >
                            {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
                        </span>
                        {i < 3 && <ArrowRight size={12} className="text-gray-300" />}
                    </div>
                ))}
            </div>

            {/* ─── STEP 1: CONNECT ─── */}
            {step === "connect" && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                    <h2 className="text-sm font-semibold text-gray-800">Enter Warehouse URL or Slug</h2>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="e.g. zenstore or /warehouse/zenstore"
                            value={warehouseInput}
                            onChange={(e) => {
                                setWarehouseInput(e.target.value);
                                setWarehouseSlug(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    setWarehouseSlug(parseSlug(warehouseInput));
                                }
                            }}
                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <button
                            onClick={() => setWarehouseSlug(parseSlug(warehouseInput))}
                            disabled={!warehouseInput.trim()}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            Find
                        </button>
                    </div>

                    {loadingWarehouse && warehouseSlug && (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        </div>
                    )}

                    {warehouseError && warehouseSlug && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                            <p className="text-sm text-red-600 font-medium">Warehouse not found</p>
                        </div>
                    )}

                    {warehouseInfo && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Warehouse className="w-6 h-6 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900">
                                        {warehouseInfo.warehouseName || warehouseInfo.name}
                                    </h3>
                                    {warehouseInfo.warehouseAddress && (
                                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                            <MapPin className="w-3 h-3" />
                                            {warehouseInfo.warehouseAddress}
                                        </p>
                                    )}
                                    <p className="text-sm text-blue-700 font-medium mt-1">
                                        {warehouseInfo.productCount} products available
                                    </p>
                                </div>
                                <button
                                    onClick={() => setStep("browse")}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                                >
                                    Browse Products
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── STEP 2: BROWSE & ADD TO CART ─── */}
            {step === "browse" && (
                <div className="space-y-4">
                    {/* Warehouse banner */}
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                        <span className="text-sm text-blue-700 font-medium">
                            🏭 {warehouseInfo?.warehouseName || warehouseInfo?.name}
                        </span>
                        <button
                            onClick={() => { setStep("connect"); setWarehouseSlug(null); setCart([]); }}
                            className="text-xs text-blue-500 hover:underline"
                        >
                            Change warehouse
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative max-w-sm">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        {/* Product list */}
                        <div className="md:col-span-2 space-y-2 max-h-[500px] overflow-y-auto">
                            {loadingProducts ? (
                                <div className="text-center py-8 text-gray-400 text-sm">Loading products...</div>
                            ) : products.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 rounded-lg">
                                    <Package className="mx-auto text-gray-300 mb-2" size={32} />
                                    <p className="text-sm text-gray-500">No products available</p>
                                </div>
                            ) : (
                                products.map((item: any) => {
                                    const product = item.product || item.variant?.product;
                                    const variant = item.variant;
                                    const price = item.retailPrice || variant?.price || "0";
                                    const inCart = cart.find((c) => c.variantId === (variant?.id || item.variantId));

                                    return (
                                        <div
                                            key={item.inventoryId || variant?.id}
                                            className={`flex items-center gap-3 p-3 border rounded-lg transition-colors ${
                                                inCart ? "border-blue-200 bg-blue-50/50" : "border-gray-100 hover:border-gray-200"
                                            }`}
                                        >
                                            {product?.image && (
                                                <img src={product.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-900 truncate">
                                                    {product?.name || "Unknown"}
                                                </div>
                                                <div className="text-[10px] text-gray-400">
                                                    {variant?.unitLabel} — {variant?.weightKg}kg
                                                    {variant?.sku && ` • ${variant.sku}`}
                                                </div>
                                            </div>
                                            <div className="text-sm font-semibold text-emerald-700 shrink-0">
                                                ৳{Number(price).toLocaleString()}
                                            </div>
                                            <div className="shrink-0">
                                                {inCart ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => updateQty(variant?.id || item.variantId, -1)}
                                                            className="w-6 h-6 flex items-center justify-center text-gray-500 hover:bg-gray-200 rounded"
                                                        >
                                                            <Minus size={12} />
                                                        </button>
                                                        <span className="w-6 text-center text-xs font-semibold">{inCart.quantity}</span>
                                                        <button
                                                            onClick={() => updateQty(variant?.id || item.variantId, 1)}
                                                            className="w-6 h-6 flex items-center justify-center text-blue-600 hover:bg-blue-100 rounded"
                                                        >
                                                            <Plus size={12} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() =>
                                                            addToCart({
                                                                variantId: variant?.id || item.variantId,
                                                                quantity: 1,
                                                                productName: product?.name || "Unknown",
                                                                unitLabel: variant?.unitLabel || "",
                                                                weightKg: variant?.weightKg || "",
                                                                retailPrice: price,
                                                                productImage: product?.image || "",
                                                            })
                                                        }
                                                        className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded font-medium hover:bg-blue-100"
                                                    >
                                                        + Add
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Cart sidebar */}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 h-fit sticky top-4">
                            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
                                <ShoppingCart size={14} />
                                Cart ({cart.length} items)
                            </h3>
                            {cart.length === 0 ? (
                                <p className="text-xs text-gray-400 py-4 text-center">Add products to your cart</p>
                            ) : (
                                <>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {cart.map((item) => (
                                            <div key={item.variantId} className="flex items-center justify-between text-xs border-b pb-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-gray-800 truncate">{item.productName}</div>
                                                    <div className="text-gray-400">{item.unitLabel} × {item.quantity}</div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="font-semibold">৳{(Number(item.retailPrice) * item.quantity).toLocaleString()}</span>
                                                    <button
                                                        onClick={() => removeFromCart(item.variantId)}
                                                        className="text-red-400 hover:text-red-600"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between mt-3 pt-2 border-t font-semibold text-sm">
                                        <span>Total</span>
                                        <span className="text-emerald-700">৳{cartTotal.toLocaleString()}</span>
                                    </div>
                                    <button
                                        onClick={() => setStep("checkout")}
                                        className="w-full mt-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                                    >
                                        Proceed to Checkout
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── STEP 3: CHECKOUT ─── */}
            {step === "checkout" && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
                    <h2 className="text-sm font-semibold text-gray-800">Shipping Details</h2>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-xs text-gray-500 font-medium block mb-1">Full Name *</label>
                            <input
                                value={shippingName}
                                onChange={(e) => setShippingName(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                                placeholder="Shop Owner Name"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 font-medium block mb-1">Phone *</label>
                            <input
                                value={shippingPhone}
                                onChange={(e) => setShippingPhone(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                                placeholder="01XXXXXXXXX"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 font-medium block mb-1">Address *</label>
                        <input
                            value={shippingAddress}
                            onChange={(e) => setShippingAddress(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                            placeholder="Full delivery address"
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-xs text-gray-500 font-medium block mb-1">City *</label>
                            <input
                                value={shippingCity}
                                onChange={(e) => setShippingCity(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                                placeholder="Dhaka"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 font-medium block mb-1">Note (optional)</label>
                            <input
                                value={customerNote}
                                onChange={(e) => setCustomerNote(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none"
                                placeholder="Delivery instructions..."
                            />
                        </div>
                    </div>

                    {/* Order Summary */}
                    <div className="border-t pt-4 mt-4">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Order Summary</h3>
                        <div className="space-y-1">
                            {cart.map((item) => (
                                <div key={item.variantId} className="flex justify-between text-sm">
                                    <span className="text-gray-600">{item.productName} × {item.quantity}</span>
                                    <span className="font-medium">৳{(Number(item.retailPrice) * item.quantity).toLocaleString()}</span>
                                </div>
                            ))}
                            <div className="flex justify-between font-semibold text-sm pt-2 border-t mt-2">
                                <span>Total</span>
                                <span className="text-emerald-700">৳{cartTotal.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {orderMutation.isError && (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                            {(orderMutation.error as any)?.message || "Failed to place order"}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep("browse")}
                            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                            Back
                        </button>
                        <button
                            onClick={() => {
                                if (!shippingName || !shippingPhone || !shippingAddress || !shippingCity) {
                                    alert("Please fill in all required shipping fields");
                                    return;
                                }
                                orderMutation.mutate({
                                    warehouseSlug: warehouseSlug!,
                                    items: cart.map((c) => ({
                                        variantId: c.variantId,
                                        quantity: c.quantity,
                                    })),
                                    shippingName,
                                    shippingPhone,
                                    shippingAddress,
                                    shippingCity,
                                    customerNote: customerNote || undefined,
                                });
                            }}
                            disabled={orderMutation.isPending}
                            className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {orderMutation.isPending ? (
                                <><Loader2 size={14} className="animate-spin" /> Placing Order...</>
                            ) : (
                                <>Place Order — ৳{cartTotal.toLocaleString()}</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ─── STEP 4: SUCCESS ─── */}
            {step === "success" && orderResult && (
                <div className="bg-white border border-emerald-200 rounded-xl p-8 text-center">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Order Placed Successfully!</h2>
                    <p className="text-sm text-gray-500 mb-1">{orderResult.message}</p>
                    <p className="text-xs text-gray-400 font-mono mb-6">
                        Order #{orderResult.order?.orderNumber}
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => {
                                setStep("connect");
                                setWarehouseSlug(null);
                                setOrderResult(null);
                            }}
                            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                            New Order
                        </button>
                        <a
                            href="/shop/dashboard/orders"
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                        >
                            View My Orders
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
