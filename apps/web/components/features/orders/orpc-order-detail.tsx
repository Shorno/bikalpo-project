/**
 * ORPC-powered Order Detail with status tracking and live polling.
 */
"use client";

import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  MapPin,
  Package,
  Phone,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { useOrderByNumber, useCancelOrder } from "@/hooks/use-customer-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_STEPS = [
  { key: "pending", label: "Order Placed", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "processing", label: "Processing", icon: Package },
  { key: "shipped", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  processing: 2,
  shipped: 3,
  delivered: 4,
  cancelled: -1,
};

interface OrpcOrderDetailProps {
  orderNumber: string;
}

export function OrpcOrderDetail({ orderNumber }: OrpcOrderDetailProps) {
  const { data, isLoading, isError } = useOrderByNumber(orderNumber);
  const cancelOrder = useCancelOrder();

  if (isLoading) return <OrderDetailSkeleton />;

  if (isError || !data?.order) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Order not found
        </h3>
        <p className="text-sm text-gray-500">
          We couldn't find order #{orderNumber}
        </p>
        <Link href="/customer/account/orders" className="mt-4">
          <Button variant="outline">Back to Orders</Button>
        </Link>
      </div>
    );
  }

  const order = data.order;
  const items = order.items || [];
  const isCancelled = order.status === "cancelled";
  const currentStep = STATUS_ORDER[order.status] ?? 0;

  const formatPrice = (price: number | string) =>
    `৳${Number(price).toLocaleString("en-BD")}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/customer/account/orders"
            className="inline-flex items-center text-sm text-gray-500 hover:text-emerald-600 mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Orders
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Order #{order.orderNumber}
          </h1>
          <p className="text-sm text-gray-500">
            Placed on{" "}
            {order.createdAt
              ? format(new Date(order.createdAt), "PPP 'at' p")
              : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(order.orderNumber)}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy #
          </Button>
        </div>
      </div>

      {/* Status Tracker */}
      {!isCancelled && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Order Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((step, idx) => {
                const isComplete = idx <= currentStep;
                const isCurrent = idx === currentStep;
                const StepIcon = step.icon;
                return (
                  <div
                    key={step.key}
                    className="flex flex-col items-center relative flex-1"
                  >
                    {idx > 0 && (
                      <div
                        className={`absolute top-4 -left-1/2 w-full h-0.5 ${
                          idx <= currentStep ? "bg-emerald-500" : "bg-gray-200"
                        }`}
                        style={{ zIndex: 0 }}
                      />
                    )}
                    <div
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                        isCurrent
                          ? "bg-emerald-500 text-white ring-4 ring-emerald-100"
                          : isComplete
                            ? "bg-emerald-500 text-white"
                            : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <span
                      className={`text-xs mt-1.5 text-center ${
                        isComplete
                          ? "text-emerald-700 font-medium"
                          : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancelled Banner */}
      {isCancelled && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="font-medium text-red-800">Order Cancelled</p>
            <p className="text-sm text-red-600">
              This order has been cancelled.
            </p>
          </div>
        </div>
      )}

      {/* OTP Card */}
      {order.deliveryOTP && !isCancelled && order.status !== "delivered" && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  Delivery OTP
                </p>
                <p className="text-xs text-emerald-600">
                  Share this code with the delivery person
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold tracking-widest text-emerald-700">
                  {order.deliveryOTP}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(order.deliveryOTP)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Order Items */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Order Items ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((item: any) => (
                  <div key={item.id} className="flex gap-3 py-2">
                    <div className="relative h-14 w-14 rounded-md overflow-hidden bg-gray-100 shrink-0">
                      {item.product?.image ? (
                        <Image
                          src={item.product.image}
                          alt={item.product?.name || ""}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      ) : (
                        <Package className="h-6 w-6 text-gray-400 absolute inset-0 m-auto" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.product?.name || "Product"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.product?.size} × {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {formatPrice(Number(item.price) * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <Separator className="my-3" />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>
                    {formatPrice(order.subtotal || order.totalAmount)}
                  </span>
                </div>
                {order.shippingCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipping</span>
                    <span>{formatPrice(order.shippingCost)}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatPrice(order.discount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-emerald-600">
                    {formatPrice(order.totalAmount)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Shipping Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Delivery Details
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span>{order.shippingName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-gray-400" />
                <span>{order.shippingPhone}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5" />
                <span>
                  {order.shippingAddress}
                  {order.shippingCity ? `, ${order.shippingCity}` : ""}
                  {order.shippingArea ? `, ${order.shippingArea}` : ""}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Method</span>
                <Badge variant="secondary" className="capitalize text-xs">
                  {(order.paymentMethod || "cod").replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <Badge
                  variant="secondary"
                  className={`text-xs capitalize ${
                    order.paymentStatus === "paid"
                      ? "bg-green-50 text-green-700"
                      : "bg-yellow-50 text-yellow-700"
                  }`}
                >
                  {order.paymentStatus || "pending"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          {order.status === "pending" && (
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => {
                if (confirm("Are you sure you want to cancel this order?")) {
                  cancelOrder.mutate({ orderId: order.id });
                }
              }}
              disabled={cancelOrder.isPending}
            >
              {cancelOrder.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Cancel Order
            </Button>
          )}

          {/* Customer Note */}
          {order.customerNote && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Your Note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{order.customerNote}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div>
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-7 w-48 mb-1" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
