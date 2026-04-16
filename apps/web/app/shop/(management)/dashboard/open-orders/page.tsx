"use client";

import {
  Clock,
  DollarSign,
  Loader2,
  Lock,
  MapPin,
  Package,
  Send,
  Store,
  Unlock,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  useLockOpenOrder,
  useOpenOrderPool,
  useReleaseOpenOrder,
  useSubmitOffer,
} from "@/hooks/use-shop-owner-api";

const formatPrice = (price: number | string) =>
  new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(Number(price));

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
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  const isExpired = remaining === "Expired";
  const isLow = !isExpired && parseInt(remaining) < 1;

  return (
    <div
      className={`flex items-center gap-1.5 font-mono text-sm font-bold ${
        isExpired
          ? "text-red-500"
          : isLow
            ? "text-amber-500 animate-pulse"
            : "text-emerald-600"
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      {remaining}
    </div>
  );
}

export default function OpenOrdersPoolPage() {
  const { data, isLoading } = useOpenOrderPool();
  const lockMutation = useLockOpenOrder();
  const releaseMutation = useReleaseOpenOrder();
  const submitMutation = useSubmitOffer();

  // Per-bid price state: { [bidId]: { items: { [bidItemId]: string }, deliveryCharge: string } }
  const [priceState, setPriceState] = useState<
    Record<
      number,
      { items: Record<number, string>; deliveryCharge: string }
    >
  >({});

  const pool = (data as any)?.pool ?? [];

  const initPricesForBid = (bid: any) => {
    if (priceState[bid.bidId]) return;
    const items: Record<number, string> = {};
    for (const item of bid.items ?? []) {
      items[item.id] = item.unitPrice ?? "";
    }
    setPriceState((prev) => ({
      ...prev,
      [bid.bidId]: { items, deliveryCharge: "40" },
    }));
  };

  const handleLock = async (bidId: number, bid: any) => {
    initPricesForBid(bid);
    await lockMutation.mutateAsync({ bidId });
  };

  const handleRelease = async (bidId: number) => {
    await releaseMutation.mutateAsync({ bidId });
  };

  const handleSubmit = async (bid: any) => {
    const ps = priceState[bid.bidId];
    if (!ps) return;

    await submitMutation.mutateAsync({
      bidId: bid.bidId,
      deliveryCharge: ps.deliveryCharge,
      items: Object.entries(ps.items).map(([bidItemId, sellerPrice]) => ({
        bidItemId: Number(bidItemId),
        sellerPrice,
      })),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
          <p className="text-sm text-gray-500">Loading open orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Open Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pool.length} order{pool.length !== 1 ? "s" : ""} available near
            your shop
          </p>
        </div>
        <Badge variant="outline" className="text-emerald-600 border-emerald-200">
          <Store className="h-3.5 w-3.5 mr-1" />
          Auto-refreshing
        </Badge>
      </div>

      {pool.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-gray-600">No open orders right now</p>
            <p className="text-sm text-gray-400 mt-1">
              New orders will appear here automatically
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pool.map((bid: any) => (
            <Card
              key={bid.bidId}
              className={`border shadow-sm transition-all ${
                bid.status === "locked"
                  ? "border-purple-200 bg-purple-50/30 ring-1 ring-purple-100"
                  : "border-gray-200 hover:shadow-md"
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-600" />
                    Order #{bid.orderNumber}
                    {bid.subOrderLabel && (
                      <span className="text-xs font-normal text-gray-400">
                        — {bid.subOrderLabel}
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        bid.status === "locked" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {bid.status === "available" ? "Available" : "Locked by you"}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" />
                      {bid.distanceKm} km
                    </div>
                  </div>
                </div>
                {bid.status === "locked" && bid.expiresAt && (
                  <CountdownTimer expiresAt={bid.expiresAt} />
                )}
              </CardHeader>

              <CardContent className="pt-0 space-y-4">
                {/* Items */}
                <div className="space-y-2">
                  {bid.items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 bg-white/70 rounded-lg border border-gray-100"
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
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Platform price</p>
                        <p className="text-sm font-semibold">
                          {formatPrice(item.unitPrice)}
                        </p>
                      </div>

                      {/* Seller price input (only when locked) */}
                      {bid.status === "locked" && priceState[bid.bidId] && (
                        <div className="w-28">
                          <Label className="text-xs text-purple-600">
                            Your price
                          </Label>
                          <Input
                            type="number"
                            className="h-8 text-sm"
                            value={
                              priceState[bid.bidId]?.items?.[item.id] ?? ""
                            }
                            onChange={(e) =>
                              setPriceState((prev) => ({
                                ...prev,
                                [bid.bidId]: {
                                  ...prev[bid.bidId]!,
                                  items: {
                                    ...prev[bid.bidId]!.items,
                                    [item.id]: e.target.value,
                                  },
                                },
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Meta + Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>
                      Subtotal: <strong>{formatPrice(bid.subtotal)}</strong>
                    </span>
                    <span>
                      Area: <strong>{bid.shippingArea || "—"}</strong>
                    </span>
                  </div>

                  {bid.status === "available" ? (
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                      disabled={lockMutation.isPending}
                      onClick={() => handleLock(bid.bidId, bid)}
                    >
                      {lockMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Lock className="h-4 w-4 mr-1" />
                      )}
                      Lock & Review
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {/* Delivery charge input */}
                      {priceState[bid.bidId] && (
                        <div className="w-28">
                          <Label className="text-xs">Delivery ৳</Label>
                          <Input
                            type="number"
                            className="h-8 text-sm"
                            value={priceState[bid.bidId]?.deliveryCharge ?? ""}
                            onChange={(e) =>
                              setPriceState((prev) => ({
                                ...prev,
                                [bid.bidId]: {
                                  ...prev[bid.bidId]!,
                                  deliveryCharge: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-300"
                        disabled={releaseMutation.isPending}
                        onClick={() => handleRelease(bid.bidId)}
                      >
                        {releaseMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Unlock className="h-4 w-4 mr-1" />
                        )}
                        Release
                      </Button>

                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={submitMutation.isPending}
                        onClick={() => handleSubmit(bid)}
                      >
                        {submitMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Submit Offer
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
