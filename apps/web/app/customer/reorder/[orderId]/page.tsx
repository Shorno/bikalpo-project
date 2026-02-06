"use client";

import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
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
  RotateCcw,
  Smartphone,
  Trash2,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";
import { getReorderItems, placeReorder } from "@/actions/order/order-actions";
import { ReorderProductPicker } from "@/components/features/orders/reorder-product-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
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
import type { PaymentMethod } from "@/db/schema/order";
import { authClient } from "@/lib/auth-client";

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

interface ReorderItem {
  id: number;
  productId: number;
  productName: string;
  productImage: string;
  productSize: string;
  originalQuantity: number;
  quantity: number;
  originalPrice: string;
  currentPrice: string;
  inStock: boolean;
  stockQuantity: number;
  productExists: boolean;
}

export default function ReorderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const resolvedParams = use(params);
  const orderId = Number(resolvedParams.orderId);
  const router = useRouter();
  const { data: session } = authClient.useSession();

  // Fetch reorder items using TanStack Query
  const {
    data: reorderData,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["reorder-items", orderId],
    queryFn: () => getReorderItems(orderId),
    enabled: !!orderId,
  });

  const [items, setItems] = useState<ReorderItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [itemsInitialized, setItemsInitialized] = useState(false);

  // Initialize items when data is loaded
  if (reorderData?.success && reorderData.items && !itemsInitialized) {
    setItems(reorderData.items);
    setItemsInitialized(true);
  }

  const originalOrder = reorderData?.originalOrder;

  // TanStack Form with default values from the fetched data
  const form = useForm({
    defaultValues: {
      name: originalOrder?.shippingName || session?.user?.name || "",
      phone:
        originalOrder?.shippingPhone ||
        (session?.user as { phoneNumber?: string })?.phoneNumber ||
        "",
      email: originalOrder?.shippingEmail || session?.user?.email || "",
      address: originalOrder?.shippingAddress || "",
      city: originalOrder?.shippingCity || "",
      area: originalOrder?.shippingArea || "",
      postalCode: originalOrder?.shippingPostalCode || "",
      customerNote: "",
      paymentMethod: "cash_on_delivery" as PaymentMethod,
    },
    onSubmit: async ({ value }) => {
      // Manual validation
      if (!value.name.trim()) {
        toast.error("Please enter your name");
        return;
      }
      if (!value.phone.trim()) {
        toast.error("Please enter your phone number");
        return;
      }
      if (!value.address.trim()) {
        toast.error("Please enter your address");
        return;
      }
      if (!value.city) {
        toast.error("Please select your city");
        return;
      }

      if (!session?.user) {
        toast.error("Please login to place an order");
        router.push("/login");
        return;
      }

      const availableItems = items.filter(
        (item) => item.inStock && item.productExists,
      );
      if (availableItems.length === 0) {
        toast.error("No available items to reorder");
        return;
      }

      setIsSubmitting(true);

      try {
        const result = await placeReorder(
          orderId,
          availableItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          {
            name: value.name,
            phone: value.phone,
            email: value.email || undefined,
            address: value.address,
            city: value.city,
            area: value.area || undefined,
            postalCode: value.postalCode || undefined,
            customerNote: value.customerNote || undefined,
          },
          value.paymentMethod,
        );

        if (result.success && result.orderNumber) {
          toast.success("Reorder placed successfully!");
          router.push(`/order-confirmation/${result.orderNumber}`);
        } else {
          toast.error(result.error || "Failed to place reorder");
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const updateQuantity = (itemId: number, newQuantity: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const qty = Math.max(1, Math.min(newQuantity, item.stockQuantity));
          return { ...item, quantity: qty };
        }
        return item;
      }),
    );
  };

  const removeItem = (itemId: number) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const addProduct = (product: {
    id: number;
    name: string;
    image: string;
    price: string;
    size: string;
    stockQuantity: number;
  }) => {
    // Generate a unique ID for the new item (negative to distinguish from original items)
    const newItemId = -Date.now();
    const newItem: ReorderItem = {
      id: newItemId,
      productId: product.id,
      productName: product.name,
      productImage: product.image,
      productSize: product.size,
      originalQuantity: 1,
      quantity: 1,
      originalPrice: product.price,
      currentPrice: product.price,
      inStock: true,
      stockQuantity: product.stockQuantity,
      productExists: true,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
    }).format(numPrice);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Error state
  if (queryError || !reorderData?.success) {
    const errorMessage =
      reorderData?.error ||
      queryError?.message ||
      "Failed to load reorder items";
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <AlertCircle className="h-16 w-16 mx-auto text-red-400 mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-gray-900">
            {errorMessage}
          </h1>
          <p className="text-gray-500 mb-6">
            Unable to load reorder items. This order may not be available for
            reordering.
          </p>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <Link href="/customer/account/orders">Back to Orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  const availableItems = items.filter(
    (item) => item.inStock && item.productExists,
  );
  const unavailableItems = items.filter(
    (item) => !item.inStock || !item.productExists,
  );

  // No available items state
  if (availableItems.length === 0 && itemsInitialized) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <RotateCcw className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold mb-2 text-gray-900">
            No items available
          </h1>
          <p className="text-gray-500 mb-6">
            All items from this order are currently out of stock or unavailable.
          </p>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <Link href="/customer/products">Browse Products</Link>
          </Button>
        </div>
      </div>
    );
  }

  const totalItems = availableItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const totalPrice = availableItems.reduce(
    (sum, item) => sum + parseFloat(item.currentPrice) * item.quantity,
    0,
  );

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/customer/account/orders"
            className="inline-flex items-center text-sm text-gray-500 hover:text-emerald-600 mb-3 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Orders
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <RotateCcw className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Reorder
            </h1>
          </div>
          {originalOrder && (
            <p className="text-sm text-gray-500">
              Based on Order #{originalOrder.orderNumber}
            </p>
          )}
        </div>

        {/* Unavailable Items Warning */}
        {unavailableItems.length > 0 && (
          <Alert className="mb-4 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              {unavailableItems.length} item(s) from your original order are
              currently unavailable and won&apos;t be included.
            </AlertDescription>
          </Alert>
        )}

        <form
          id="reorder-form"
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          {/* Mobile: Collapsible Order Summary */}
          <div className="md:hidden mb-4">
            <Collapsible open={summaryOpen} onOpenChange={setSummaryOpen}>
              <Card className="border-gray-200 shadow-sm p-0">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4 text-blue-600" />
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
                    {availableItems.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0 bg-gray-100">
                          <Image
                            src={item.productImage || "/placeholder.png"}
                            alt={item.productName || "Product"}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {item.productName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.productSize} × {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-medium">
                          {formatPrice(
                            parseFloat(item.currentPrice) * item.quantity,
                          )}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          <div className="grid md:grid-cols-5 gap-6">
            {/* Left Column - Forms */}
            <div className="md:col-span-3 space-y-4">
              {/* Items to Reorder */}
              <Card className="border-gray-200 shadow-sm py-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <RotateCcw className="h-4 w-4 text-blue-600" />
                    Items to Reorder
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {availableItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="relative h-14 w-14 rounded-md overflow-hidden flex-shrink-0 bg-gray-100">
                        <Image
                          src={item.productImage || "/placeholder.png"}
                          alt={item.productName}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {item.productName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.productSize}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-semibold text-emerald-600">
                            {formatPrice(item.currentPrice)}
                          </span>
                          {parseFloat(item.currentPrice) !==
                            parseFloat(item.originalPrice) && (
                            <span className="text-xs text-gray-400 line-through">
                              {formatPrice(item.originalPrice)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border rounded-md">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">
                            {item.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            disabled={item.quantity >= item.stockQuantity}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Add More Products */}
                  <div className="pt-2 border-t border-gray-100">
                    <ReorderProductPicker
                      onSelect={addProduct}
                      excludeProductIds={items.map((item) => item.productId)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Shipping Information */}
              <Card className="border-gray-200 shadow-sm py-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    Shipping Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Name Field */}
                    <form.Field name="name">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>
                            Full Name *
                          </FieldLabel>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              id={field.name}
                              name={field.name}
                              placeholder="Your name"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              className="pl-9 h-9 text-sm"
                            />
                          </div>
                        </Field>
                      )}
                    </form.Field>

                    {/* Phone Field */}
                    <form.Field name="phone">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>Phone *</FieldLabel>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              id={field.name}
                              name={field.name}
                              type="tel"
                              placeholder="01XXXXXXXXX"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              className="pl-9 h-9 text-sm"
                            />
                          </div>
                        </Field>
                      )}
                    </form.Field>
                  </div>

                  {/* Address Field */}
                  <form.Field name="address">
                    {(field) => (
                      <Field>
                        <FieldLabel htmlFor={field.name}>Address *</FieldLabel>
                        <Textarea
                          id={field.name}
                          name={field.name}
                          placeholder="House, Road, Block, Area..."
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          rows={2}
                          className="text-sm resize-none"
                        />
                      </Field>
                    )}
                  </form.Field>

                  <div className="grid grid-cols-2 gap-3">
                    {/* City Field */}
                    <form.Field name="city">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>City *</FieldLabel>
                          <Select
                            name={field.name}
                            value={field.state.value}
                            onValueChange={field.handleChange}
                          >
                            <SelectTrigger
                              id={field.name}
                              className="h-9 text-sm"
                            >
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
                        </Field>
                      )}
                    </form.Field>

                    {/* Area Field */}
                    <form.Field name="area">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>Area</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            placeholder="Your area"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            className="h-9 text-sm"
                          />
                        </Field>
                      )}
                    </form.Field>
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
                  <form.Field name="paymentMethod">
                    {(field) => (
                      <RadioGroup
                        name={field.name}
                        value={field.state.value}
                        onValueChange={(value) =>
                          field.handleChange(value as PaymentMethod)
                        }
                        className="space-y-2"
                      >
                        <div
                          className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${field.state.value === "cash_on_delivery" ? "bg-emerald-50 border-emerald-200" : "hover:bg-gray-50"}`}
                        >
                          <RadioGroupItem
                            value="cash_on_delivery"
                            id="cod"
                            className="text-emerald-600"
                          />
                          <Label
                            htmlFor="cod"
                            className="flex items-center gap-2 cursor-pointer flex-1"
                          >
                            <Banknote className="h-4 w-4 text-emerald-600" />
                            <span className="font-medium text-sm">
                              Cash on Delivery
                            </span>
                          </Label>
                        </div>

                        <div
                          className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${field.state.value === "bkash" ? "bg-pink-50 border-pink-200" : "hover:bg-gray-50"}`}
                        >
                          <RadioGroupItem
                            value="bkash"
                            id="bkash"
                            className="text-pink-600"
                          />
                          <Label
                            htmlFor="bkash"
                            className="flex items-center gap-2 cursor-pointer flex-1"
                          >
                            <Smartphone className="h-4 w-4 text-pink-600" />
                            <span className="font-medium text-sm">bKash</span>
                          </Label>
                        </div>

                        <div
                          className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${field.state.value === "nagad" ? "bg-orange-50 border-orange-200" : "hover:bg-gray-50"}`}
                        >
                          <RadioGroupItem
                            value="nagad"
                            id="nagad"
                            className="text-orange-600"
                          />
                          <Label
                            htmlFor="nagad"
                            className="flex items-center gap-2 cursor-pointer flex-1"
                          >
                            <Smartphone className="h-4 w-4 text-orange-600" />
                            <span className="font-medium text-sm">Nagad</span>
                          </Label>
                        </div>
                      </RadioGroup>
                    )}
                  </form.Field>
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
                  <form.Field name="customerNote">
                    {(field) => (
                      <Textarea
                        id={field.name}
                        name={field.name}
                        placeholder="Any special instructions..."
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        rows={2}
                        className="text-sm resize-none"
                      />
                    )}
                  </form.Field>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Order Summary (Desktop) */}
            <div className="hidden md:block md:col-span-2">
              <Card className="sticky top-20 border-gray-200 shadow-sm">
                <CardHeader className="py-4">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Reorder Summary</span>
                    <span className="text-sm font-normal text-gray-500">
                      {totalItems} items
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  {/* Cart Items */}
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {availableItems.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0 bg-gray-100">
                          <Image
                            src={item.productImage || "/placeholder.png"}
                            alt={item.productName || "Product"}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {item.productName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.productSize} × {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-medium">
                          {formatPrice(
                            parseFloat(item.currentPrice) * item.quantity,
                          )}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span>{formatPrice(totalPrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Shipping</span>
                      <span className="text-emerald-600 font-medium">Free</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span className="text-emerald-600">
                        {formatPrice(totalPrice)}
                      </span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
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
                        Place Reorder
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

      {/* Mobile: Sticky Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-600">Total</span>
          <span className="text-xl font-bold text-emerald-600">
            {formatPrice(totalPrice)}
          </span>
        </div>
        <Button
          type="submit"
          form="reorder-form"
          className="w-full bg-blue-600 hover:bg-blue-700"
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
              <RotateCcw className="h-4 w-4 mr-2" />
              Place Reorder
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
