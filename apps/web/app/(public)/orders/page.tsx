import {
  Calendar,
  ChevronRight,
  MapPin,
  Package,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { getMyOrders } from "@/actions/order/order-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function OrdersPage() {
  const result = await getMyOrders();
  const orders = result.orders || [];

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
    }).format(Number(price));
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-BD", {
      dateStyle: "medium",
    }).format(new Date(date));
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
      confirmed: "bg-blue-100 text-blue-800 border-blue-200",
      processing: "bg-purple-100 text-purple-800 border-purple-200",
      shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
      delivered: "bg-green-100 text-green-800 border-green-200",
      cancelled: "bg-red-100 text-red-800 border-red-200",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto text-center">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">No orders yet</h1>
            <p className="text-muted-foreground mb-6">
              You haven&apos;t placed any orders yet. Start shopping and your
              orders will appear here.
            </p>
            <Button asChild>
              <Link href="/products">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Start Shopping
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">My Orders</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your orders
          </p>
        </div>

        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/order-confirmation/${order.orderNumber}`}
            >
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-lg">
                          {order.orderNumber}
                        </span>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(order.createdAt)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Package className="h-4 w-4" />
                          {order.items.length} items
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {order.shippingCity}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-xl font-bold">
                          {formatPrice(order.total)}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
