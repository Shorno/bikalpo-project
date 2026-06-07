"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Warehouse,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

type SupplierProduct = {
  variantId: number;
  availableQty: string;
  price: string;
  product: {
    id: number;
    name: string;
    image: string | null;
    size: string | null;
    categoryName: string;
  };
  variant: {
    unitLabel: string | null;
    sku: string | null;
    packType: string | null;
  };
};

type CartItem = SupplierProduct & {
  quantity: number;
};

export default function WarehouseOrderFromSupplierPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedKey, setSelectedKey] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingArea, setShippingArea] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash_on_delivery" | "bkash" | "nagad" | "bank_transfer" | "card"
  >("cash_on_delivery");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const warehouse = params.get("warehouse");
    if (warehouse) setSelectedKey(warehouse);
  }, []);

  const suppliersQuery = useQuery({
    queryKey: ["warehouse", "getMyWarehouseSuppliers", "active"],
    queryFn: () =>
      orpc.warehouse.getMyWarehouseSuppliers.call({
        status: "active",
        page: 1,
        limit: 100,
      }),
  });

  const productsQuery = useQuery({
    queryKey: ["warehouse", "getWarehouseSupplierProducts", selectedKey, search],
    queryFn: () =>
      orpc.warehouse.getWarehouseSupplierProducts.call({
        warehouseKey: selectedKey,
        search: search || undefined,
        page: 1,
        limit: 100,
      }),
    enabled: !!selectedKey,
  });

  const orderMutation = useMutation({
    mutationFn: () =>
      orpc.warehouse.placeWarehouseSupplierOrder.call({
        warehouseKey: selectedKey,
        items: cart.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
        shippingName,
        shippingPhone,
        shippingAddress,
        shippingCity,
        shippingArea: shippingArea || undefined,
        customerNote: customerNote || undefined,
        paymentMethod,
      }),
    onSuccess: (result) => {
      toast.success(result.message || "Supplier order placed");
      setCart([]);
      queryClient.invalidateQueries({ queryKey: ["warehouse", "getMyOrders"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "getMyWarehouseSuppliers"] });
      router.push("/warehouse/dashboard/orders");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to place supplier order");
    },
  });

  const suppliers = suppliersQuery.data?.items ?? [];
  const products = (productsQuery.data?.products ?? []) as SupplierProduct[];
  const selectedSupplier = suppliers.find(
    (supplier: any) =>
      supplier.warehouseSlug === selectedKey || supplier.warehouseId === selectedKey,
  );

  useEffect(() => {
    if (!selectedKey && suppliers.length > 0) {
      const firstSupplier = suppliers[0];
      const key = firstSupplier.warehouseSlug || firstSupplier.warehouseId;
      setSelectedKey(key);
    }
  }, [suppliers, selectedKey]);

  const groupedProducts = useMemo(() => {
    const groups = new Map<string, SupplierProduct[]>();
    for (const item of products) {
      const key = item.product.categoryName || "Uncategorized";
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return Array.from(groups.entries());
  }, [products]);

  const cartTotal = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function selectSupplier(warehouseKey: string) {
    setSelectedKey(warehouseKey);
    setCart([]);
    setSearch("");
  }

  function addToCart(item: SupplierProduct) {
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.variantId === item.variantId);
      const availableQty = Number(item.availableQty || 0);
      if (existing) {
        return current.map((cartItem) =>
          cartItem.variantId === item.variantId
            ? {
                ...cartItem,
                quantity: Math.min(availableQty, cartItem.quantity + 1),
              }
            : cartItem,
        );
      }
      return [...current, { ...item, quantity: 1 }];
    });
  }

  function updateQuantity(variantId: number, delta: number) {
    setCart((current) =>
      current
        .map((item) => {
          if (item.variantId !== variantId) return item;
          const nextQty = item.quantity + delta;
          const maxQty = Number(item.availableQty || 0);
          return { ...item, quantity: Math.max(0, Math.min(maxQty, nextQty)) };
        })
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(variantId: number) {
    setCart((current) => current.filter((item) => item.variantId !== variantId));
  }

  function submitOrder() {
    if (!selectedKey) {
      toast.error("Select a supplier warehouse first");
      return;
    }
    if (cart.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    if (!shippingName || !shippingPhone || !shippingAddress || !shippingCity) {
      toast.error("Fill in receiving warehouse contact and address");
      return;
    }
    orderMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 tracking-tight">
            <Warehouse className="h-6 w-6 text-emerald-600" />
            Order from Supplier
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Place flat inventory orders from approved warehouse suppliers.
          </p>
        </div>
        <Button asChild variant="outline" className="shadow-xs">
          <Link href="/warehouse/dashboard/orders">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Supplier Orders
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Catalog Section */}
        <div className="space-y-5">
          {/* Header Panel without card wrapper borders to remove nested card feel */}
          <div className="bg-white border border-gray-100/80 rounded-xl p-4 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {suppliers.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="supplier-select" className="text-sm font-semibold text-gray-700 shrink-0">
                      Supplier:
                    </Label>
                    <select
                      id="supplier-select"
                      value={selectedKey}
                      onChange={(e) => selectSupplier(e.target.value)}
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring max-w-[200px]"
                    >
                      {suppliers.map((supplier: any) => {
                        const key = supplier.warehouseSlug || supplier.warehouseId;
                        return (
                          <option key={supplier.connectionId} value={key}>
                            {supplier.warehouseName || supplier.name || "Unnamed Warehouse"}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ) : (
                  <h2 className="text-sm font-semibold text-gray-800 truncate">
                    {selectedSupplier
                      ? selectedSupplier.warehouseName || selectedSupplier.name
                      : productsQuery.data?.supplier?.warehouseName || "Supplier Catalog"}
                  </h2>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Same variant and same quantity will transfer on delivery.
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products or SKU"
                  className="pl-9 bg-gray-50/30"
                  disabled={!selectedKey}
                />
              </div>
            </div>
          </div>

          {!selectedKey ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-muted/10 py-20 text-center shadow-2xs">
              <Warehouse className="mx-auto mb-3 h-12 w-12 text-muted-foreground/25" />
              <p className="font-medium text-gray-500">Select an approved supplier</p>
            </div>
          ) : productsQuery.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : productsQuery.isError ? (
            <div className="rounded-xl border border-red-100 bg-red-50/50 py-16 text-center">
              <AlertCircle className="mx-auto mb-2 h-9 w-9 text-red-400" />
              <p className="font-medium text-red-700">Failed to load supplier catalog</p>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white py-16 text-center shadow-2xs">
              <Package className="mx-auto mb-2 h-10 w-10 text-muted-foreground/25" />
              <p className="font-medium text-gray-500">No products found</p>
            </div>
          ) : (
            groupedProducts.map(([categoryName, items]) => (
              <section key={categoryName} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{categoryName}</h3>
                  <div className="h-px flex-1 bg-gray-200/60" />
                  <span className="text-xs font-semibold text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {items.map((item) => {
                    const inCart = cart.find(
                      (cartItem) => cartItem.variantId === item.variantId,
                    );
                    return (
                      <div
                        key={item.variantId}
                        className="flex gap-3 p-3.5 rounded-xl border border-gray-100 bg-white shadow-2xs hover:shadow-xs hover:border-gray-200/80 transition-all duration-200"
                      >
                        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-muted/20">
                          {item.product.image ? (
                            <Image
                              src={item.product.image}
                              alt={item.product.name}
                              width={80}
                              height={80}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-8 w-8 text-muted-foreground/30" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col justify-between">
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-gray-800">
                                {item.product.name}
                              </p>
                              <Badge variant="outline" className="shrink-0 font-medium text-gray-600 bg-gray-50/50">
                                {Number(item.availableQty).toLocaleString("en-BD")}
                              </Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground truncate">
                              {item.variant.unitLabel || item.product.size || "Unit"}
                              {item.variant.sku ? ` / ${item.variant.sku}` : ""}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-gray-900">
                              BDT {Number(item.price).toLocaleString("en-BD")}
                            </span>
                            {inCart ? (
                              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200/60 rounded-lg p-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-md hover:bg-white hover:shadow-2xs text-gray-600"
                                  onClick={() => updateQuantity(item.variantId, -1)}
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <input
                                  type="number"
                                  min={1}
                                  max={Number(item.availableQty || 0)}
                                  defaultValue={inCart.quantity}
                                  key={`${item.variantId}-${inCart.quantity}`}
                                  onBlur={(event) => {
                                    const parsed = parseInt(event.target.value, 10);
                                    if (!isNaN(parsed)) {
                                      const maxQty = Number(item.availableQty || 0);
                                      const nextQty = Math.max(1, Math.min(maxQty, parsed));
                                      updateQuantity(item.variantId, nextQty - inCart.quantity);
                                    } else {
                                      event.target.value = String(inCart.quantity);
                                    }
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.currentTarget.blur();
                                    }
                                  }}
                                  className="w-10 text-center text-sm font-semibold bg-transparent focus:outline-none focus:ring-0 border-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-md hover:bg-white hover:shadow-2xs text-gray-600"
                                  onClick={() => updateQuantity(item.variantId, 1)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => addToCart(item)}
                                className="shadow-2xs h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Add
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {/* Cart Panel */}
        <Card className="h-fit sticky top-6 shadow-xs border-gray-100/80 bg-white">
          <CardContent className="space-y-5 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Order Cart</h2>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCart([])}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50/50 rounded-md transition-colors"
                  >
                    Clear
                  </Button>
                )}
                <Badge variant="outline" className="font-semibold">{cartCount} units</Badge>
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center bg-gray-50/30">
                <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No products selected</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1 thin-scrollbar">
                {cart.map((item) => (
                  <div key={item.variantId} className="rounded-lg border border-gray-100 p-3 bg-gray-50/30 hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.quantity} x BDT {Number(item.price).toLocaleString("en-BD")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                        onClick={() => removeFromCart(item.variantId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 bg-white border border-gray-200/60 rounded-md p-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-sm hover:bg-gray-50 text-gray-500"
                          onClick={() => updateQuantity(item.variantId, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <input
                          type="number"
                          min={1}
                          max={Number(item.availableQty || 0)}
                          defaultValue={item.quantity}
                          key={`${item.variantId}-${item.quantity}`}
                          onBlur={(event) => {
                            const parsed = parseInt(event.target.value, 10);
                            if (!isNaN(parsed)) {
                              const maxQty = Number(item.availableQty || 0);
                              const nextQty = Math.max(1, Math.min(maxQty, parsed));
                              updateQuantity(item.variantId, nextQty - item.quantity);
                            } else {
                              event.target.value = String(item.quantity);
                            }
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                          }}
                          className="w-10 text-center text-sm font-semibold bg-transparent focus:outline-none focus:ring-0 border-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-sm hover:bg-gray-50 text-gray-500"
                          onClick={() => updateQuantity(item.variantId, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        BDT {(Number(item.price) * item.quantity).toLocaleString("en-BD")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Subtotal</span>
                <span className="font-bold text-gray-900">BDT {cartTotal.toLocaleString("en-BD")}</span>
              </div>
            </div>

            {/* Receiving Details with Accessibility Labels */}
            <div className="space-y-3.5 border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-800">Receiving Details</h3>
              
              <div className="space-y-1.5">
                <Label htmlFor="shippingName" className="text-xs font-semibold text-gray-600">
                  Receiving Warehouse / Contact Name
                </Label>
                <Input
                  id="shippingName"
                  value={shippingName}
                  onChange={(event) => setShippingName(event.target.value)}
                  placeholder="Receiving warehouse name or contact"
                  className="bg-gray-50/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="shippingPhone" className="text-xs font-semibold text-gray-600">
                  Phone Number
                </Label>
                <Input
                  id="shippingPhone"
                  value={shippingPhone}
                  onChange={(event) => setShippingPhone(event.target.value)}
                  placeholder="Contact phone number"
                  className="bg-gray-50/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="shippingAddress" className="text-xs font-semibold text-gray-600">
                  Delivery Address
                </Label>
                <Input
                  id="shippingAddress"
                  value={shippingAddress}
                  onChange={(event) => setShippingAddress(event.target.value)}
                  placeholder="Street address, building, floor"
                  className="bg-gray-50/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="shippingCity" className="text-xs font-semibold text-gray-600">
                    City
                  </Label>
                  <Input
                    id="shippingCity"
                    value={shippingCity}
                    onChange={(event) => setShippingCity(event.target.value)}
                    placeholder="City name"
                    className="bg-gray-50/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shippingArea" className="text-xs font-semibold text-gray-600">
                    Area
                  </Label>
                  <Input
                    id="shippingArea"
                    value={shippingArea}
                    onChange={(event) => setShippingArea(event.target.value)}
                    placeholder="Area name"
                    className="bg-gray-50/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="paymentMethod" className="text-xs font-semibold text-gray-600">
                  Payment Method
                </Label>
                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as any)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
                >
                  <option value="cash_on_delivery">Cash on delivery</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="customerNote" className="text-xs font-semibold text-gray-600">
                  Order Note (Optional)
                </Label>
                <textarea
                  id="customerNote"
                  value={customerNote}
                  onChange={(event) => setCustomerNote(event.target.value)}
                  placeholder="Add a note for the supplier..."
                  className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring focus:border-ring"
                />
              </div>
            </div>

            <Button
              type="button"
              className="w-full shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
              disabled={orderMutation.isPending}
              onClick={submitOrder}
            >
              {orderMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Place Supplier Order
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
