"use client";

import type { FulfillmentMode } from "@bikalpo-project/db/fulfillment";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type CheckoutInvoiceContact,
  DeliveryModeSelector,
  InvoiceContactFields,
  PaymentPlanSelector,
  PromotionCodeControl,
} from "@/components/checkout/checkout-controls";
import { WarehouseProductGrid } from "@/components/features/warehouse/warehouse-product-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

const CITIES = [
  "Dhaka",
  "Chittagong",
  "Sylhet",
  "Rajshahi",
  "Khulna",
  "Barisal",
  "Rangpur",
  "Mymensingh",
  "Comilla",
  "Gazipur",
  "Narayanganj",
];

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col bg-white rounded-xl border border-zinc-200 overflow-hidden h-full">
      {/* Image Skeleton */}
      <div className="aspect-[4/3] bg-zinc-50 relative border-b border-zinc-100 overflow-hidden shrink-0">
        <Skeleton className="w-full h-full rounded-none" />
      </div>

      {/* Info details */}
      <div className="flex flex-1 flex-col p-4">
        <div>
          <Skeleton className="h-3 w-14 mb-2" />
          <Skeleton className="h-4 w-5/6 mb-1.5" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        {/* Variant chips */}
        <div className="mt-3 flex gap-1.5">
          <Skeleton className="h-7 w-14 rounded-md" />
          <Skeleton className="h-7 w-14 rounded-md" />
        </div>

        {/* Price + MOQ */}
        <div className="mt-3 pt-3 border-t border-zinc-100 flex items-end justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <Skeleton className="flex-1 h-9 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function WarehouseStorefrontPage() {
  const { slug } = useParams<{ slug: string }>();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Buyer connection context
  const { data: sessionData, isPending: sessionPending } =
    authClient.useSession();
  const isWarehouseBuyer = sessionData?.user?.role === "warehouse";
  const isRetailerBuyer = sessionData?.user?.role === "shop_owner";

  // Check connection status
  const { data: supplierConnections, isLoading: connectionsLoading } = useQuery(
    {
      ...orpc.warehouse.getMyWarehouseSuppliers.queryOptions({
        input: { status: "active", search: slug, page: 1, limit: 10 },
      }),
      enabled: isWarehouseBuyer,
    },
  );

  const activeConnection = supplierConnections?.items?.find(
    (item: any) => item.warehouseSlug === slug || item.warehouseId === slug,
  );
  const isConnectedSupplier = !!activeConnection;

  // Grid mode evaluation
  const gridMode: "default" | "retailer" | "w2w" | "view-only" =
    isWarehouseBuyer
      ? isConnectedSupplier
        ? "w2w"
        : "view-only"
      : isRetailerBuyer
        ? "retailer"
        : "default";
  const hasCartAccess = gridMode === "w2w" || gridMode === "retailer";

  // Cart key in local storage
  const cartKey = `${
    gridMode === "retailer"
      ? "retailer-warehouse-cart"
      : "warehouse-supplier-cart"
  }:${sessionData?.user?.id}:${slug}`;
  const [cart, setCart] = useState<any[]>([]);

  // Load cart state
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      sessionData?.user?.id &&
      hasCartAccess
    ) {
      const stored = localStorage.getItem(cartKey);
      if (stored) {
        try {
          setCart(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      } else {
        setCart([]);
      }
    }
  }, [cartKey, sessionData?.user?.id, hasCartAccess]);

  // Save cart state
  const saveCart = (newCart: any[]) => {
    setCart(newCart);
    if (typeof window !== "undefined") {
      localStorage.setItem(cartKey, JSON.stringify(newCart));
    }
  };

  // Cart mutators
  const addToCart = (item: any) => {
    const existing = cart.find(
      (i) =>
        i.variantId === item.selectedVariant?.variantId ||
        i.variantId === item.id,
    );
    const availableQty = Number(item.availableQty || 0);
    const moq = Number(item.moq || 1);
    const variantId = item.selectedVariant?.variantId || item.id;
    const inventoryId = item.inventoryId || item.id;

    if (existing) {
      const nextQty = Math.min(availableQty, existing.quantity + 1);
      saveCart(
        cart.map((i) =>
          i.variantId === variantId ? { ...i, quantity: nextQty } : i,
        ),
      );
      toast.success(`Updated ${item.name} quantity to ${nextQty}`);
    } else {
      const qty = Math.min(availableQty, moq);
      const newItem = {
        variantId,
        inventoryId,
        productName: item.name,
        image: item.image || "",
        sku: item.sku || "",
        unitLabel: item.unit || "Unit",
        price: item.pricePerUnit || "0",
        availableQty,
        quantity: qty,
        fulfillmentMode: item.selectedVariant?.fulfillmentMode,
        supplyMode: item.selectedVariant?.fulfillmentMode,
        targetVariantId: item.selectedVariant?.targetVariantId ?? null,
      };
      saveCart([...cart, newItem]);
      toast.success(`Added ${item.name} to cart`);
    }
  };

  const updateQuantity = (variantId: number, delta: number) => {
    saveCart(
      cart
        .map((i) => {
          if (i.variantId !== variantId) return i;
          const availableQty = Number(i.availableQty || 0);
          const nextQty = Math.max(
            0,
            Math.min(availableQty, i.quantity + delta),
          );
          return { ...i, quantity: nextQty };
        })
        .filter((i) => i.quantity > 0),
    );
  };

  const removeFromCart = (variantId: number) => {
    saveCart(cart.filter((i) => i.variantId !== variantId));
  };

  const clearCart = () => {
    saveCart([]);
  };

  // Shipping Form State
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingArea, setShippingArea] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash_on_delivery" | "bkash" | "nagad" | "bank_transfer" | "card"
  >("cash_on_delivery");
  const [deliveryMode, setDeliveryMode] = useState<"self_pickup" | "courier">(
    "courier",
  );
  const [paymentPlan, setPaymentPlan] = useState<
    "pay_now" | "partial" | "pay_later"
  >("pay_later");
  const [partialAmount, setPartialAmount] = useState("");
  const [promotionInput, setPromotionInput] = useState("");
  const [promotionCode, setPromotionCode] = useState<string | null>(null);
  const [invoiceContact, setInvoiceContact] = useState<CheckoutInvoiceContact>({
    name: "",
    phone: "",
    email: "",
  });
  const checkoutIdempotencyKey = useRef<string | null>(null);

  // Prefill details from session
  useEffect(() => {
    if (sessionData?.user) {
      const u = sessionData.user as any;
      setShippingName(u.shopName || u.warehouseName || u.name || "");
      setShippingPhone(u.phoneNumber || u.phone || "");
      setShippingAddress(u.shopAddress || u.warehouseAddress || "");
      setInvoiceContact({
        name: u.shopName || u.warehouseName || u.name || "",
        phone: u.phoneNumber || u.phone || "",
        email: u.email || "",
      });
    }
  }, [sessionData]);

  // Order mutation. Retailers and warehouses share the cart UI, but each role
  // keeps its existing server-side ordering flow and authorization checks.
  const orderMutation = useMutation({
    mutationFn: (input: {
      warehouseKey: string;
      items: {
        variantId: number;
        quantity: number;
        fulfillmentMode?: FulfillmentMode;
        supplyMode?: FulfillmentMode;
        targetVariantId?: number | null;
      }[];
      shippingName: string;
      shippingPhone: string;
      shippingAddress: string;
      shippingCity: string;
      shippingArea?: string;
      customerNote?: string;
      paymentMethod:
        | "cash_on_delivery"
        | "bkash"
        | "nagad"
        | "bank_transfer"
        | "card";
      checkout: {
        deliveryMode: "self_pickup" | "courier";
        paymentPlan: "pay_now" | "partial" | "pay_later";
        partialAmount?: number;
        promotionCode?: string;
        quoteVersion: string;
        quoteExpiresAt: Date;
        idempotencyKey: string;
        invoiceContact: CheckoutInvoiceContact;
      };
    }) => {
      const { warehouseKey, ...orderInput } = input;

      return isRetailerBuyer
        ? orpc.shopOwner.placeWarehouseOrder.call({
            ...orderInput,
            warehouseSlug: warehouseKey,
          })
        : orpc.warehouse.placeWarehouseSupplierOrder.call(input);
    },
    onSuccess: (result) => {
      toast.success(result.message || "Order placed successfully!");
      checkoutIdempotencyKey.current = null;
      clearCart();
      setIsCartOpen(false);

      if (isRetailerBuyer) {
        queryClient.invalidateQueries({
          queryKey: orpc.shopOwner.getConnectedWarehouses.key(),
        });
        queryClient.invalidateQueries({
          queryKey: orpc.shopOwner.getMyWarehouseOrders.key(),
        });

        const shopDashboardUrl =
          process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL ||
          "http://shop.bikalpo.localhost:3001";
        window.location.href = `${shopDashboardUrl}/dashboard/orders`;
        return;
      }

      queryClient.invalidateQueries({
        queryKey: orpc.warehouse.getMyWarehouseSuppliers.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.warehouse.getMyOrders.key(),
      });

      const warehouseDashboardUrl =
        process.env.NEXT_PUBLIC_WAREHOUSE_SUBDOMAIN_URL ||
        "http://warehouse.bikalpo.localhost:3001";
      window.location.href = `${warehouseDashboardUrl}/warehouse/dashboard/orders`;
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to place supplier order");
    },
  });

  const handlePlaceOrder = () => {
    if (
      !shippingName.trim() ||
      !shippingPhone.trim() ||
      !shippingAddress.trim() ||
      !shippingCity.trim()
    ) {
      toast.error(
        "Please fill in all receiving contact and delivery address details",
      );
      return;
    }
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (!checkoutQuote || checkoutQuoteQuery.isFetching) {
      toast.error("Wait for the supplier totals to finish updating");
      return;
    }
    if (!invoiceContact.name.trim() || !invoiceContact.phone.trim()) {
      toast.error("Invoice name and phone are required");
      return;
    }
    if (
      paymentPlan === "partial" &&
      (!Number(partialAmount) || Number(partialAmount) >= checkoutGrandTotal)
    ) {
      toast.error("Enter a partial payment below the order total");
      return;
    }
    checkoutIdempotencyKey.current ??= crypto.randomUUID();
    orderMutation.mutate({
      warehouseKey: slug,
      items: cart.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
        fulfillmentMode: i.fulfillmentMode,
        supplyMode: i.supplyMode,
        targetVariantId: i.targetVariantId,
      })),
      shippingName,
      shippingPhone,
      shippingAddress,
      shippingCity,
      shippingArea: shippingArea || undefined,
      customerNote: customerNote || undefined,
      paymentMethod,
      checkout: {
        deliveryMode,
        paymentPlan,
        partialAmount:
          paymentPlan === "partial" ? Number(partialAmount) : undefined,
        promotionCode: promotionCode || undefined,
        quoteVersion: checkoutQuote.version,
        quoteExpiresAt: new Date(checkoutQuote.expiresAt),
        idempotencyKey: checkoutIdempotencyKey.current,
        invoiceContact,
      },
    });
  };

  // Fetch storefront details
  const {
    data: warehouse,
    isLoading: warehouseLoading,
    error: warehouseError,
  } = useQuery(
    orpc.warehouse.getStorefrontBySlug.queryOptions({
      input: { slug },
    }),
  );

  // Fetch categories
  const { data: categoriesData } = useQuery(
    orpc.warehouse.getStorefrontCategories.queryOptions({
      input: { slug },
    }),
  );

  // Fetch products
  const { data: productsData, isLoading: productsLoading } = useQuery(
    orpc.warehouse.getStorefrontProducts.queryOptions({
      input: {
        slug,
        category: selectedCategory || undefined,
        search: search || undefined,
        page: String(page),
        limit: "12",
      },
    }),
  );

  const cartTotal = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    );
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const checkoutQuoteQuery = useQuery({
    ...orpc.warehouse.getStorefrontCheckoutQuote.queryOptions({
      input: {
        slug,
        lines: cart.map((item) => ({
          key: isRetailerBuyer
            ? `${item.variantId}:${item.supplyMode || item.fulfillmentMode || "direct"}:${item.targetVariantId ?? "none"}`
            : `${item.variantId}:direct:none`,
          quantity: item.quantity,
          unitPrice: Number(item.price),
        })),
        deliveryMode,
        paymentPlan,
        partialAmount:
          paymentPlan === "partial" && Number(partialAmount) > 0
            ? Number(partialAmount)
            : undefined,
        promotionCode: promotionCode || undefined,
      },
    }),
    enabled:
      hasCartAccess &&
      cart.length > 0 &&
      (paymentPlan !== "partial" || Number(partialAmount) > 0),
  });
  const checkoutQuote = checkoutQuoteQuery.data?.quote;

  useEffect(() => {
    const configuration = warehouse?.checkoutConfiguration;
    if (!configuration) return;
    if (deliveryMode === "courier" && !configuration.allowCourier) {
      setDeliveryMode("self_pickup");
    } else if (
      deliveryMode === "self_pickup" &&
      !configuration.allowSelfPickup
    ) {
      setDeliveryMode("courier");
    }
  }, [deliveryMode, warehouse]);

  if (
    warehouseLoading ||
    sessionPending ||
    (isWarehouseBuyer && connectionsLoading)
  ) {
    return (
      <div className="min-h-screen bg-zinc-50/50">
        <div className="bg-white border-b border-zinc-200">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Skeleton className="h-8 w-48 md:w-64" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-2.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
            <Skeleton className="h-11 w-full rounded-lg" />
            <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
              <Skeleton className="h-8 w-16 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 pb-16">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (warehouseError || !warehouse) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Warehouse Not Found
        </h1>
        <p className="text-gray-600">
          This warehouse does not exist or is no longer available.
        </p>
      </div>
    );
  }

  const categories = categoriesData?.categories || [];
  const products = productsData?.products || [];
  const pagination = productsData?.pagination;
  const checkoutConfiguration = warehouse.checkoutConfiguration;
  const checkoutTax =
    checkoutQuote?.totals.taxAmount ??
    Math.round(cartTotal * checkoutConfiguration.taxPercentage) / 100;
  const checkoutShipping =
    checkoutQuote?.totals.shippingFee ??
    (deliveryMode === "courier" ? checkoutConfiguration.defaultShippingFee : 0);
  const checkoutDiscount = checkoutQuote?.totals.totalDiscount ?? 0;
  const checkoutGrandTotal =
    checkoutQuote?.totals.grandTotal ??
    cartTotal - checkoutDiscount + checkoutTax + checkoutShipping;
  const checkoutPayment =
    checkoutQuote?.initialPaymentAmount ??
    (paymentPlan === "pay_now"
      ? checkoutGrandTotal
      : paymentPlan === "partial"
        ? Number(partialAmount || 0)
        : 0);

  const updatePaymentPlan = (value: "pay_now" | "partial" | "pay_later") => {
    setPaymentPlan(value);
    if (value === "pay_later") setPaymentMethod("cash_on_delivery");
    if (value !== "pay_later" && paymentMethod === "cash_on_delivery") {
      setPaymentMethod("bank_transfer");
    }
  };

  const renderCartItems = () => {
    if (cart.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center bg-zinc-50 border border-dashed rounded-xl p-4">
          <ShoppingCart className="w-10 h-10 text-zinc-300 mb-2" />
          <p className="text-sm font-semibold text-zinc-500">Cart is empty</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            Add supplier variants to begin
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 thin-scrollbar">
        {cart.map((item) => (
          <div
            key={item.variantId}
            className="flex gap-3 p-3 rounded-lg border border-zinc-100 bg-white/50 hover:bg-white hover:shadow-sm transition-all duration-200"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <p className="text-xs font-semibold text-zinc-800 line-clamp-1">
                  {item.productName}
                </p>
                <button
                  onClick={() => removeFromCart(item.variantId)}
                  className="text-zinc-400 hover:text-red-500 p-0.5 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                {item.unitLabel} {item.sku ? ` · ${item.sku}` : ""}
              </p>
              <div className="flex items-center justify-between mt-2.5 gap-2">
                <div className="flex items-center border border-zinc-200 rounded-md bg-white p-0.5">
                  <button
                    onClick={() => updateQuantity(item.variantId, -1)}
                    className="h-6 w-6 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 rounded"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-7 text-center text-xs font-mono font-bold text-zinc-800">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.variantId, 1)}
                    className="h-6 w-6 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 rounded"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-xs font-bold font-mono text-zinc-900">
                  ৳ {(Number(item.price) * item.quantity).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCheckoutForm = () => {
    return (
      <div className="space-y-4 pt-4 border-t border-zinc-200">
        <div className="space-y-2">
          <Label className="text-xs font-bold text-zinc-600">
            Delivery Method
          </Label>
          <DeliveryModeSelector
            value={deliveryMode}
            onChange={setDeliveryMode}
            allowSelfPickup={checkoutConfiguration.allowSelfPickup}
            allowCourier={checkoutConfiguration.allowCourier}
          />
        </div>

        <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-widest flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-emerald-600" />
          Receiving Details
        </h3>

        <div className="space-y-1.5">
          <Label
            htmlFor="shippingName"
            className="text-xs font-bold text-zinc-600"
          >
            {gridMode === "retailer"
              ? "Receiving Shop / Contact Name *"
              : "Receiving Warehouse / Contact Name *"}
          </Label>
          <Input
            id="shippingName"
            value={shippingName}
            onChange={(e) => setShippingName(e.target.value)}
            placeholder={
              gridMode === "retailer"
                ? "Receiving shop name or contact"
                : "Receiving warehouse name or contact"
            }
            className="h-9 text-xs bg-zinc-50/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="shippingPhone"
            className="text-xs font-bold text-zinc-600"
          >
            Phone Number *
          </Label>
          <Input
            id="shippingPhone"
            value={shippingPhone}
            onChange={(e) => setShippingPhone(e.target.value)}
            placeholder="Contact phone number"
            className="h-9 text-xs bg-zinc-50/50"
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="shippingAddress"
            className="text-xs font-bold text-zinc-600"
          >
            Delivery Address *
          </Label>
          <Textarea
            id="shippingAddress"
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            placeholder="Street address, building, floor..."
            className="text-xs bg-zinc-50/50 min-h-[60px] resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label
              htmlFor="shippingCity"
              className="text-xs font-bold text-zinc-600"
            >
              City *
            </Label>
            <Select
              value={shippingCity || undefined}
              onValueChange={setShippingCity}
            >
              <SelectTrigger
                id="shippingCity"
                className="h-9 w-full bg-zinc-50/50 text-xs border-zinc-200 focus:ring-1 focus:ring-zinc-900"
              >
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((city) => (
                  <SelectItem key={city} value={city} className="text-xs">
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="shippingArea"
              className="text-xs font-bold text-zinc-600"
            >
              Area (Optional)
            </Label>
            <Input
              id="shippingArea"
              value={shippingArea}
              onChange={(e) => setShippingArea(e.target.value)}
              placeholder="e.g. Dhanmondi"
              className="h-9 text-xs bg-zinc-50/50"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold text-zinc-600">
            Payment Terms
          </Label>
          <PaymentPlanSelector
            value={paymentPlan}
            onChange={updatePaymentPlan}
            allowPartial
            partialAmount={partialAmount}
            onPartialAmountChange={setPartialAmount}
            grandTotal={checkoutGrandTotal}
          />
          {paymentPlan === "pay_later" &&
            checkoutConfiguration.wholesaleCreditDays > 0 && (
              <p className="text-xs text-zinc-500">
                Payment is due within{" "}
                {checkoutConfiguration.wholesaleCreditDays} days.
              </p>
            )}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="paymentMethod"
            className="text-xs font-bold text-zinc-600"
          >
            Payment Method *
          </Label>
          <Select
            value={paymentMethod}
            onValueChange={(value) => {
              const method = value as typeof paymentMethod;
              setPaymentMethod(method);
              if (method === "cash_on_delivery") setPaymentPlan("pay_later");
            }}
          >
            <SelectTrigger
              id="paymentMethod"
              className="h-9 w-full bg-zinc-50/50 text-xs border-zinc-200 focus:ring-1 focus:ring-zinc-900"
            >
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="cash_on_delivery"
                className="text-xs"
                disabled={paymentPlan !== "pay_later"}
              >
                Cash on delivery
              </SelectItem>
              <SelectItem value="bkash" className="text-xs">
                bKash
              </SelectItem>
              <SelectItem value="nagad" className="text-xs">
                Nagad
              </SelectItem>
              <SelectItem value="bank_transfer" className="text-xs">
                Bank transfer
              </SelectItem>
              <SelectItem value="card" className="text-xs">
                Card
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <PromotionCodeControl
          value={promotionInput}
          appliedCode={checkoutQuote?.promotionCode}
          error={
            checkoutQuoteQuery.error instanceof Error
              ? checkoutQuoteQuery.error.message
              : null
          }
          isApplying={checkoutQuoteQuery.isFetching}
          onChange={(value) => {
            setPromotionInput(value);
            setPromotionCode(null);
          }}
          onApply={() => setPromotionCode(promotionInput.trim().toUpperCase())}
          onClear={() => {
            setPromotionCode(null);
            setPromotionInput("");
          }}
        />

        <div className="space-y-2">
          <Label className="text-xs font-bold text-zinc-600">
            Invoice Contact
          </Label>
          <InvoiceContactFields
            value={invoiceContact}
            onChange={setInvoiceContact}
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="customerNote"
            className="text-xs font-bold text-zinc-600"
          >
            Order Note (Optional)
          </Label>
          <Textarea
            id="customerNote"
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            placeholder="Special instructions for the supplier..."
            className="text-xs bg-zinc-50/50 min-h-[50px] resize-none"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50/50">
      {/* Warehouse Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-16 h-16 bg-zinc-100 rounded-xl flex items-center justify-center shrink-0 border border-zinc-200">
                <Warehouse className="w-7 h-7 text-zinc-700" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight text-zinc-900 truncate">
                    {warehouse.warehouseName || warehouse.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    Verified
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-2 text-sm text-zinc-500">
                  {warehouse.warehouseAddress && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span className="truncate">
                        {warehouse.warehouseAddress}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Package className="w-4 h-4 text-zinc-400" />
                    <span className="text-zinc-800 font-medium tabular-nums">
                      {warehouse.productCount}
                    </span>
                    <span>products available</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Access alert block */}
      {isWarehouseBuyer && !isConnectedSupplier && (
        <div className="container mx-auto px-4 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900">
                  Supplier connection required
                </h4>
                <p className="text-sm text-amber-700 mt-0.5">
                  Request access from this warehouse in your suppliers list
                  before you can order.
                </p>
              </div>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-300 bg-white text-amber-800 hover:bg-amber-100 hover:text-amber-900"
            >
              <Link href="/warehouse/dashboard/suppliers">
                Go to Suppliers List
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Search & Filter Bar */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 h-11 border-zinc-200 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-400 rounded-lg bg-zinc-50/50 text-sm"
              />
            </div>

            {/* Category Tabs */}
            {categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
                <span className="text-xs font-medium text-zinc-400 mr-0.5">
                  Categories
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(null);
                    setPage(1);
                  }}
                  className={`h-8 px-3 inline-flex items-center rounded-lg border text-xs font-medium transition-colors ${
                    selectedCategory === null
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "border-zinc-200 text-zinc-600 bg-white hover:bg-zinc-50"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => {
                  const active = selectedCategory === cat.slug;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.slug);
                        setPage(1);
                      }}
                      className={`h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        active
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "border-zinc-200 text-zinc-600 bg-white hover:bg-zinc-50"
                      }`}
                    >
                      {cat.name}
                      <span
                        className={`tabular-nums ${
                          active ? "text-white/60" : "text-zinc-400"
                        }`}
                      >
                        {cat.productCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <WarehouseProductGrid
            products={products}
            isLoading={productsLoading}
            warehouseSlug={slug}
            pagination={pagination}
            onPageChange={setPage}
            mode={gridMode}
            cart={cart}
            onAddToCart={addToCart}
            onUpdateQuantity={updateQuantity}
          />
        </div>
      </div>

      {/* Floating Cart Button & Drawer for connected business buyers */}
      {hasCartAccess && cart.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <SheetTrigger asChild>
              <Button
                className={`text-white font-bold py-6 px-5 rounded-full shadow-2xl flex items-center gap-3 border-none transition-all duration-300 hover:scale-105 ${
                  gridMode === "retailer"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                <div className="relative">
                  <ShoppingCart className="w-5 h-5" />
                  <span
                    className={`absolute -top-2.5 -right-2.5 bg-zinc-950 text-white font-mono text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border ${
                      gridMode === "retailer"
                        ? "border-blue-600"
                        : "border-emerald-600"
                    }`}
                  >
                    {cartCount}
                  </span>
                </div>
                <span className="font-mono">
                  ৳ {cartTotal.toLocaleString("en-BD")}
                </span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-full sm:max-w-md md:max-w-lg h-full p-0 flex flex-col"
            >
              <SheetHeader className="p-4 border-b border-zinc-100 flex-shrink-0">
                <SheetTitle className="flex items-center justify-between">
                  <span className="text-zinc-800 flex items-center gap-2">
                    <ShoppingCart
                      className={`w-4 h-4 ${
                        gridMode === "retailer"
                          ? "text-blue-600"
                          : "text-emerald-600"
                      }`}
                    />
                    {gridMode === "retailer" ? "Order Cart" : "Supplier Cart"}
                  </span>
                  <div className="flex items-center gap-2">
                    {cart.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearCart}
                        className="h-7 px-2 text-[10px] text-zinc-400 hover:text-red-600 hover:bg-red-50"
                      >
                        Clear Cart
                      </Button>
                    )}
                    <Badge variant="outline" className="font-mono text-xs">
                      {cartCount} units
                    </Badge>
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {renderCartItems()}
                {renderCheckoutForm()}
              </div>

              {/* Sticky Drawer Footer with Totals and Order Placement CTA */}
              {cart.length > 0 && (
                <div className="p-4 border-t border-zinc-200 bg-white flex-shrink-0 space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-semibold">
                        Subtotal
                      </span>
                      <span className="font-bold text-zinc-900 font-mono">
                        ৳ {cartTotal.toLocaleString()}
                      </span>
                    </div>
                    {checkoutDiscount > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 font-semibold">
                          Discount
                        </span>
                        <span className="font-bold text-emerald-700 font-mono">
                          -৳ {checkoutDiscount.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {checkoutTax > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 font-semibold">Tax</span>
                        <span className="font-bold text-zinc-900 font-mono">
                          ৳ {checkoutTax.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {checkoutShipping > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-500 font-semibold">
                          Shipping
                        </span>
                        <span className="font-bold text-zinc-900 font-mono">
                          ৳ {checkoutShipping.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t">
                      <span className="text-zinc-500 font-semibold">
                        Order Total
                      </span>
                      <span
                        className={`font-extrabold text-sm font-mono ${
                          gridMode === "retailer"
                            ? "text-blue-600"
                            : "text-emerald-600"
                        }`}
                      >
                        ৳ {checkoutGrandTotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-semibold">
                        Pay now
                      </span>
                      <span className="font-bold text-emerald-700 font-mono">
                        ৳ {checkoutPayment.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-semibold">Due</span>
                      <span className="font-bold text-amber-700 font-mono">
                        ৳{" "}
                        {Math.max(
                          0,
                          checkoutGrandTotal - checkoutPayment,
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    className={`w-full text-white font-semibold py-5 gap-2 rounded-lg transition-colors border-none shadow-sm h-10 text-xs ${
                      gridMode === "retailer"
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                    disabled={
                      orderMutation.isPending ||
                      checkoutQuoteQuery.isFetching ||
                      !checkoutQuote
                    }
                    onClick={handlePlaceOrder}
                  >
                    {orderMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    {gridMode === "retailer"
                      ? "Place Order"
                      : "Place Supplier Order"}
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      )}
    </div>
  );
}
