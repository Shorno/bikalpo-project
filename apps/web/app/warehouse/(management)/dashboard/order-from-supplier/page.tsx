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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Warehouse className="h-6 w-6 text-emerald-600" />
            Order from Supplier
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Place flat inventory orders from approved warehouse suppliers.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/warehouse/dashboard/orders">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Supplier Orders
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_1fr_360px]">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Suppliers</h2>
              <Badge variant="outline">{suppliers.length}</Badge>
            </div>
            {suppliersQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : suppliers.length === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-center">
                <Warehouse className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">No approved suppliers</p>
                <Button asChild variant="link" size="sm" className="mt-1">
                  <Link href="/warehouse/dashboard/suppliers">Request access</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {suppliers.map((supplier: any) => {
                  const key = supplier.warehouseSlug || supplier.warehouseId;
                  const active = selectedKey === key || selectedKey === supplier.warehouseId;
                  return (
                    <button
                      key={supplier.connectionId}
                      type="button"
                      onClick={() => selectSupplier(key)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        active
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {supplier.warehouseName || supplier.name || "Unnamed Warehouse"}
                        </span>
                        {active ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        {supplier.warehouseSlug || supplier.warehouseId}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {supplier.productCount} products
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold">
                    {selectedSupplier
                      ? selectedSupplier.warehouseName || selectedSupplier.name
                      : productsQuery.data?.supplier?.warehouseName || "Supplier Catalog"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Same variant and same quantity will transfer on delivery.
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search products or SKU"
                    className="pl-9"
                    disabled={!selectedKey}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {!selectedKey ? (
            <div className="rounded-lg border border-dashed bg-muted/20 py-20 text-center">
              <Warehouse className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="font-medium">Select an approved supplier</p>
            </div>
          ) : productsQuery.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-32 w-full" />
              ))}
            </div>
          ) : productsQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 py-16 text-center">
              <AlertCircle className="mx-auto mb-2 h-9 w-9 text-red-400" />
              <p className="font-medium text-red-700">Failed to load supplier catalog</p>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-lg border bg-white py-16 text-center">
              <Package className="mx-auto mb-2 h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium">No products found</p>
            </div>
          ) : (
            groupedProducts.map(([categoryName, items]) => (
              <section key={categoryName} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700">{categoryName}</h3>
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((item) => {
                    const inCart = cart.find(
                      (cartItem) => cartItem.variantId === item.variantId,
                    );
                    return (
                      <Card key={item.variantId}>
                        <CardContent className="flex gap-3 p-3">
                          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
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
                              <Package className="h-8 w-8 text-muted-foreground/35" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                  {item.product.name}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {item.variant.unitLabel || item.product.size || "Unit"}
                                  {item.variant.sku ? ` / ${item.variant.sku}` : ""}
                                </p>
                              </div>
                              <Badge variant="outline" className="shrink-0">
                                {Number(item.availableQty).toLocaleString("en-BD")}
                              </Badge>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="text-sm font-bold">
                                BDT {Number(item.price).toLocaleString("en-BD")}
                              </span>
                              {inCart ? (
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => updateQuantity(item.variantId, -1)}
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </Button>
                                  <span className="w-8 text-center text-sm font-semibold">
                                    {inCart.quantity}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => updateQuantity(item.variantId, 1)}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <Button type="button" size="sm" onClick={() => addToCart(item)}>
                                  <Plus className="mr-1 h-3.5 w-3.5" />
                                  Add
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Order Cart</h2>
              <Badge variant="outline">{cartCount} units</Badge>
            </div>

            {cart.length === 0 ? (
              <div className="rounded-lg border border-dashed py-10 text-center">
                <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-muted-foreground/35" />
                <p className="text-sm text-muted-foreground">No products selected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.variantId} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} x BDT {Number(item.price).toLocaleString("en-BD")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600"
                        onClick={() => removeFromCart(item.variantId)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.variantId, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold">
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(item.variantId, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold">
                        BDT {(Number(item.price) * item.quantity).toLocaleString("en-BD")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold">BDT {cartTotal.toLocaleString("en-BD")}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Receiving Details</h3>
              <Input
                value={shippingName}
                onChange={(event) => setShippingName(event.target.value)}
                placeholder="Receiving warehouse / contact name"
              />
              <Input
                value={shippingPhone}
                onChange={(event) => setShippingPhone(event.target.value)}
                placeholder="Phone"
              />
              <Input
                value={shippingAddress}
                onChange={(event) => setShippingAddress(event.target.value)}
                placeholder="Address"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={shippingCity}
                  onChange={(event) => setShippingCity(event.target.value)}
                  placeholder="City"
                />
                <Input
                  value={shippingArea}
                  onChange={(event) => setShippingArea(event.target.value)}
                  placeholder="Area"
                />
              </div>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as any)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="cash_on_delivery">Cash on delivery</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
              </select>
              <textarea
                value={customerNote}
                onChange={(event) => setCustomerNote(event.target.value)}
                placeholder="Order note"
                className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <Button
              type="button"
              className="w-full"
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
