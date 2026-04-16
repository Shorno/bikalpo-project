"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Package,
  Radio,
  Search,
  ShoppingBag,
  Store,
  Trophy,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useOpenOrderStatus } from "@/hooks/use-customer-api";

const formatPrice = (price: number | string) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(Number(price));

const STAGE_CONFIG = {
  splitting: {
    label: "Splitting Order",
    color: "bg-blue-500",
    icon: Package,
    progress: 10,
  },
  broadcasting: {
    label: "Finding Shops",
    color: "bg-amber-500",
    icon: Radio,
    progress: 30,
  },
  negotiating: {
    label: "Receiving Offers",
    color: "bg-purple-500",
    icon: Store,
    progress: 60,
  },
  finalizing: {
    label: "Finalizing",
    color: "bg-emerald-500",
    icon: CheckCircle2,
    progress: 85,
  },
  confirmed: {
    label: "Confirmed!",
    color: "bg-emerald-600",
    icon: Trophy,
    progress: 100,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-red-500",
    icon: XCircle,
    progress: 0,
  },
};

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const target = new Date(expiresAt).getTime();

    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemaining("Expired");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired = remaining === "Expired";

  return (
    <span
      className={`font-mono text-sm font-semibold ${isExpired ? "text-red-500" : "text-amber-600"}`}
    >
      {remaining}
    </span>
  );
}

export default function OpenOrderTrackerPage() {
  const params = useParams();
  const orderId = Number(params.orderId);
  const { data, isLoading, error } = useOpenOrderStatus(
    isNaN(orderId) ? undefined : orderId,
    3000,
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
          <p className="text-gray-500 text-sm">Loading order status...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <XCircle className="h-16 w-16 mx-auto text-red-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
        <p className="text-gray-500 mb-6">
          {error?.message || "Could not load order status."}
        </p>
        <Button asChild variant="outline">
          <Link href="/shop/account">Go to My Orders</Link>
        </Button>
      </div>
    );
  }

  const stage =
    STAGE_CONFIG[data.stage as keyof typeof STAGE_CONFIG] ??
    STAGE_CONFIG.broadcasting;
  const StageIcon = stage.icon;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-8">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/shop/account"
            className="inline-flex items-center text-sm text-gray-500 hover:text-emerald-600 mb-3 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            My Orders
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Open Order Tracker
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Order #{data.orderNumber}
              </p>
            </div>
            {data.broadcastExpiresAt && (
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-0.5">
                  Broadcast closes in
                </p>
                <CountdownTimer expiresAt={data.broadcastExpiresAt} />
              </div>
            )}
          </div>
        </div>

        {/* Stage Indicator */}
        <Card className="mb-6 border-0 shadow-md overflow-hidden">
          <div className={`h-1.5 ${stage.color}`} />
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`p-2 rounded-full ${stage.color} bg-opacity-10`}
              >
                <StageIcon
                  className={`h-5 w-5 ${stage.color.replace("bg-", "text-")}`}
                />
              </div>
              <div>
                <p className="font-semibold text-lg">{stage.label}</p>
                <p className="text-xs text-gray-500">
                  {data.stage === "broadcasting" &&
                    "We're finding the best shops near you..."}
                  {data.stage === "negotiating" &&
                    "Shops are submitting their offers!"}
                  {data.stage === "finalizing" &&
                    "Almost done — selecting winners for remaining items"}
                  {data.stage === "confirmed" &&
                    "All items have been matched with shops!"}
                  {data.stage === "cancelled" &&
                    "No shops could fulfill this order"}
                </p>
              </div>
            </div>
            {data.stage !== "cancelled" && (
              <Progress value={stage.progress} className="h-2" />
            )}
          </CardContent>
        </Card>

        {/* Sub-Orders */}
        <div className="space-y-4">
          {data.subOrders?.map((sub: any) => (
            <Card key={sub.subOrderId} className="border-gray-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-emerald-600" />
                    {sub.label || "Items"}
                  </CardTitle>
                  <Badge
                    variant={
                      sub.status === "confirmed"
                        ? "default"
                        : sub.status === "cancelled"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-xs"
                  >
                    {sub.status === "matching_shop"
                      ? "Finding shops"
                      : sub.status === "negotiating"
                        ? "Getting offers"
                        : sub.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Items */}
                <div className="space-y-2">
                  {sub.items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                    >
                      <div className="relative h-10 w-10 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                        <Image
                          src={item.productImage || "/placeholder-image.svg"}
                          alt={item.productName}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.productName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.productSize} × {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">
                        {formatPrice(item.totalPrice)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Bids */}
                {sub.bids && sub.bids.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        <Store className="h-3.5 w-3.5 inline mr-1" />
                        Offers ({sub.offersReceived || 0} received)
                      </p>
                      <div className="space-y-2">
                        {sub.bids
                          .filter(
                            (b: any) =>
                              b.status === "submitted" || b.isWinner,
                          )
                          .map((bid: any) => (
                            <div
                              key={bid.bidId}
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                bid.isWinner
                                  ? "bg-emerald-50 border-emerald-200"
                                  : "bg-white border-gray-200"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {bid.isWinner && (
                                  <Trophy className="h-4 w-4 text-emerald-600" />
                                )}
                                <div>
                                  <p className="text-sm font-medium">
                                    {bid.shopName}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <MapPin className="h-3 w-3" />
                                    {bid.distanceKm} km
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <p
                                  className={`text-sm font-bold ${bid.isWinner ? "text-emerald-600" : ""}`}
                                >
                                  {formatPrice(bid.totalBid || 0)}
                                </p>
                                {bid.deliveryCharge && (
                                  <p className="text-xs text-gray-400">
                                    +{formatPrice(bid.deliveryCharge)}{" "}
                                    delivery
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Waiting indicator */}
                {sub.status === "matching_shop" && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                    <Search className="h-4 w-4 animate-pulse" />
                    <span>Searching for nearby shops...</span>
                  </div>
                )}

                {/* Winner */}
                {sub.winnerShopName && (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      Matched with{" "}
                      <strong>{sub.winnerShopName}</strong>
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Done state */}
        {data.stage === "confirmed" && (
          <div className="mt-6 text-center">
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <Link href="/shop/account">View My Orders</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
