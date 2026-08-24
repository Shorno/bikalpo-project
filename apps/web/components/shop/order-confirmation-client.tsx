/**
 * Client component for the order confirmation page
 * Two-column receipt-style layout with "Thank you" message
 */
"use client";

import { format } from "date-fns";
import {
  CheckCircle2,
  MapPin,
  Package,
  Phone,
  Truck,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrderByNumber } from "@/hooks/use-customer-api";

interface OrderDetailClientProps {
  orderNumber: string;
}

const paymentMethodLabels: Record<string, string> = {
  cash_on_delivery: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
  bank_transfer: "Bank Transfer",
};

const formatPrice = (price: string | number) => {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(Number(price));
};

function OrderConfirmationSkeleton() {
  return (
    <div className="min-h-[60vh] py-8 md:py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="space-y-6">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
          <div>
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrderConfirmationClient({
  orderNumber,
}: OrderDetailClientProps) {
  const { data, isLoading, isError } = useOrderByNumber(orderNumber);
  type OrderItem = NonNullable<
    NonNullable<typeof data>["order"]
  >["items"][number];

  useEffect(() => {
    if (isError) {
      notFound();
    }
  }, [isError]);

  if (isLoading) return <OrderConfirmationSkeleton />;
  if (!data?.order) return null;

  const { order } = data;

  return (
    <div className="min-h-[60vh] bg-gradient-to-b from-gray-50/60 to-white py-8 md:py-12">
      <div className="max-w-5xl mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* ─── Left Column: Thank You + Shipping ─── */}
          <div className="space-y-8">
            {/* Success Badge */}
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-5">
                <CheckCircle2 className="h-4 w-4" />
                Order Placed Successfully
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                Thank you for your
                <br />
                purchase!
              </h1>

              <p className="text-gray-500 mt-3 leading-relaxed">
                Your order will be processed within 24 hours during working
                days. We will notify you by email once your order has been
                shipped.
              </p>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                Shipping Address
              </h2>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {order.shippingName}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-600">
                      {order.shippingAddress}
                    </p>
                    <p className="text-sm text-gray-600">
                      {[
                        order.shippingArea,
                        order.shippingCity,
                        order.shippingPostalCode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-600">{order.shippingPhone}</p>
                </div>

                {order.shippingEmail && (
                  <div className="flex items-start gap-3">
                    <span className="text-gray-400 text-sm mt-0.5 shrink-0">
                      @
                    </span>
                    <p className="text-sm text-gray-600">
                      {order.shippingEmail}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button asChild className="gap-2 bg-blue-700 hover:bg-blue-800">
                <Link href={`/account/orders/${order.orderNumber}`}>
                  <Truck className="h-4 w-4" />
                  View order journey
                </Link>
              </Button>
              <Button variant="outline" asChild className="gap-2">
                <Link href="/account/orders">
                  <Package className="h-4 w-4" />
                  View All Orders
                </Link>
              </Button>
            </div>
          </div>

          {/* ─── Right Column: Order Summary Receipt ─── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Receipt Header */}
            <div className="p-5 pb-4">
              <h2 className="text-lg font-bold text-gray-900">Order Summary</h2>
            </div>

            {/* Order Meta */}
            <div className="mx-5 bg-gray-50 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide">
                    Date
                  </p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">
                    {format(new Date(order.createdAt), "dd MMM yyyy")}
                  </p>
                </div>
                <div className="border-x border-gray-200">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide">
                    Order No.
                  </p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5 truncate px-1">
                    {order.orderNumber}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide">
                    Payment
                  </p>
                  <p className="text-xs font-semibold text-gray-900 mt-0.5">
                    {order.paymentMethod
                      ? paymentMethodLabels[order.paymentMethod] ||
                        order.paymentMethod
                      : "Not selected"}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="px-5 space-y-3 max-h-[280px] overflow-y-auto">
              {order.items?.map((item: OrderItem) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="relative h-14 w-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-100">
                    <Image
                      src={item.productImage || "/placeholder-image.svg"}
                      alt={item.productName}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.productName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.productSize && (
                        <span>Pack: {item.productSize}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 shrink-0">
                    {formatPrice(item.totalPrice)}
                  </p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="px-5 pt-4 mt-3">
              <Separator className="mb-4" />
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900">
                    {formatPrice(order.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Shipping</span>
                  <span className="text-gray-900">
                    {Number(order.shippingCost) === 0
                      ? "Free"
                      : formatPrice(order.shippingCost)}
                  </span>
                </div>
                {Number(order.discount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-red-600">
                      -{formatPrice(order.discount)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Grand Total */}
            <div className="px-5 py-5">
              <Separator className="mb-4" />
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-gray-900">
                  Order Total
                </span>
                <span className="text-xl font-bold text-emerald-600">
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>

            {/* Receipt Bottom Edge (decorative zigzag) */}
            <div
              className="h-4 w-full"
              style={{
                background:
                  "linear-gradient(135deg, #f9fafb 33.33%, transparent 33.33%) 0 0, linear-gradient(225deg, #f9fafb 33.33%, transparent 33.33%) 0 0",
                backgroundSize: "12px 100%",
                backgroundRepeat: "repeat-x",
              }}
            />
          </div>
        </div>

        {/* Customer Note */}
        {order.customerNote && (
          <div className="mt-8 max-w-5xl">
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
                Your Note
              </p>
              <p className="text-sm text-amber-700">{order.customerNote}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
