"use client";

/** Consumer tracking and offer-selection experience for one Open Order. */

import {
  AlertCircle,
  Check,
  CircleDollarSign,
  Clock3,
  KeyRound,
  Loader2,
  MapPin,
  Radio,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trophy,
  Truck,
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

function OfferStatus({ offer, stage }: { offer: any; stage: string }) {
  if (offer.isWinner) {
    return (
      <Badge className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600">
        <Check className="mr-1 size-3" aria-hidden="true" /> Accepted
      </Badge>
    );
  }
  if (stage === "confirmed") {
    return (
      <Badge
        variant="outline"
        className="border-slate-200 bg-slate-50 text-slate-500"
      >
        Not selected
      </Badge>
    );
  }
  if (["cancelled", "no_offers", "expired"].includes(stage)) {
    return (
      <Badge
        variant="outline"
        className="border-slate-200 bg-slate-50 text-slate-500"
      >
        Closed
      </Badge>
    );
  }
  if (offer.isLowestTotal) {
    return (
      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <Trophy className="mr-1 size-3" aria-hidden="true" /> Best price
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-slate-200 bg-white text-slate-500"
    >
      Available
    </Badge>
  );
}

function offerSelectionLabel(offer: any, stage: string) {
  if (offer.isWinner) return "Selected";
  if (stage === "selecting_offer") return "Select";
  if (stage === "confirmed") return "Not selected";
  return "Closed";
}

function OfferPriceBreakdown({
  offer,
  requestedItems,
}: {
  offer: any;
  requestedItems: any[];
}) {
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_18rem]">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Retailer item prices
        </p>
        <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {offer.items.map((line: any) => {
            const item = requestedItems.find(
              (candidate: any) => candidate.id === line.orderItemId,
            );
            return (
              <div
                key={line.orderItemId}
                className="flex items-center justify-between gap-4 px-3.5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    {item?.productName ?? "Requested item"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item?.productSize} · Qty {item?.quantity ?? 0}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums text-slate-900">
                  {money.format(line.retailerPrice)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <dl className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-500">Items subtotal</dt>
          <dd className="font-medium tabular-nums text-slate-900">
            {money.format(offer.itemSubtotal)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-500">Discount</dt>
          <dd className="font-medium tabular-nums text-emerald-700">
            −{money.format(offer.discountAmount)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-500">Delivery fee</dt>
          <dd className="font-medium tabular-nums text-slate-900">
            {money.format(offer.deliveryCharge)}
          </dd>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-slate-200 pt-3">
          <dt>
            <span className="block font-semibold text-slate-950">
              Final total
            </span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              Cash on delivery
            </span>
          </dt>
          <dd className="text-lg font-bold tabular-nums text-slate-950">
            {money.format(offer.finalTotal)}
          </dd>
        </div>
      </dl>
    </div>
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
  const selectedOfferId = selectedOffer?.offerId ?? null;
  const [detailsOfferId, setDetailsOfferId] = useState<number | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { isConnected } = useOpenOrderUpdates(
    orderId,
    () => void query.refetch(),
  );
  const data = query.data as any;
  const detailsOffer = data?.offers?.find(
    (offer: any) => offer.offerId === detailsOfferId,
  );
  const pickupOtp =
    data?.journey?.fulfillmentMode === "self_pickup"
      ? data.journey.delivery?.otp
      : null;
  const pickupLocation =
    data?.journey?.fulfillmentMode === "self_pickup"
      ? data.journey.pickupLocation
      : null;
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

        {pickupOtp && (
          <section
            className="rounded-2xl border-2 border-blue-700 bg-blue-50 p-5 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6"
            aria-labelledby="pickup-otp-heading"
          >
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-blue-700" />
              <div>
                <h2
                  id="pickup-otp-heading"
                  className="font-semibold text-blue-950"
                >
                  Show this code at pickup
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-blue-900/80">
                  Check the items first. Share this code with store staff only
                  after the order is physically in your hands.
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-blue-200 bg-white px-6 py-4 text-center sm:mt-0 sm:min-w-48">
              <p className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                <KeyRound className="h-3.5 w-3.5" /> Pickup OTP
              </p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-[0.25em] text-blue-950">
                {pickupOtp}
              </p>
            </div>
          </section>
        )}

        {pickupLocation &&
          data.journey?.delivery?.status !== "delivered" && (
            <section
              className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6"
              aria-labelledby="pickup-location-heading"
            >
              <h2
                id="pickup-location-heading"
                className="font-semibold text-amber-950"
              >
                Pickup location
              </h2>
              <div className="mt-3 space-y-1 text-sm text-amber-900/80">
                <p className="font-medium text-amber-950">
                  {pickupLocation.name || "Retailer shop"}
                </p>
                <p>{pickupLocation.address}</p>
                {pickupLocation.phone && <p>Call {pickupLocation.phone}</p>}
              </div>
            </section>
          )}

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
                  The comparison table appears when the offer window closes. You
                  cannot accept an offer early.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {data.offers.length > 0 && (
          <section aria-labelledby="offers-heading">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  Seller offers
                </p>
                <h2
                  id="offers-heading"
                  className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl"
                >
                  Compare complete prices
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Every total is frozen. Choose the retailer that works best for
                  you.
                </p>
              </div>
              <p className="text-xs font-medium text-slate-500">
                Lowest total first · no automatic selection
              </p>
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_55px_-45px_rgba(15,23,42,0.55)] md:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Frozen retailer offers sorted by final total, delivery fee,
                  and distance
                </caption>
                <thead className="bg-slate-950 text-white">
                  <tr className="text-[11px] font-bold uppercase tracking-[0.12em]">
                    <th scope="col" className="px-5 py-3.5">
                      Retailer
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right">
                      Final total
                    </th>
                    <th scope="col" className="px-4 py-3.5 text-right">
                      Delivery fee
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.offers.map((offer: any) => {
                    const canSelect =
                      data.stage === "selecting_offer" && !offer.isWinner;
                    return (
                      <tr
                        key={offer.offerId}
                        className={`transition-colors motion-reduce:transition-none ${
                          offer.isWinner
                            ? "bg-emerald-50/80"
                            : data.stage === "confirmed"
                              ? "bg-slate-50/60"
                              : offer.isLowestTotal
                                ? "bg-emerald-50/35"
                                : "hover:bg-slate-50/80"
                        }`}
                      >
                        <th scope="row" className="px-5 py-4 font-normal">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                                offer.isWinner ||
                                (
                                  data.stage === "selecting_offer" &&
                                    offer.isLowestTotal
                                )
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              <Store className="size-4.5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-semibold text-slate-950">
                                  {offer.shopName}
                                </p>
                                {(offer.isWinner ||
                                  (data.stage === "selecting_offer" &&
                                    offer.isLowestTotal)) && (
                                  <OfferStatus
                                    offer={offer}
                                    stage={data.stage}
                                  />
                                )}
                              </div>
                              <p className="mt-0.5 flex items-center gap-1 text-xs font-normal text-slate-500">
                                <MapPin className="size-3" aria-hidden="true" />
                                {offer.distanceKm.toFixed(2)} km away
                              </p>
                            </div>
                          </div>
                        </th>
                        <td className="px-4 py-4 text-right">
                          <p className="font-bold tabular-nums text-slate-950">
                            {money.format(offer.finalTotal)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Cash on delivery
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-800">
                          {money.format(offer.deliveryCharge)}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-10 border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                              onClick={() => setDetailsOfferId(offer.offerId)}
                            >
                              Details
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-10 min-w-24 bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700 focus-visible:ring-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
                              disabled={!canSelect}
                              onClick={() => setSelectedOffer(offer)}
                            >
                              {offerSelectionLabel(offer, data.stage)}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {data.offers.map((offer: any) => {
                const canSelect =
                  data.stage === "selecting_offer" && !offer.isWinner;
                return (
                  <article
                    key={offer.offerId}
                    className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm ${
                      offer.isWinner
                        ? "border-emerald-500 ring-2 ring-emerald-100"
                        : data.stage === "confirmed"
                          ? "border-slate-200 bg-slate-50/60"
                          : offer.isLowestTotal
                            ? "border-emerald-300"
                            : "border-slate-200"
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                            offer.isWinner ||
                            (
                              data.stage === "selecting_offer" &&
                                offer.isLowestTotal
                            )
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Store className="size-4.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-semibold text-slate-950">
                              {offer.shopName}
                            </h3>
                            {(offer.isWinner ||
                              (data.stage === "selecting_offer" &&
                                offer.isLowestTotal)) && (
                              <OfferStatus offer={offer} stage={data.stage} />
                            )}
                          </div>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="size-3" aria-hidden="true" />
                            {offer.distanceKm.toFixed(2)} km away
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <div className="border-r border-slate-200 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                            Final total
                          </p>
                          <p className="mt-1 text-lg font-bold tabular-nums text-slate-950">
                            {money.format(offer.finalTotal)}
                          </p>
                        </div>
                        <div className="p-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                            Delivery fee
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold tabular-nums text-slate-900">
                            <Truck
                              className="size-4 text-slate-400"
                              aria-hidden="true"
                            />
                            {money.format(offer.deliveryCharge)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 bg-white p-4 pt-3">
                      <div className="grid grid-cols-2 gap-2.5">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-100"
                          onClick={() => setDetailsOfferId(offer.offerId)}
                        >
                          Details
                        </Button>
                        <Button
                          type="button"
                          className="h-11 bg-emerald-600 font-semibold text-white hover:bg-emerald-700 focus-visible:ring-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
                          disabled={!canSelect}
                          onClick={() => setSelectedOffer(offer)}
                        >
                          {canSelect && (
                            <CircleDollarSign
                              className="mr-2 size-4"
                              aria-hidden="true"
                            />
                          )}
                          {offerSelectionLabel(offer, data.stage)}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
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
              <Link href="/account/open-orders">
                <Check className="mr-2 h-4 w-4" /> View Open Order history
              </Link>
            </Button>
          )}
        </div>
      </div>

      {detailsOffer && (
        <Dialog open onOpenChange={(open) => !open && setDetailsOfferId(null)}>
          <DialogContent className="max-h-[min(90dvh,52rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
            <DialogHeader className="border-b border-slate-100 bg-white px-5 py-5 pr-14 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                  Frozen seller offer
                </p>
                <OfferStatus offer={detailsOffer} stage={data.stage} />
              </div>
              <DialogTitle className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                {detailsOffer.shopName}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {detailsOffer.distanceKm.toFixed(2)} km away
                </span>
                <span aria-hidden="true">·</span>
                <span>Cash on delivery</span>
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 overflow-y-auto bg-slate-50 px-4 py-5 sm:px-6 sm:py-6">
              <div className="mb-5 grid overflow-hidden rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/10 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="p-5 sm:p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Complete frozen price
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                    {money.format(detailsOffer.finalTotal)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Includes the retailer’s discount and delivery fee.
                  </p>
                </div>
                <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4 sm:min-w-48 sm:border-t-0 sm:border-l sm:px-6">
                  <span className="flex size-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    <Truck className="size-4.5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Delivery fee
                    </p>
                    <p className="mt-1 font-semibold tabular-nums text-white">
                      {money.format(detailsOffer.deliveryCharge)}
                    </p>
                  </div>
                </div>
              </div>

              <OfferPriceBreakdown
                offer={detailsOffer}
                requestedItems={data.items}
              />
            </div>

            <DialogFooter className="m-0 shrink-0 rounded-none border-slate-200 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-slate-200 bg-white px-5 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Close
                </Button>
              </DialogClose>
              <Button
                type="button"
                className="h-11 min-w-40 bg-emerald-600 px-5 font-semibold text-white hover:bg-emerald-700 focus-visible:ring-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
                disabled={
                  data.stage !== "selecting_offer" || detailsOffer.isWinner
                }
                onClick={() => {
                  const offer = detailsOffer;
                  setDetailsOfferId(null);
                  setSelectedOffer(offer);
                }}
              >
                {data.stage === "selecting_offer" && !detailsOffer.isWinner && (
                  <CircleDollarSign
                    className="mr-2 size-4"
                    aria-hidden="true"
                  />
                )}
                {offerSelectionLabel(detailsOffer, data.stage)}
                {data.stage === "selecting_offer" && !detailsOffer.isWinner
                  ? " this offer"
                  : ""}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selectedOffer && (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setSelectedOffer(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Accept {selectedOffer.shopName}’s offer?
              </AlertDialogTitle>
              <AlertDialogDescription>
                You will pay {money.format(selectedOffer.finalTotal)} by cash on
                delivery. This confirms the order immediately and releases every
                other retailer’s stock hold.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Compare again</AlertDialogCancel>
              <AlertDialogAction
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={accept.isPending || selectedOfferId === null}
                onClick={() => {
                  if (selectedOfferId === null) return;
                  accept.mutate(
                    { orderId, offerId: selectedOfferId },
                    { onSuccess: () => setSelectedOffer(null) },
                  );
                }}
              >
                {accept.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Confirm retailer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

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
