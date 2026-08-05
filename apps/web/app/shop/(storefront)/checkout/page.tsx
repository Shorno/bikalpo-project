"use client";

import type { Address, PaymentMethod } from "@bikalpo-project/db/schema";
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  MapPinned,
  Phone,
  ShoppingBag,
  Smartphone,
  Store,
  User,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AddressSelector } from "@/components/checkout/address-selector";
import {
  CheckoutSummary,
  formatCheckoutPrice,
} from "@/components/checkout/checkout-summary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useEstimatedDeliveryCost,
  usePlaceOpenOrder,
  usePlaceOrder,
} from "@/hooks/use-customer-api";
import { useCart } from "@/hooks/use-orpc-cart";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const AddressPicker = dynamic(
  () =>
    import("@/components/shared/address-picker").then(
      (mod) => mod.AddressPicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[clamp(240px,32vw,320px)] animate-pulse items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground motion-reduce:animate-none">
        Loading map...
      </div>
    ),
  },
);

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

const OPEN_ORDER_STEPS = [
  {
    icon: MapPinned,
    label: "Delivery details",
    description: "Confirm where the complete order should arrive.",
    meta: "You are here",
    tone: "emerald",
  },
  {
    icon: Store,
    label: "Retailers prepare offers",
    description: "Nearby retailers verify stock and submit one full offer.",
    meta: "5 minutes",
    tone: "amber",
  },
  {
    icon: BadgeCheck,
    label: "Compare and choose",
    description: "Review frozen totals and explicitly accept one retailer.",
    meta: "5 minutes",
    tone: "slate",
  },
] as const;

const DIRECT_PAYMENT_OPTIONS = [
  {
    value: "cash_on_delivery",
    label: "Cash on delivery",
    description: "Pay when your retailer order arrives.",
    icon: Banknote,
    activeClass: "border-emerald-500 bg-emerald-50",
    iconClass: "bg-emerald-100 text-emerald-700",
  },
  {
    value: "bkash",
    label: "bKash",
    description: "Complete payment with your bKash account.",
    icon: Smartphone,
    activeClass: "border-pink-400 bg-pink-50",
    iconClass: "bg-pink-100 text-pink-700",
  },
  {
    value: "nagad",
    label: "Nagad",
    description: "Complete payment with your Nagad account.",
    icon: Smartphone,
    activeClass: "border-orange-400 bg-orange-50",
    iconClass: "bg-orange-100 text-orange-700",
  },
] as const satisfies ReadonlyArray<{
  value: PaymentMethod;
  label: string;
  description: string;
  icon: typeof Banknote;
  activeClass: string;
  iconClass: string;
}>;

function OpenOrderProcess() {
  return (
    <section
      aria-labelledby="open-order-process-title"
      className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p
            id="open-order-process-title"
            className="text-sm font-semibold text-slate-900"
          >
            How your Open Order works
          </p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            One nearby retailer must be able to supply every requested item.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
          <Clock3 className="size-3.5" aria-hidden="true" />
          Two short decision windows
        </div>
      </div>

      <ol className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {OPEN_ORDER_STEPS.map((step, index) => {
          const Icon = step.icon;
          const toneClasses =
            step.tone === "emerald"
              ? "bg-emerald-600 text-white"
              : step.tone === "amber"
                ? "bg-amber-100 text-amber-800"
                : "bg-slate-100 text-slate-600";
          const metaClasses =
            step.tone === "emerald"
              ? "text-emerald-700"
              : step.tone === "amber"
                ? "text-amber-700"
                : "text-slate-500";

          return (
            <li key={step.label} className="flex gap-3 px-4 py-4 sm:px-5">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${toneClasses}`}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Step {index + 1}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${metaClasses}`}
                  >
                    {step.meta}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {step.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function CustomerCheckoutPage() {
  const router = useRouter();
  const {
    mode,
    items,
    totalItems,
    totalPrice,
    clearCart,
    updateQuantity,
    updateCylinderSaleMode,
    removeItem,
    isLoading: cartLoading,
  } = useCart();
  const isOpenOrder = mode === "open_order";
  const { data: session } = authClient.useSession();
  const placeOrderMutation = usePlaceOrder();
  const placeOpenOrderMutation = usePlaceOpenOrder();
  const isSubmitting =
    placeOrderMutation.isPending || placeOpenOrderMutation.isPending;

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash_on_delivery");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(
    null,
  );

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    area: "",
    postalCode: "",
    customerNote: "",
    lat: "",
    lng: "",
  });

  // Pre-fill form with user data
  useEffect(() => {
    if (session?.user) {
      setFormData((prev) => ({
        ...prev,
        name: session.user.name || "",
        email: session.user.email || "",
        phone: (session.user as { phoneNumber?: string }).phoneNumber || "",
      }));
    }
  }, [session]);

  // Estimate delivery cost when area changes
  const { data: deliveryCostData } = useEstimatedDeliveryCost(
    formData.area || undefined,
  );
  const shippingCost =
    items.length > 0 ? (deliveryCostData?.deliveryCost ?? 0) : 0;

  // Handle address selection
  const handleAddressSelect = useCallback(
    (address: Address | null) => {
      if (address) {
        setSelectedAddressId(address.id);
        setFormData({
          name: address.recipientName,
          phone: address.phone,
          email: "",
          address: address.address,
          city: address.city,
          area: address.area || "",
          postalCode: address.postalCode || "",
          customerNote: "",
          lat: address.lat || "",
          lng: address.lng || "",
        });
      } else {
        setSelectedAddressId(null);
        // Clear form for new address entry
        setFormData({
          name: session?.user?.name || "",
          phone: (session?.user as { phoneNumber?: string })?.phoneNumber || "",
          email: session?.user?.email || "",
          address: "",
          city: "",
          area: "",
          postalCode: "",
          customerNote: "",
          lat: "",
          lng: "",
        });
      }
    },
    [session],
  );

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error("Please enter your name");
      return false;
    }
    if (!formData.phone.trim()) {
      toast.error("Please enter your phone number");
      return false;
    }
    if (!formData.address.trim()) {
      toast.error("Please enter your address");
      return false;
    }
    if (!formData.city) {
      toast.error("Please select your city");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!session?.user) {
      toast.error("Please login to place an order");
      router.push("/login");
      return;
    }

    if (!validateForm()) return;

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (items.some((item) => item.cylinderSale?.selectionValid === false)) {
      toast.error("Review the Exchange or New choice for your cylinder items");
      return;
    }

    try {
      const result = await placeOrderMutation.mutateAsync({
        shippingInfo: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          address: formData.address,
          city: formData.city,
          area: formData.area || undefined,
          postalCode: formData.postalCode || undefined,
          customerNote: formData.customerNote || undefined,
          lat: formData.lat || undefined,
          lng: formData.lng || undefined,
        },
        paymentMethod,
      });

      if (result.order?.orderNumber) {
        toast.success("Order placed successfully!");
        clearCart();
        router.push(`/order-confirmation/${result.order.orderNumber}`);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      toast.error(message);
    }
  };

  const handleOpenOrder = async () => {
    if (!session?.user) {
      toast.error("Please login to place an order");
      router.push("/login");
      return;
    }
    if (!validateForm()) return;
    if (!formData.lat || !formData.lng) {
      toast.error("Please pin your location on the map for open orders");
      return;
    }
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    try {
      const result = await placeOpenOrderMutation.mutateAsync({
        shippingInfo: {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          address: formData.address,
          city: formData.city,
          area: formData.area || undefined,
          postalCode: formData.postalCode || undefined,
          customerNote: formData.customerNote || undefined,
          lat: formData.lat,
          lng: formData.lng,
        },
      });
      if (result.order?.id) {
        toast.success("Finding the best shops for you!");
        clearCart();
        router.push(`/open-orders/${result.order.id}`);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      toast.error(message);
    }
  };

  if (cartLoading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-slate-50 px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-sm">
          <Loader2
            className="size-5 animate-spin text-emerald-600 motion-reduce:animate-none"
            aria-hidden="true"
          />
          Preparing your checkout…
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] bg-slate-50 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <ShoppingBag className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-bold text-slate-950">
            Your cart is empty
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Add some products to your cart before checking out.
          </p>
          <Button
            asChild
            className="mt-6 h-11 bg-emerald-600 px-5 text-white hover:bg-emerald-700 focus-visible:ring-emerald-600"
          >
            <Link href="/products">Browse products</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-12">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-6">
          <Link
            href="/products"
            className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-slate-500 transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Continue shopping
          </Link>
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
              {isOpenOrder ? "Open Order" : "Direct retailer order"}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {isOpenOrder
                ? "Request offers from nearby retailers"
                : "Complete your order"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              {isOpenOrder
                ? "Confirm the delivery details below, then nearby retailers with every requested item can prepare a complete offer. No payment is collected now."
                : "Confirm where the retailer should deliver your order and choose your preferred payment method."}
            </p>
          </div>
        </header>

        {isOpenOrder && <OpenOrderProcess />}

        {mode == null && (
          <Card className="mb-6 gap-0 border-amber-200 bg-amber-50 py-0 shadow-none ring-0">
            <CardContent className="flex flex-col gap-4 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <p className="leading-6">
                This legacy cart mixes purchase sources. Clear it, then add
                either public catalog items or items from one retailer.
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 border-amber-300 bg-white text-amber-950 hover:bg-amber-100 focus-visible:ring-amber-600"
                onClick={() => clearCart()}
              >
                Clear legacy cart
              </Button>
            </CardContent>
          </Card>
        )}

        <form
          id="checkout-form"
          onSubmit={
            isOpenOrder
              ? (event) => {
                  event.preventDefault();
                  void handleOpenOrder();
                }
              : handleSubmit
          }
        >
          <div className="mb-5 lg:hidden">
            <CheckoutSummary
              presentation="compact"
              open={summaryOpen}
              onOpenChange={setSummaryOpen}
              items={items}
              totalItems={totalItems}
              totalPrice={totalPrice}
              shippingCost={shippingCost}
              isOpenOrder={isOpenOrder}
              isPending={isSubmitting}
              cartLoading={cartLoading}
              modeValid={mode != null}
              onUpdateQuantity={updateQuantity}
              onUpdateCylinderSaleMode={updateCylinderSaleMode}
              onRemoveItem={removeItem}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="min-w-0 space-y-5">
              <Card className="gap-0 rounded-2xl border-slate-200 bg-white py-0 shadow-sm ring-0">
                <div className="flex items-start gap-3 border-b border-slate-100 p-5 sm:p-6">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <MapPin className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">
                      Delivery address and contact
                    </h2>
                    <p className="mt-1 text-sm leading-5 text-slate-500">
                      Choose a saved address or enter the recipient details
                      manually.
                    </p>
                  </div>
                </div>
                <CardContent className="space-y-6 p-5 sm:p-6">
                  <AddressSelector
                    selectedAddressId={selectedAddressId}
                    onSelectAddress={handleAddressSelect}
                  />

                  <div className="border-t border-slate-100 pt-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Contact details
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          We use these details only to coordinate this delivery.
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate-400">
                        * Required
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label
                          htmlFor="name"
                          className="text-sm font-semibold text-slate-800"
                        >
                          Full name <span className="text-red-600">*</span>
                        </Label>
                        <div className="relative">
                          <User
                            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                            aria-hidden="true"
                          />
                          <Input
                            id="name"
                            name="name"
                            autoComplete="name"
                            placeholder="Recipient name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className="h-11 border-slate-200 bg-white pl-10 text-sm focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="phone"
                          className="text-sm font-semibold text-slate-800"
                        >
                          Phone <span className="text-red-600">*</span>
                        </Label>
                        <div className="relative">
                          <Phone
                            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                            aria-hidden="true"
                          />
                          <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            autoComplete="tel"
                            placeholder="01XXXXXXXXX"
                            value={formData.phone}
                            onChange={handleInputChange}
                            className="h-11 border-slate-200 bg-white pl-10 text-sm focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2 sm:col-span-2">
                        <Label
                          htmlFor="address"
                          className="text-sm font-semibold text-slate-800"
                        >
                          Street address <span className="text-red-600">*</span>
                        </Label>
                        <Textarea
                          id="address"
                          name="address"
                          autoComplete="street-address"
                          placeholder="House, road, block, area…"
                          value={formData.address}
                          onChange={handleInputChange}
                          rows={3}
                          className="min-h-24 resize-y border-slate-200 bg-white text-sm focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20"
                          required
                        />
                        <p className="text-xs leading-5 text-slate-500">
                          Include a house or building number and a nearby
                          landmark when useful.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="city"
                          className="text-sm font-semibold text-slate-800"
                        >
                          City <span className="text-red-600">*</span>
                        </Label>
                        <Select
                          value={formData.city}
                          onValueChange={(value) =>
                            setFormData((prev) => ({ ...prev, city: value }))
                          }
                        >
                          <SelectTrigger
                            id="city"
                            className="h-11 w-full border-slate-200 bg-white text-sm focus:ring-emerald-600/20"
                          >
                            <SelectValue placeholder="Select city" />
                          </SelectTrigger>
                          <SelectContent>
                            {CITIES.map((city) => (
                              <SelectItem key={city} value={city}>
                                {city}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label
                          htmlFor="area"
                          className="text-sm font-semibold text-slate-800"
                        >
                          Area
                        </Label>
                        <Input
                          id="area"
                          name="area"
                          autoComplete="address-level3"
                          placeholder="Neighbourhood or area"
                          value={formData.area}
                          onChange={handleInputChange}
                          className="h-11 border-slate-200 bg-white text-sm focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-6">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <Label
                        htmlFor="customerNote"
                        className="text-sm font-semibold text-slate-800"
                      >
                        Delivery note
                      </Label>
                      <span className="text-xs font-medium text-slate-400">
                        Optional
                      </span>
                    </div>
                    <Textarea
                      id="customerNote"
                      name="customerNote"
                      placeholder="Gate instructions, delivery timing, or another helpful detail…"
                      value={formData.customerNote}
                      onChange={handleInputChange}
                      rows={2}
                      className="min-h-20 resize-y border-slate-200 bg-slate-50/60 text-sm focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 rounded-2xl border-slate-200 bg-white py-0 shadow-sm ring-0">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl",
                        formData.lat && formData.lng
                          ? "bg-emerald-50 text-emerald-700"
                          : isOpenOrder
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600",
                      )}
                    >
                      <MapPinned className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-slate-950">
                        Precise delivery pin
                      </h2>
                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        Tap the map or use GPS to confirm the exact delivery
                        point.
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                      formData.lat && formData.lng
                        ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                        : isOpenOrder
                          ? "bg-amber-50 text-amber-800 ring-amber-200"
                          : "bg-slate-100 text-slate-600 ring-slate-200",
                    )}
                  >
                    {formData.lat && formData.lng ? (
                      <BadgeCheck className="size-3.5" aria-hidden="true" />
                    ) : (
                      <MapPin className="size-3.5" aria-hidden="true" />
                    )}
                    {formData.lat && formData.lng
                      ? "Location confirmed"
                      : isOpenOrder
                        ? "Required"
                        : "Optional"}
                  </span>
                </div>
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <AddressPicker
                    lat={formData.lat}
                    lng={formData.lng}
                    onLocationChange={(lat, lng) =>
                      setFormData((prev) => ({ ...prev, lat, lng }))
                    }
                    onAddressResolved={(resolved) => {
                      const addressParts = [
                        resolved.road,
                        resolved.area,
                        resolved.district,
                      ].filter(Boolean);
                      const builtAddress =
                        addressParts.length > 0
                          ? addressParts.join(", ")
                          : resolved.displayName
                              .split(",")
                              .slice(0, 3)
                              .join(",")
                              .trim();

                      const nominatimLocation = [
                        resolved.city,
                        resolved.district,
                        resolved.state,
                      ]
                        .join(" ")
                        .toLowerCase();
                      const matchedCity = CITIES.find((city) =>
                        nominatimLocation.includes(city.toLowerCase()),
                      );

                      setFormData((prev) => ({
                        ...prev,
                        address: builtAddress || prev.address,
                        area: resolved.area || prev.area,
                        city: matchedCity || prev.city,
                        postalCode: resolved.postalCode || prev.postalCode,
                      }));
                    }}
                    height="clamp(240px, 32vw, 320px)"
                  />

                  <div
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-5",
                      formData.lat && formData.lng
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : isOpenOrder
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-slate-200 bg-slate-50 text-slate-600",
                    )}
                  >
                    {formData.lat && formData.lng ? (
                      <BadgeCheck
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <MapPin
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <p>
                      {formData.lat && formData.lng
                        ? "Your delivery point is confirmed. You can move the pin if it needs adjustment."
                        : isOpenOrder
                          ? "A saved or pinned coordinate is required so we can verify retailers within the 10 km service radius."
                          : "Adding a pin helps the retailer find your address, but it is not required for this direct order."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {!isOpenOrder && (
                <Card className="gap-0 rounded-2xl border-slate-200 bg-white py-0 shadow-sm ring-0">
                  <div className="flex items-start gap-3 border-b border-slate-100 p-5 sm:p-6">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <CreditCard className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold text-slate-950">
                        Payment method
                      </h2>
                      <p className="mt-1 text-sm leading-5 text-slate-500">
                        Choose how you want to pay this retailer.
                      </p>
                    </div>
                  </div>
                  <CardContent className="p-5 sm:p-6">
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(value) =>
                        setPaymentMethod(value as PaymentMethod)
                      }
                      className="grid gap-3"
                    >
                      {DIRECT_PAYMENT_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const isSelected = paymentMethod === option.value;

                        return (
                          <div
                            key={option.value}
                            className={cn(
                              "flex min-h-16 items-center gap-3 rounded-xl border p-3.5 transition-colors motion-reduce:transition-none",
                              isSelected
                                ? option.activeClass
                                : "border-slate-200 bg-white hover:bg-slate-50",
                            )}
                          >
                            <RadioGroupItem
                              value={option.value}
                              id={`payment-${option.value}`}
                              className="text-emerald-600 focus-visible:ring-emerald-600"
                            />
                            <Label
                              htmlFor={`payment-${option.value}`}
                              className="flex flex-1 cursor-pointer items-center gap-3"
                            >
                              <span
                                className={cn(
                                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                                  option.iconClass,
                                )}
                              >
                                <Icon className="size-4" aria-hidden="true" />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-slate-900">
                                  {option.label}
                                </span>
                                <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                                  {option.description}
                                </span>
                              </span>
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  </CardContent>
                </Card>
              )}
            </div>

            <aside className="hidden lg:block">
              <CheckoutSummary
                presentation="desktop"
                items={items}
                totalItems={totalItems}
                totalPrice={totalPrice}
                shippingCost={shippingCost}
                isOpenOrder={isOpenOrder}
                isPending={isSubmitting}
                cartLoading={cartLoading}
                modeValid={mode != null}
                onUpdateQuantity={updateQuantity}
                onUpdateCylinderSaleMode={updateCylinderSaleMode}
                onRemoveItem={removeItem}
              />
            </aside>
          </div>
        </form>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-3">
          <div className="flex items-center justify-between gap-4 sm:block">
            <span className="text-xs font-medium text-slate-500 sm:block">
              {isOpenOrder ? "Reference subtotal" : "Order total"}
            </span>
            <span className="text-lg font-bold tabular-nums text-slate-950 sm:mt-0.5 sm:block">
              {formatCheckoutPrice(
                isOpenOrder ? totalPrice : totalPrice + shippingCost,
              )}
            </span>
          </div>
          <Button
            type="submit"
            form="checkout-form"
            className="h-12 w-full bg-emerald-600 px-5 font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-emerald-600 sm:w-auto sm:min-w-80"
            disabled={isSubmitting || mode == null}
          >
            {(isOpenOrder ? placeOpenOrderMutation : placeOrderMutation)
              .isPending ? (
              <>
                <Loader2
                  className="mr-2 size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                {isOpenOrder ? "Checking nearby stock…" : "Processing…"}
              </>
            ) : (
              <>
                {isOpenOrder ? (
                  <Store className="mr-2 size-4" aria-hidden="true" />
                ) : (
                  <BadgeCheck className="mr-2 size-4" aria-hidden="true" />
                )}
                {isOpenOrder
                  ? "Request offers from nearby retailers"
                  : "Place order"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
