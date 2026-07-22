"use client";

import {
  AlertCircle,
  Check,
  Clock3,
  Loader2,
  MapPin,
  Radio,
  ShoppingBag,
  Store,
  Trophy,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  useAcceptOpenOrderOffer,
  useCancelOpenOrder,
  useOpenOrderStatus,
} from "@/hooks/use-customer-api";
import { useOpenOrderUpdates } from "@/hooks/use-open-order-socket";

const money = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});

function Countdown({ deadline }: { deadline: string | null }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const update = () =>
      setRemaining(Math.max(0, new Date(deadline).getTime() - Date.now()));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [deadline]);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return (
    <span className="font-mono text-sm font-semibold tabular-nums text-amber-700">
      {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}

export default function OpenOrderTrackerPage() {
  const orderId = Number(useParams<{ orderId: string }>().orderId);
  const query = useOpenOrderStatus(
    Number.isFinite(orderId) ? orderId : undefined,
    3_000,
  );
  const accept = useAcceptOpenOrderOffer();
  const cancel = useCancelOpenOrder();
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { isConnected } = useOpenOrderUpdates(
    orderId,
    () => void query.refetch(),
  );
  const data = query.data as any;
  const terminal = ["confirmed", "cancelled", "no_offers", "expired"].includes(
    data?.stage,
  );

  useEffect(() => {
    if (terminal) query.refetch();
  }, [terminal, query.refetch]);

  const activeDeadline = useMemo(
    () =>
      data?.stage === "collecting_offers"
        ? data.offerDeadline
        : data?.stage === "selecting_offer"
          ? data.selectionDeadline
          : null,
    [data],
  );

  if (query.isLoading) {
    return (
      <div className="grid min-h-[65vh] place-items-center bg-slate-50">
        <div className="text-center text-slate-600">
          <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-emerald-600" />
          Loading your request…
        </div>
      </div>
    );
  }
  if (!data || query.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-500" />
        <h1 className="text-xl font-semibold text-slate-950">
          Request unavailable
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {query.error?.message ?? "This open order could not be loaded."}
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50/80 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-slate-200 text-slate-600"
                >
                  {data.orderNumber}
                </Badge>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Radio
                    className={`h-3.5 w-3.5 ${isConnected ? "text-emerald-600" : "text-slate-400"}`}
                  />
                  {isConnected ? "Live updates" : "Polling updates"}
                </span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                {data.stage === "collecting_offers"
                  ? "Retailers are preparing offers"
                  : data.stage === "selecting_offer"
                    ? "Choose the offer that works for you"
                    : data.stage === "confirmed"
                      ? "Your order is confirmed"
                      : data.stage === "no_offers"
                        ? "No complete offers were received"
                        : data.stage === "expired"
                          ? "The selection window expired"
                          : "This request was cancelled"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {data.stage === "collecting_offers"
                  ? "Offers stay private until the collection window ends, so every retailer works from the same deadline."
                  : data.stage === "selecting_offer"
                    ? "Prices are frozen. Compare the complete totals below—nothing is selected automatically."
                    : data.stage === "confirmed"
                      ? `${data.finalRetailer ?? "The selected retailer"} now has the complete order.`
                      : "All stock holds have been released. Your retailer storefront purchases are unaffected."}
              </p>
            </div>
            {activeDeadline && (
              <div className="flex min-w-44 items-center justify-between gap-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
                    {data.stage === "collecting_offers"
                      ? "Offers close in"
                      : "Select within"}
                  </p>
                  <Countdown deadline={activeDeadline} />
                </div>
                <Clock3 className="h-5 w-5 text-amber-600" />
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-slate-100 pt-5 text-center sm:max-w-lg sm:text-left">
            <div>
              <p className="text-xs text-slate-500">Items</p>
              <p className="mt-1 font-semibold text-slate-900">
                {data.items.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Offers</p>
              <p className="mt-1 font-semibold text-slate-900">
                {data.offerCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Reference subtotal</p>
              <p className="mt-1 font-semibold text-slate-900">
                {money.format(data.referenceSubtotal)}
              </p>
            </div>
          </div>
        </header>

        {data.stage === "collecting_offers" && (
          <Card className="border-slate-200 shadow-none">
            <CardContent className="flex items-start gap-4 p-5 sm:p-6">
              <div className="rounded-full bg-amber-100 p-2.5 text-amber-700">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-slate-900">
                  {data.offerCount === 0
                    ? "Waiting for the first complete offer"
                    : `${data.offerCount} complete offer${data.offerCount === 1 ? "" : "s"} received`}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Comparison cards appear together when the offer window closes.
                  You cannot accept early.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {data.offers.length > 0 && (
          <section aria-labelledby="offers-heading">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Frozen offers
                </p>
                <h2
                  id="offers-heading"
                  className="mt-1 text-xl font-semibold text-slate-950"
                >
                  Compare complete totals
                </h2>
              </div>
              <p className="hidden text-xs text-slate-500 sm:block">
                Sorted by total, delivery, then distance
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {data.offers.map((offer: any) => (
                <article
                  key={offer.offerId}
                  className={`relative overflow-hidden rounded-2xl border bg-white p-5 ${
                    offer.isWinner
                      ? "border-emerald-500 ring-2 ring-emerald-100"
                      : offer.isLowestTotal
                        ? "border-emerald-300"
                        : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-950">
                          {offer.shopName}
                        </h3>
                        {offer.isLowestTotal && !offer.isWinner && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            <Trophy className="mr-1 h-3 w-3" /> Lowest total
                          </Badge>
                        )}
                        {offer.isWinner && (
                          <Badge className="bg-emerald-600">Accepted</Badge>
                        )}
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5" />{" "}
                        {offer.distanceKm.toFixed(2)} km away
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Pay on delivery</p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                        {money.format(offer.finalTotal)}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-600">Items</dt>
                      <dd>{money.format(offer.itemSubtotal)}</dd>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <dt>Discount</dt>
                      <dd>−{money.format(offer.discountAmount)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-600">Delivery</dt>
                      <dd>{money.format(offer.deliveryCharge)}</dd>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <dt>Total</dt>
                      <dd>{money.format(offer.finalTotal)}</dd>
                    </div>
                  </dl>

                  <details className="mt-4 text-sm">
                    <summary className="cursor-pointer font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                      View retailer prices
                    </summary>
                    <div className="mt-3 space-y-2">
                      {offer.items.map((line: any) => {
                        const item = data.items.find(
                          (candidate: any) => candidate.id === line.orderItemId,
                        );
                        return (
                          <div
                            key={line.orderItemId}
                            className="flex justify-between gap-4 text-xs text-slate-600"
                          >
                            <span className="truncate">
                              {item?.productName}
                            </span>
                            <span className="shrink-0">
                              {money.format(line.retailerPrice)} ×{" "}
                              {item?.quantity}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </details>

                  {data.stage === "selecting_offer" && (
                    <Button
                      className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setSelectedOffer(offer)}
                    >
                      Select this offer
                    </Button>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="flex items-center gap-2 font-semibold text-slate-950">
            <ShoppingBag className="h-4 w-4 text-emerald-600" /> Requested items
          </h2>
          <div className="mt-4 divide-y divide-slate-100">
            {data.items.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="relative h-11 w-11 overflow-hidden rounded-lg bg-slate-100">
                  <Image
                    src={item.productImage || "/placeholder-image.svg"}
                    alt=""
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.productName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.productSize} · Qty {item.quantity}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">
                    {money.format(item.referenceTotal)}
                  </p>
                  <p className="text-[11px] text-slate-500">Reference</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {!terminal && (
            <Button
              variant="outline"
              className="text-rose-700 hover:bg-rose-50"
              onClick={() => setCancelOpen(true)}
            >
              <X className="mr-2 h-4 w-4" /> Cancel request
            </Button>
          )}
          {data.stage === "confirmed" && (
            <Button
              asChild
              className="sm:ml-auto bg-emerald-600 hover:bg-emerald-700"
            >
              <Link href="/shop/account">
                <Check className="mr-2 h-4 w-4" /> View confirmed order
              </Link>
            </Button>
          )}
        </div>
      </div>

      <AlertDialog
        open={Boolean(selectedOffer)}
        onOpenChange={(open) => !open && setSelectedOffer(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Accept {selectedOffer?.shopName}’s offer?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You will pay{" "}
              {selectedOffer ? money.format(selectedOffer.finalTotal) : ""} by
              cash on delivery. This confirms the order immediately and releases
              every other retailer’s stock hold.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Compare again</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={accept.isPending}
              onClick={() =>
                accept.mutate(
                  { orderId, offerId: selectedOffer.offerId },
                  { onSuccess: () => setSelectedOffer(null) },
                )
              }
            >
              {accept.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm retailer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this open order?</AlertDialogTitle>
            <AlertDialogDescription>
              Submitted offers will be closed and all retailer stock holds will
              be released. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep request</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              disabled={cancel.isPending}
              onClick={() =>
                cancel.mutate(
                  { orderId },
                  { onSuccess: () => setCancelOpen(false) },
                )
              }
            >
              Cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
