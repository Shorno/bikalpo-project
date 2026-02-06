import {
  CheckCircle2,
  Clock,
  KeyRound,
  Package,
  ShoppingBag,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getActiveOrder } from "@/actions/order/order-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/utils/currency";

// Order status steps
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

export default async function TrackOrderPage() {
  const result = await getActiveOrder();

  // No active order
  if (!result.success || !result.order) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900">No Active Order</h3>
        <p className="text-sm text-gray-500 mt-1">
          You don&apos;t have any pending orders to track.
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/products">
            <ShoppingBag className="h-4 w-4 mr-2" />
            Start Shopping
          </Link>
        </Button>
      </div>
    );
  }

  const order = result.order;
  const deliveryInfo = result.deliveryInfo;
  const currentStep = getStepIndex(order.status, deliveryInfo?.status);
  const showOtp =
    deliveryInfo?.otp && deliveryInfo.status === "out_for_delivery";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Track Your Order</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Order #{order.orderNumber}
        </p>
      </div>

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

      {/* Order Progress */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Order Status</h2>
        </div>
        <div className="p-4">
          <div className="space-y-4">
            {ORDER_STEPS.map((step, index) => {
              const isCompleted = index <= currentStep;
              const isCurrent = index === currentStep;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-center gap-4">
                  <div
                    className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center
                      ${isCompleted ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-400"}
                      ${isCurrent ? "ring-2 ring-emerald-200 ring-offset-2" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium ${isCompleted ? "text-gray-900" : "text-gray-400"}`}
                    >
                      {step.label}
                    </p>
                  </div>
                  {isCurrent && (
                    <Badge className="bg-emerald-50 text-emerald-700 border-0 text-xs">
                      Current
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            Order Summary ({order.items.length} item
            {order.items.length !== 1 ? "s" : ""})
          </h2>
        </div>
        <div className="divide-y divide-gray-50">
          {order.items.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-4">
              <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                <Image
                  src={item.productImage}
                  alt={item.productName}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {item.productName}
                </p>
                <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
              </div>
              <p className="font-medium text-gray-900">
                {formatPrice(item.totalPrice)}
              </p>
            </div>
          ))}
          {order.items.length > 3 && (
            <div className="p-4 text-sm text-gray-500">
              +{order.items.length - 3} more items
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 flex justify-between items-center">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="font-bold text-lg text-gray-900">
            {formatPrice(order.total)}
          </span>
        </div>
      </div>
    </div>
  );
}
