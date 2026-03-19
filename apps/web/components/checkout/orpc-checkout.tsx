/**
 * ORPC-powered Checkout page — replaces server-action-based checkout.
 */
"use client";

import {
  ArrowLeft,
  Banknote,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Loader2,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Smartphone,
  Trash2,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  OrpcAddressSelector,
  type OrpcCheckoutAddress,
} from "@/components/checkout/orpc-address-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  useCartQuery,
  useClearCart,
  usePlaceOrder,
  useRemoveFromCart,
  useUpdateCartItem,
} from "@/hooks/use-customer-api";
import { authClient } from "@/lib/auth-client";

const AddressPicker = dynamic(
  () =>
    import("@/components/shared/address-picker").then(
      (mod) => mod.AddressPicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] bg-muted animate-pulse rounded-lg flex items-center justify-center text-sm text-muted-foreground">
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

type PaymentMethod =
  | "cash_on_delivery"
  | "bkash"
  | "nagad"
  | "bank_transfer"
  | "card";
type CartData = NonNullable<ReturnType<typeof useCartQuery>["data"]>;
type CheckoutCartItem = CartData["items"][number];
type SessionUser = NonNullable<
  ReturnType<typeof authClient.useSession>["data"]
>["user"];

function getUserPhone(user: SessionUser | undefined) {
  if (!user) return "";
  const phoneNumber =
    "phoneNumber" in user && typeof user.phoneNumber === "string"
      ? user.phoneNumber
      : "";
  return phoneNumber;
}

export function OrpcCheckout() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const { data: cartData, isLoading: cartLoading } = useCartQuery();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveFromCart();
  const _clearCartMutation = useClearCart();
  const placeOrderMutation = usePlaceOrder();

  const items: CheckoutCartItem[] = cartData?.items ?? [];
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash_on_delivery");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [shippingCost] = useState(0);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(
    null,
  );

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
      setFormData((prev) => ({
        ...prev,
        name: session.user.name || "",
        email: session.user.email || "",
        phone: getUserPhone(session.user),
      }));
    }
  }, [session]);

  const handleAddressSelect = useCallback(
    (address: OrpcCheckoutAddress | null) => {
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
        });
      } else {
        setSelectedAddressId(null);
        setFormData({
          name: session?.user?.name || "",
          phone: getUserPhone(session?.user),
          email: session?.user?.email || "",
          address: "",
          city: "",
          area: "",
          postalCode: "",
          customerNote: "",
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

      if (result.order.orderNumber) {
        toast.success("Order placed successfully!");
        router.push(`/order-confirmation/${result.order.orderNumber}`);
      }
    } catch {
      // Error toast is handled in the mutation hook
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
    }).format(price);

  if (cartLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-gray-900">
            Your cart is empty
          </h1>
          <p className="text-gray-500 mb-6">
            Add some products to your cart before checking out.
          </p>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <Link href="/shop/products">Browse Products</Link>
          </Button>
        </div>
      </div>
    );
  }

  const isSubmitting = placeOrderMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/products"
            className="inline-flex items-center text-sm text-gray-500 hover:text-emerald-600 mb-3 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Continue Shopping
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Checkout
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Mobile: Collapsible Order Summary */}
          <div className="md:hidden mb-4">
            <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
              <Card className="border-gray-200 shadow-sm p-0">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4 text-emerald-600" />
                        <span className="font-medium">
                          {totalItems} {totalItems === 1 ? "item" : "items"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-600">
                          {formatPrice(totalPrice)}
                        </span>
                        {summaryOpen ? (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent className="pb-2">
                  <CardContent className="pt-0 space-y-3">
                    <Separator />
                    {items.map((item) => (
                      <CartItemRow
                        key={item.id}
                        item={item}
                        formatPrice={formatPrice}
                        onUpdateQuantity={(id, qty) =>
                          updateItem.mutate({ cartItemId: id, quantity: qty })
                        }
                        onRemove={(id) => removeItem.mutate({ cartItemId: id })}
                        disabled={updateItem.isPending || removeItem.isPending}
                      />
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          <div className="grid md:grid-cols-5 gap-6">
            {/* Left Column - Forms */}
            <div className="md:col-span-3 space-y-4">
              {/* Shipping Information */}
              <Card className="border-gray-200 shadow-sm py-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    Shipping Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <OrpcAddressSelector
                    selectedAddressId={selectedAddressId}
                    onSelectAddress={handleAddressSelect}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-sm">
                        Full Name *
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="name"
                          name="name"
                          placeholder="Your name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className="pl-9 h-9 text-sm"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-sm">
                        Phone *
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="01XXXXXXXXX"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="pl-9 h-9 text-sm"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="address" className="text-sm">
                      Address *
                    </Label>
                    <Textarea
                      id="address"
                      name="address"
                      placeholder="House, Road, Block, Area..."
                      value={formData.address}
                      onChange={handleInputChange}
                      rows={2}
                      className="text-sm resize-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="city" className="text-sm">
                        City *
                      </Label>
                      <Select
                        value={formData.city}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, city: value }))
                        }
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select City" />
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
                    <div className="space-y-1.5">
                      <Label htmlFor="area" className="text-sm">
                        Area
                      </Label>
                      <Input
                        id="area"
                        name="area"
                        placeholder="Your area"
                        value={formData.area}
                        onChange={handleInputChange}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  {/* Location Picker Map */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Pin Your Location (Optional)</Label>
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
                            : resolved.displayName.split(",").slice(0, 3).join(",").trim();

                        const nominatimLocation = [
                          resolved.city,
                          resolved.district,
                          resolved.state,
                        ]
                          .join(" ")
                          .toLowerCase();
                        const matchedCity = CITIES.find((c) =>
                          nominatimLocation.includes(c.toLowerCase()),
                        );

                        setFormData((prev) => ({
                          ...prev,
                          address: builtAddress || prev.address,
                          area: resolved.area || prev.area,
                          city: matchedCity || prev.city,
                          postalCode:
                            resolved.postalCode || prev.postalCode,
                        }));
                      }}
                      height="200px"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Payment Method */}
              <Card className="border-gray-200 shadow-sm py-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                    className="space-y-2"
                  >
                    {[
                      {
                        value: "cash_on_delivery",
                        label: "Cash on Delivery",
                        icon: Banknote,
                        color: "emerald",
                      },
                      {
                        value: "bkash",
                        label: "bKash",
                        icon: Smartphone,
                        color: "pink",
                      },
                      {
                        value: "nagad",
                        label: "Nagad",
                        icon: Smartphone,
                        color: "orange",
                      },
                    ].map((pm) => (
                      <div
                        key={pm.value}
                        className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          paymentMethod === pm.value
                            ? `bg-${pm.color}-50 border-${pm.color}-200`
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <RadioGroupItem
                          value={pm.value}
                          id={pm.value}
                          className={`text-${pm.color}-600`}
                        />
                        <Label
                          htmlFor={pm.value}
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          <pm.icon className={`h-4 w-4 text-${pm.color}-600`} />
                          <span className="font-medium text-sm">
                            {pm.label}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Order Notes */}
              <Card className="border-gray-200 shadow-sm py-4">
                <CardHeader>
                  <CardTitle className="text-base">
                    Order Notes (Optional)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Textarea
                    name="customerNote"
                    placeholder="Any special instructions..."
                    value={formData.customerNote}
                    onChange={handleInputChange}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Desktop Summary */}
            <div className="hidden md:block md:col-span-2">
              <Card className="sticky top-20 border-gray-200 shadow-sm">
                <CardHeader className="py-4">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Order Summary</span>
                    <span className="text-sm font-normal text-gray-500">
                      {totalItems} items
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {items.map((item) => (
                      <CartItemRow
                        key={item.id}
                        item={item}
                        formatPrice={formatPrice}
                        onUpdateQuantity={(id, qty) =>
                          updateItem.mutate({ cartItemId: id, quantity: qty })
                        }
                        onRemove={(id) => removeItem.mutate({ cartItemId: id })}
                        disabled={updateItem.isPending || removeItem.isPending}
                      />
                    ))}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span>{formatPrice(totalPrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Delivery</span>
                      <span>
                        {shippingCost === 0
                          ? "Free"
                          : formatPrice(shippingCost)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span className="text-emerald-600">
                        {formatPrice(totalPrice + shippingCost)}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    size="lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Place Order
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-center text-gray-500">
                    By placing this order, you agree to our terms
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-600">Total</span>
          <span className="text-xl font-bold text-emerald-600">
            {formatPrice(totalPrice + shippingCost)}
          </span>
        </div>
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700"
          size="lg"
          disabled={isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Place Order
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* Shared cart item row */
function CartItemRow({
  item,
  formatPrice,
  onUpdateQuantity,
  onRemove,
  disabled,
}: {
  item: CheckoutCartItem;
  formatPrice: (n: number) => string;
  onUpdateQuantity: (id: number, qty: number) => void;
  onRemove: (id: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex gap-3 p-2 rounded-lg hover:bg-gray-50">
      <div className="relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0 bg-gray-100">
        <Image
          src={item.image || "/placeholder.png"}
          alt={item.name || "Product"}
          fill
          className="object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.name}</p>
        <p className="text-xs text-gray-500 mb-1">{item.size}</p>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md bg-white">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              disabled={item.quantity <= 1 || disabled}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-5 text-center text-xs font-medium">
              {item.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              disabled={disabled}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemove(item.id)}
            disabled={disabled}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <p className="text-sm font-semibold">
        {formatPrice(item.price * item.quantity)}
      </p>
    </div>
  );
}
