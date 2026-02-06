import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  Mail,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByNumber } from "@/actions/order/order-actions";
import { DeliveryOtpCard } from "@/components/order/delivery-otp-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface OrderConfirmationPageProps {
  params: Promise<{ orderNumber: string }>;
}

export default async function CustomerOrderConfirmationPage({
  params,
}: OrderConfirmationPageProps) {
  const { orderNumber } = await params;

  const result = await getOrderByNumber(orderNumber);

  if (!result.success || !result.order) {
    notFound();
  }

  const order = result.order;

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
    }).format(Number(price));
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-BD", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(date));
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash_on_delivery: "Cash on Delivery",
      bkash: "bKash",
      nagad: "Nagad",
      bank_transfer: "Bank Transfer",
      card: "Card Payment",
    };
    return labels[method] || method;
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-emerald-900 mb-2">
            Order Placed Successfully!
          </h1>
          <p className="text-gray-500 max-w-md mx-auto">
            Thank you for your order. We&apos;ve received your order and will
            process it soon.
          </p>
        </div>

        {/* Order Number Card */}
        <Card className="mb-6 border-emerald-100 bg-emerald-50/50 shadow-sm">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm text-emerald-600/80">Order Number</p>
                <p className="text-2xl font-bold tracking-wider text-emerald-900">
                  {order.orderNumber}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600/80" />
                <span className="text-sm text-emerald-600/80">
                  {formatDate(order.createdAt)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery OTP Card - Shows when order is out for delivery */}
        <DeliveryOtpCard orderId={order.id} />

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Shipping Details */}
          <Card className="shadow-sm border-gray-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
                <MapPin className="h-5 w-5 text-emerald-600" />
                Shipping Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="font-medium text-gray-900">
                  {order.shippingName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Phone className="h-4 w-4" />
                <span>{order.shippingPhone}</span>
              </div>
              {order.shippingEmail && (
                <div className="flex items-center gap-2 text-gray-500">
                  <Mail className="h-4 w-4" />
                  <span>{order.shippingEmail}</span>
                </div>
              )}
              <div className="pt-2">
                <p className="text-sm text-gray-500">{order.shippingAddress}</p>
                <p className="text-sm text-gray-500">
                  {order.shippingArea && `${order.shippingArea}, `}
                  {order.shippingCity}
                  {order.shippingPostalCode && ` - ${order.shippingPostalCode}`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment & Status */}
          <Card className="shadow-sm border-gray-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
                <CreditCard className="h-5 w-5 text-emerald-600" />
                Payment & Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Payment Method</span>
                <span className="font-medium text-gray-900">
                  {getPaymentMethodLabel(order.paymentMethod)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Payment Status</span>
                <Badge
                  variant={
                    order.paymentStatus === "paid" ? "default" : "secondary"
                  }
                  className={
                    order.paymentStatus === "paid"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : ""
                  }
                >
                  {order.paymentStatus}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Order Status</span>
                <Badge
                  variant="outline"
                  className="capitalize border-emerald-200 text-emerald-700 bg-emerald-50"
                >
                  {order.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Items */}
        <Card className="mb-6 shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
              <Package className="h-5 w-5 text-emerald-600" />
              Order Items ({order.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-4">
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                    <Image
                      src={item.productImage}
                      alt={item.productName}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {item.productName}
                    </h4>
                    <p className="text-sm text-gray-500">
                      Size: {item.productSize}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm text-gray-500">
                        {formatPrice(item.unitPrice)} × {item.quantity}
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatPrice(item.totalPrice)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            {/* Order Totals */}
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
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Discount</span>
                  <span>-{formatPrice(order.discount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-semibold text-gray-900">
                <span>Total</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Note */}
        {order.customerNote && (
          <Card className="mb-6 shadow-sm border-gray-100">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900">
                Order Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">{order.customerNote}</p>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            asChild
            variant="outline"
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          >
            <Link href="/customer/orders">
              <Package className="h-4 w-4 mr-2" />
              View All Orders
            </Link>
          </Button>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <Link href="/customer/products">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Continue Shopping
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
