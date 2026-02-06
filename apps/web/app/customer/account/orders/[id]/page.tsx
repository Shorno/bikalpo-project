import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  KeyRound,
  Package,
  RotateCcw,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderDetails } from "@/actions/order/order-actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/utils/currency";

const ORDER_STEPS = [
  { key: "pending", label: "Order Placed", icon: Package },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "processing", label: "Processing", icon: Clock },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
] as const;

function getStepIndex(status: string, deliveryStatus?: string): number {
  if (status === "delivered") return 4;
  if (deliveryStatus === "out_for_delivery") return 3;
  if (status === "processing") return 2;
  if (status === "confirmed") return 1;
  return 0;
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = Number(id);

  const orderResult = await getOrderDetails(orderId);

  if (!orderResult.success || !orderResult.order) {
    notFound();
  }

  const order = orderResult.order;
  const deliveryInfo = orderResult.deliveryInfo;
  const currentStep = getStepIndex(order.status, deliveryInfo?.status);
  const showOtp =
    deliveryInfo?.otp && deliveryInfo.status === "out_for_delivery";

  const displaySubtotal =
    order.status !== "pending" && order.confirmedSubtotal != null
      ? order.confirmedSubtotal
      : order.subtotal;
  const displayTotal =
    order.status !== "pending" && order.confirmedTotal != null
      ? order.confirmedTotal
      : order.total;
  const showPriceChangeBanner =
    order.status === "pending" &&
    order.previousTotal != null &&
    Number(order.previousTotal) !== Number(order.total);

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/account/orders"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order Details</h1>
            <p className="text-sm text-gray-500 mt-1">
              Order #{order.orderNumber} •{" "}
              {format(new Date(order.createdAt), "MMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {order.status === "delivered" && (
              <Link
                href={`/customer/reorder/${order.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Reorder
              </Link>
            )}
            <Badge className="w-fit bg-emerald-50 text-emerald-700 border-emerald-100 px-3 py-1 text-sm font-medium">
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Price change notification (pending only) */}
      {showPriceChangeBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="font-semibold text-amber-800">Price updated</p>
          <p className="text-sm text-amber-700 mt-1">
            Your order total has been updated. Previous total:{" "}
            {order.previousTotal != null
              ? formatPrice(order.previousTotal)
              : "—"}{" "}
            → New total: {formatPrice(order.total)}
          </p>
        </div>
      )}

      {/* OTP Card - Prominent when out for delivery */}
      {showOtp && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-6">
          <div className="flex items-center gap-2 text-emerald-700 mb-3">
            <KeyRound className="h-5 w-5" />
            <span className="font-semibold">Your Delivery OTP</span>
          </div>
          <p className="text-sm text-emerald-600/80 mb-4">
            Share this code with the delivery person to receive your order.
          </p>
          <div className="flex items-center justify-center bg-white rounded-lg py-5 border-2 border-dashed border-emerald-200">
            <span className="text-4xl font-bold tracking-[0.5em] font-mono text-emerald-600">
              {deliveryInfo.otp}
            </span>
          </div>
          <p className="text-xs text-emerald-600/70 mt-3 text-center font-medium">
            ⚠️ Only share this code when you physically receive your order
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Progress & Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Progress */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Order Status</h2>
            </div>
            <div className="p-6">
              <div className="relative flex flex-col gap-6">
                {ORDER_STEPS.map((step, index) => {
                  const isCompleted = index <= currentStep;
                  const isCurrent = index === currentStep;
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.key}
                      className="flex items-center gap-4 relative z-10"
                    >
                      <div
                        className={cn(
                          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                          isCompleted
                            ? "bg-emerald-600 text-white"
                            : "bg-gray-100 text-gray-400",
                          isCurrent ? "ring-4 ring-emerald-50" : "",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p
                          className={cn(
                            "font-medium",
                            isCompleted ? "text-gray-900" : "text-gray-400",
                          )}
                        >
                          {step.label}
                        </p>
                        {isCurrent && (
                          <p className="text-xs text-emerald-600 font-medium">
                            Currently here
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Connector Line */}
                <div
                  className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-100 -z-0"
                  aria-hidden="true"
                >
                  <div
                    className="w-full bg-emerald-600 transition-all duration-500"
                    style={{
                      height: `${(currentStep / (ORDER_STEPS.length - 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Order Items</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center gap-4 p-4">
                  <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                    {item.productImage ? (
                      <Image
                        src={item.productImage}
                        alt={item.productName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {item.productName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatPrice(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {formatPrice(item.totalPrice)}
                  </p>
                </div>
              ))}
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(displaySubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Shipping</span>
                <span>{formatPrice(order.shippingCost)}</span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount</span>
                  <span>-{formatPrice(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-xl text-emerald-600">
                  {formatPrice(displayTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                Delivery Information
              </h2>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div>
                <p className="text-gray-500 mb-1">Shipping Address</p>
                <p className="font-medium text-gray-900">
                  {order.shippingName}
                </p>
                <p className="text-gray-900">{order.shippingAddress}</p>
                <p className="text-gray-900">
                  {order.shippingCity}, {order.shippingPostalCode}
                </p>
                <p className="text-gray-900">{order.shippingPhone}</p>
              </div>
              {order.customerNote && (
                <div>
                  <p className="text-gray-500 mb-1">Order Note</p>
                  <p className="text-gray-900 italic italic">
                    "{order.customerNote}"
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                Payment Information
              </h2>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Method</span>
                <span className="font-medium text-gray-900">
                  {order.paymentMethod.replace(/_/g, " ").toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <Badge
                  className={cn(
                    "px-2 py-0.5 text-xs font-medium border-0",
                    order.paymentStatus === "paid"
                      ? "bg-green-50 text-green-700"
                      : "bg-yellow-50 text-yellow-700",
                  )}
                >
                  {order.paymentStatus.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
