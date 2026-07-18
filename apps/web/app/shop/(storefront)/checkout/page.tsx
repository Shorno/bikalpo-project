"use client";

import type { Address, PaymentMethod } from "@bikalpo-project/db/schema";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { AddressSelector } from "@/components/checkout/address-selector";
import { CartRetailerLabel } from "@/components/layout/cart-retailer-label";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
      <div className="flex h-[220px] animate-pulse items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
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

type CheckoutCartItem = ReturnType<typeof useCart>["items"][number];
type RequiredField = "name" | "phone" | "address" | "city";
type FieldErrors = Partial<Record<RequiredField, string>>;

const requiredFields: RequiredField[] = ["name", "phone", "address", "city"];

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(price);
}

export default function CustomerCheckoutPage() {
  const router = useRouter();
  const {
    items,
    totalItems,
    totalPrice,
    clearCart,
    updateQuantity,
    removeItem,
    isLoading: cartLoading,
  } = useCart();
  const { data: session } = authClient.useSession();
  const placeOrderMutation = usePlaceOrder();
  const placeOpenOrderMutation = usePlaceOpenOrder();
  const isSubmitting =
    placeOrderMutation.isPending || placeOpenOrderMutation.isPending;
  const cartSourceKeys = new Set(items.map((item) => item.shopId ?? null));
  const hasCartSourceConflict = cartSourceKeys.size > 1;
  const hasRetailerSource = items.some((item) => !!item.shopId);
  const checkoutRetailerName = items.find((item) => item.shopId)?.shopName;

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash_on_delivery");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(
    null,
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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

  useEffect(() => {
    if (session?.user) {
      setFormData((previous) => ({
        ...previous,
        name: session.user.name || "",
        email: session.user.email || "",
        phone: (session.user as { phoneNumber?: string }).phoneNumber || "",
      }));
    }
  }, [session]);

  const { data: deliveryCostData } = useEstimatedDeliveryCost(
    formData.area || undefined,
  );
  const shippingCost =
    items.length > 0 ? (deliveryCostData?.deliveryCost ?? 0) : 0;

  const clearFieldError = (field: string) => {
    if (!requiredFields.includes(field as RequiredField)) return;
    setFieldErrors((previous) => {
      if (!previous[field as RequiredField]) return previous;
      const next = { ...previous };
      delete next[field as RequiredField];
      return next;
    });
  };

  const handleAddressSelect = useCallback(
    (address: Address | null) => {
      setFieldErrors({});
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
          lat: "",
          lng: "",
        });
        return;
      }

      setSelectedAddressId(null);
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
    },
    [session],
  );

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    clearFieldError(name);
  };

  const validateForm = () => {
    const nextErrors: FieldErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Enter the recipient's name.";
    if (!formData.phone.trim()) nextErrors.phone = "Enter a phone number.";
    if (!formData.address.trim()) {
      nextErrors.address = "Enter the delivery address.";
    }
    if (!formData.city) nextErrors.city = "Select a delivery city.";

    setFieldErrors(nextErrors);
    const firstError = requiredFields.find((field) => nextErrors[field]);
    if (firstError) {
      requestAnimationFrame(() => {
        document.getElementById(firstError)?.focus();
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!session?.user) {
      toast.error("Please login to place an order");
      router.push("/login");
      return;
    }
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    if (hasCartSourceConflict) {
      toast.error(
        "Your cart must contain products from one retailer only, or only products without a retailer.",
      );
      return;
    }
    if (!validateForm()) return;

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
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    }
  };

  const revealLocation = () => {
    setLocationOpen(true);
    requestAnimationFrame(() => {
      const locationPanel = document.getElementById("delivery-location");
      locationPanel?.scrollIntoView({ behavior: "smooth", block: "center" });
      locationPanel?.focus({ preventScroll: true });
    });
  };

  const handleOpenOrder = async () => {
    if (!session?.user) {
      toast.error("Please login to place an order");
      router.push("/login");
      return;
    }
    if (!validateForm()) return;
    if (!formData.lat || !formData.lng) {
      revealLocation();
      toast.error("Pin your delivery location to find the best shop");
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
        paymentMethod,
      });

      if (result.order?.id) {
        toast.success("Finding the best shops for you!");
        clearCart();
        router.push(`/shop/open-order-tracker/${result.order.id}`);
      }
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    }
  };

  if (cartLoading) return <CheckoutSkeleton />;

  if (items.length === 0) {
    return <EmptyCheckout />;
  }

  const total = totalPrice + shippingCost;
  const cartActions = {
    onUpdateQuantity: updateQuantity,
    onRemove: removeItem,
    disabled: cartLoading || isSubmitting,
  };

  return (
    <div className="min-h-screen bg-[oklch(0.975_0.006_264)] pb-28 lg:pb-12">
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-7 max-w-2xl">
          <Link
            href="/products"
            className="mb-4 inline-flex min-h-8 items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Continue shopping
          </Link>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
            Checkout
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Confirm the delivery details, choose how to pay, and review the
            order before placing it.
          </p>
        </header>

        {hasCartSourceConflict ? (
          <div
            className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3.5 text-sm text-foreground"
            role="alert"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">Cart sources need attention</p>
              <p className="mt-0.5 leading-5 text-muted-foreground">
                Keep products from one retailer only, or only products without a
                retailer, before placing the order.
              </p>
            </div>
          </div>
        ) : hasRetailerSource ? (
          <div className="mb-5 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
              <ShoppingBag className="size-4" aria-hidden="true" />
            </span>
            <p className="text-muted-foreground">
              Ordering directly from{" "}
              <span className="font-semibold text-foreground">
                {checkoutRetailerName || "the selected retailer"}
              </span>
            </p>
          </div>
        ) : null}

        <form id="checkout-form" onSubmit={handleSubmit} noValidate>
          <MobileOrderReview
            items={items}
            totalItems={totalItems}
            totalPrice={totalPrice}
            shippingCost={shippingCost}
            total={total}
            open={summaryOpen}
            onOpenChange={setSummaryOpen}
            cartActions={cartActions}
            hasRetailerSource={hasRetailerSource}
            hasCartSourceConflict={hasCartSourceConflict}
            isSubmitting={isSubmitting}
            isFindingShop={placeOpenOrderMutation.isPending}
            onFindShop={handleOpenOrder}
          />

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-8">
            <div className="overflow-hidden rounded-xl border bg-card">
              <CheckoutSection
                number="01"
                title="Delivery information"
                description="Where should this order be delivered?"
              >
                <AddressSelector
                  selectedAddressId={selectedAddressId}
                  onSelectAddress={handleAddressSelect}
                />

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <Field
                    id="name"
                    label="Full name"
                    error={fieldErrors.name}
                    required
                  >
                    <Input
                      id="name"
                      name="name"
                      autoComplete="name"
                      placeholder="Recipient name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="h-11 px-3"
                      aria-invalid={!!fieldErrors.name}
                      aria-describedby={
                        fieldErrors.name ? "name-error" : undefined
                      }
                    />
                  </Field>
                  <Field
                    id="phone"
                    label="Phone number"
                    error={fieldErrors.phone}
                    required
                  >
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="01XXXXXXXXX"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="h-11 px-3"
                      aria-invalid={!!fieldErrors.phone}
                      aria-describedby={
                        fieldErrors.phone ? "phone-error" : undefined
                      }
                    />
                  </Field>
                </div>

                <div className="mt-5">
                  <Field
                    id="address"
                    label="Street address"
                    error={fieldErrors.address}
                    required
                  >
                    <Textarea
                      id="address"
                      name="address"
                      autoComplete="street-address"
                      placeholder="House, road, block, and area"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows={3}
                      className="min-h-24 resize-none px-3 py-2.5"
                      aria-invalid={!!fieldErrors.address}
                      aria-describedby={
                        fieldErrors.address ? "address-error" : undefined
                      }
                    />
                  </Field>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field
                    id="city"
                    label="City"
                    error={fieldErrors.city}
                    required
                  >
                    <Select
                      value={formData.city}
                      onValueChange={(value) => {
                        setFormData((previous) => ({
                          ...previous,
                          city: value,
                        }));
                        clearFieldError("city");
                      }}
                    >
                      <SelectTrigger
                        id="city"
                        className="h-11 w-full px-3"
                        aria-invalid={!!fieldErrors.city}
                        aria-describedby={
                          fieldErrors.city ? "city-error" : undefined
                        }
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
                  </Field>
                  <Field id="area" label="Area">
                    <Input
                      id="area"
                      name="area"
                      autoComplete="address-level2"
                      placeholder="Neighbourhood or area"
                      value={formData.area}
                      onChange={handleInputChange}
                      className="h-11 px-3"
                    />
                  </Field>
                </div>

                <Collapsible
                  open={locationOpen}
                  onOpenChange={setLocationOpen}
                  className="mt-6"
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 rounded-lg border bg-muted/35 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground",
                            formData.lat &&
                              formData.lng &&
                              "border-primary/25 bg-primary/8 text-primary",
                          )}
                        >
                          {formData.lat && formData.lng ? (
                            <Check className="size-4" aria-hidden="true" />
                          ) : (
                            <MapPin className="size-4" aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">
                            {formData.lat && formData.lng
                              ? "Delivery location pinned"
                              : "Add precise delivery location"}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                            {!hasRetailerSource
                              ? "Required only when using Find Best Shop."
                              : "Optional, but helpful for faster delivery."}
                          </span>
                        </span>
                      </span>
                      {locationOpen ? (
                        <ChevronUp
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronDown
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div
                      id="delivery-location"
                      className="pt-4 focus:outline-none"
                      tabIndex={-1}
                    >
                      <AddressPicker
                        lat={formData.lat}
                        lng={formData.lng}
                        onLocationChange={(lat, lng) =>
                          setFormData((previous) => ({
                            ...previous,
                            lat,
                            lng,
                          }))
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

                          setFormData((previous) => ({
                            ...previous,
                            address: builtAddress || previous.address,
                            area: resolved.area || previous.area,
                            city: matchedCity || previous.city,
                            postalCode:
                              resolved.postalCode || previous.postalCode,
                          }));
                          setFieldErrors((previous) => ({
                            ...previous,
                            address: undefined,
                            city: undefined,
                          }));
                        }}
                        height="220px"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CheckoutSection>

              <CheckoutSection
                number="02"
                title="Payment method"
                description="Choose how you want to pay for this order."
                bordered
              >
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value) =>
                    setPaymentMethod(value as PaymentMethod)
                  }
                  className="grid gap-2.5"
                >
                  <PaymentOption
                    id="cash_on_delivery"
                    label="Cash on delivery"
                    icon={<Banknote className="size-4" aria-hidden="true" />}
                    selected={paymentMethod === "cash_on_delivery"}
                  />
                  <PaymentOption
                    id="bkash"
                    label="bKash"
                    icon={<Smartphone className="size-4" aria-hidden="true" />}
                    selected={paymentMethod === "bkash"}
                  />
                  <PaymentOption
                    id="nagad"
                    label="Nagad"
                    icon={<Smartphone className="size-4" aria-hidden="true" />}
                    selected={paymentMethod === "nagad"}
                  />
                </RadioGroup>
              </CheckoutSection>

              <CheckoutSection
                number="03"
                title="Order note"
                description="Add delivery instructions only when needed."
                bordered
              >
                <Collapsible open={noteOpen} onOpenChange={setNoteOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between rounded-lg border px-3.5 text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                    >
                      {noteOpen ? "Hide order note" : "Add an order note"}
                      {noteOpen ? (
                        <ChevronUp
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronDown
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="pt-3">
                      <Label htmlFor="customerNote" className="sr-only">
                        Order note
                      </Label>
                      <Textarea
                        id="customerNote"
                        name="customerNote"
                        placeholder="For example: call before delivery"
                        value={formData.customerNote}
                        onChange={handleInputChange}
                        rows={3}
                        className="min-h-24 resize-none px-3 py-2.5"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CheckoutSection>
            </div>

            <DesktopOrderSummary
              items={items}
              totalItems={totalItems}
              totalPrice={totalPrice}
              shippingCost={shippingCost}
              total={total}
              cartActions={cartActions}
              hasRetailerSource={hasRetailerSource}
              hasCartSourceConflict={hasCartSourceConflict}
              isSubmitting={isSubmitting}
              isPlacingOrder={placeOrderMutation.isPending}
              isFindingShop={placeOpenOrderMutation.isPending}
              onFindShop={handleOpenOrder}
            />
          </div>
        </form>
      </main>

      <MobileCheckoutBar
        total={total}
        isSubmitting={isSubmitting}
        isPlacingOrder={placeOrderMutation.isPending}
        disabled={hasCartSourceConflict}
      />
    </div>
  );
}

function CheckoutSection({
  number,
  title,
  description,
  bordered = false,
  children,
}: {
  number: string;
  title: string;
  description: string;
  bordered?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn("px-5 py-6 sm:px-7 sm:py-7", bordered && "border-t")}
      aria-labelledby={`checkout-section-${number}`}
    >
      <div className="mb-6 flex items-start gap-3.5">
        <span className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-primary">
          {number}
        </span>
        <div>
          <h2
            id={`checkout-section-${number}`}
            className="text-lg font-semibold tracking-[-0.02em] text-foreground"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  error,
  required = false,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="ml-1 text-primary" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function PaymentOption({
  id,
  label,
  icon,
  selected,
}: {
  id: PaymentMethod;
  label: string;
  icon: ReactNode;
  selected: boolean;
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3.5 transition-colors hover:bg-muted/45",
        selected && "border-primary/45 bg-primary/[0.055]",
      )}
    >
      <RadioGroupItem id={id} value={id} className="text-primary" />
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground",
          selected && "bg-primary/10 text-primary",
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </Label>
  );
}

type CartActions = {
  onUpdateQuantity: (id: number, quantity: number) => void;
  onRemove: (id: number) => void;
  disabled: boolean;
};

function CartItemRow({
  item,
  actions,
}: {
  item: CheckoutCartItem;
  actions: CartActions;
}) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] gap-3 py-4 first:pt-0 last:pb-0">
      <div className="relative size-14 overflow-hidden rounded-lg border bg-muted">
        <Image
          src={item.image || "/placeholder-image.svg"}
          alt={item.name || "Product"}
          fill
          sizes="56px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
          {item.name}
        </p>
        <CartRetailerLabel shopName={item.shopName} />
        {item.size && (
          <p className="mt-0.5 text-xs text-muted-foreground">{item.size}</p>
        )}
        <div className="mt-2.5 flex items-center gap-1.5">
          <div className="flex items-center rounded-lg border bg-background">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-r-none"
              onClick={() =>
                actions.onUpdateQuantity(item.id, item.quantity - 1)
              }
              disabled={item.quantity <= 1 || actions.disabled}
              aria-label={`Decrease quantity of ${item.name}`}
            >
              <Minus className="size-3.5" aria-hidden="true" />
            </Button>
            <span className="min-w-7 text-center font-mono text-xs font-semibold tabular-nums">
              {item.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-l-none"
              onClick={() =>
                actions.onUpdateQuantity(item.id, item.quantity + 1)
              }
              disabled={actions.disabled}
              aria-label={`Increase quantity of ${item.name}`}
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground hover:bg-destructive/8 hover:text-destructive"
            onClick={() => actions.onRemove(item.id)}
            disabled={actions.disabled}
            aria-label={`Remove ${item.name} from cart`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <p className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-foreground">
        {formatPrice(item.price * item.quantity)}
      </p>
    </div>
  );
}

function Totals({
  totalPrice,
  shippingCost,
  total,
}: {
  totalPrice: number;
  shippingCost: number;
  total: number;
}) {
  return (
    <dl className="space-y-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="font-mono tabular-nums text-foreground">
          {formatPrice(totalPrice)}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4 text-sm">
        <dt className="text-muted-foreground">Delivery</dt>
        <dd className="font-mono tabular-nums text-foreground">
          {shippingCost === 0 ? "Free" : formatPrice(shippingCost)}
        </dd>
      </div>
      <div className="flex items-end justify-between gap-4 border-t pt-4">
        <dt className="font-semibold text-foreground">Total</dt>
        <dd className="font-mono text-xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">
          {formatPrice(total)}
        </dd>
      </div>
    </dl>
  );
}

function DesktopOrderSummary({
  items,
  totalItems,
  totalPrice,
  shippingCost,
  total,
  cartActions,
  hasRetailerSource,
  hasCartSourceConflict,
  isSubmitting,
  isPlacingOrder,
  isFindingShop,
  onFindShop,
}: {
  items: CheckoutCartItem[];
  totalItems: number;
  totalPrice: number;
  shippingCost: number;
  total: number;
  cartActions: CartActions;
  hasRetailerSource: boolean;
  hasCartSourceConflict: boolean;
  isSubmitting: boolean;
  isPlacingOrder: boolean;
  isFindingShop: boolean;
  onFindShop: () => void;
}) {
  return (
    <aside className="sticky top-32 hidden rounded-xl border bg-card lg:block">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="text-base font-semibold tracking-[-0.02em]">
          Order summary
        </h2>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {totalItems} {totalItems === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="px-5 py-5">
        <div className="thin-scrollbar max-h-80 divide-y overflow-y-auto pr-1">
          {items.map((item) => (
            <CartItemRow key={item.id} item={item} actions={cartActions} />
          ))}
        </div>
        <div className="mt-5 border-t pt-5">
          <Totals
            totalPrice={totalPrice}
            shippingCost={shippingCost}
            total={total}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="mt-5 h-11 w-full font-semibold"
          disabled={isSubmitting || hasCartSourceConflict}
        >
          {isPlacingOrder ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Placing order...
            </>
          ) : (
            <>
              <CheckCircle aria-hidden="true" />
              Place order
            </>
          )}
        </Button>

        {!hasRetailerSource && (
          <div className="mt-3 rounded-lg bg-muted/45 p-3">
            <p className="text-xs leading-5 text-muted-foreground">
              Want nearby shops to compete for this order? Pin your location and
              let Bikalpo find the best match.
            </p>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="mt-2.5 h-10 w-full bg-background"
              disabled={isSubmitting || hasCartSourceConflict}
              onClick={onFindShop}
            >
              {isFindingShop ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Finding shops...
                </>
              ) : (
                <>
                  <Search aria-hidden="true" />
                  Find best shop
                </>
              )}
            </Button>
          </div>
        )}

        <p className="mt-4 text-center text-[11px] leading-4 text-muted-foreground">
          By placing this order, you agree to Bikalpo's terms.
        </p>
      </div>
    </aside>
  );
}

function MobileOrderReview({
  items,
  totalItems,
  totalPrice,
  shippingCost,
  total,
  open,
  onOpenChange,
  cartActions,
  hasRetailerSource,
  hasCartSourceConflict,
  isSubmitting,
  isFindingShop,
  onFindShop,
}: {
  items: CheckoutCartItem[];
  totalItems: number;
  totalPrice: number;
  shippingCost: number;
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartActions: CartActions;
  hasRetailerSource: boolean;
  hasCartSourceConflict: boolean;
  isSubmitting: boolean;
  isFindingShop: boolean;
  onFindShop: () => void;
}) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="mb-5 rounded-xl border bg-card lg:hidden"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex min-h-16 w-full items-center justify-between gap-4 px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary/8 text-primary">
              <ShoppingBag className="size-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold">Review order</span>
              <span className="block font-mono text-xs tabular-nums text-muted-foreground">
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </span>
            </span>
          </span>
          <span className="flex items-center gap-2.5">
            <span className="font-mono text-sm font-semibold tabular-nums">
              {formatPrice(total)}
            </span>
            {open ? (
              <ChevronUp
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            ) : (
              <ChevronDown
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-4 py-5">
          <div className="divide-y">
            {items.map((item) => (
              <CartItemRow key={item.id} item={item} actions={cartActions} />
            ))}
          </div>
          <div className="mt-5 border-t pt-5">
            <Totals
              totalPrice={totalPrice}
              shippingCost={shippingCost}
              total={total}
            />
          </div>
          {!hasRetailerSource && (
            <div className="mt-4 rounded-lg bg-muted/45 p-3">
              <p className="text-xs leading-5 text-muted-foreground">
                Pin your delivery location to let Bikalpo find the best nearby
                shop.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-2.5 h-10 w-full bg-background"
                disabled={isSubmitting || hasCartSourceConflict}
                onClick={onFindShop}
              >
                {isFindingShop ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Finding shops...
                  </>
                ) : (
                  <>
                    <Search aria-hidden="true" />
                    Find best shop
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function MobileCheckoutBar({
  total,
  isSubmitting,
  isPlacingOrder,
  disabled,
}: {
  total: number;
  isSubmitting: boolean;
  isPlacingOrder: boolean;
  disabled: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background px-4 py-3 lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Order total</p>
          <p className="truncate font-mono text-lg font-semibold tabular-nums">
            {formatPrice(total)}
          </p>
        </div>
        <Button
          type="submit"
          form="checkout-form"
          size="lg"
          className="h-12 min-w-36 px-5 font-semibold"
          disabled={isSubmitting || disabled}
        >
          {isPlacingOrder ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle aria-hidden="true" />
              Place order
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="min-h-screen bg-[oklch(0.975_0.006_264)]">
      <main
        className="mx-auto max-w-6xl animate-pulse px-4 py-10 sm:px-6 lg:px-8"
        aria-label="Loading checkout"
      >
        <div className="h-4 w-32 rounded bg-muted" />
        <div className="mt-5 h-10 w-52 rounded bg-muted" />
        <div className="mt-3 h-4 w-full max-w-md rounded bg-muted" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="rounded-xl border bg-card p-7">
            <div className="h-6 w-48 rounded bg-muted" />
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <div className="h-11 rounded-lg bg-muted" />
              <div className="h-11 rounded-lg bg-muted" />
            </div>
            <div className="mt-5 h-24 rounded-lg bg-muted" />
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="h-11 rounded-lg bg-muted" />
              <div className="h-11 rounded-lg bg-muted" />
            </div>
          </div>
          <div className="hidden h-[28rem] rounded-xl border bg-card lg:block" />
        </div>
      </main>
    </div>
  );
}

function EmptyCheckout() {
  return (
    <main className="min-h-[70vh] bg-[oklch(0.975_0.006_264)] px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-lg rounded-xl border bg-card px-6 py-12 text-center sm:px-10">
        <span className="mx-auto flex size-12 items-center justify-center rounded-lg bg-primary/8 text-primary">
          <ShoppingBag className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">
          Your cart is empty
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Add products to your cart, then return here to arrange delivery and
          payment.
        </p>
        <Button asChild size="lg" className="mt-6 h-11 px-5">
          <Link href="/products">Browse products</Link>
        </Button>
      </div>
    </main>
  );
}
