"use client";

import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  Radio,
  Send,
  SlidersHorizontal,
  Store,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useShopOpenOrderUpdates } from "@/hooks/use-open-order-socket";
import {
  useOpenOrderHistory,
  useOpenOrderPool,
  useSubmitOffer,
  useWithdrawOpenOrder,
} from "@/hooks/use-shop-owner-api";

const money = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});

type OfferDraft = {
  discountType: "fixed" | "percentage";
  discountValue: string;
  deliveryCharge: string;
};

function Countdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () =>
      setRemaining(Math.max(0, new Date(deadline).getTime() - Date.now()));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [deadline]);
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1_000);
  return (
    <span className="font-mono font-semibold tabular-nums">
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

export default function OpenOrdersPage() {
  const poolQuery = useOpenOrderPool();
  const historyQuery = useOpenOrderHistory();
  const submit = useSubmitOffer();
  const withdraw = useWithdrawOpenOrder();
  const [drafts, setDrafts] = useState<Record<number, OfferDraft>>({});
  const pool = (poolQuery.data as any)?.pool ?? [];
  const history = (historyQuery.data as any)?.history ?? [];
  const { isConnected } = useShopOpenOrderUpdates(() => {
    void poolQuery.refetch();
    void historyQuery.refetch();
  });

  const draftFor = (offer: any): OfferDraft =>
    drafts[offer.bidId] ?? {
      discountType: offer.discountType ?? "fixed",
      discountValue: String(offer.discountValue ?? 0),
      deliveryCharge: String(offer.deliveryCharge ?? 0),
    };
  const updateDraft = (offer: any, patch: Partial<OfferDraft>) => {
    setDrafts((current) => ({
      ...current,
      [offer.bidId]: { ...draftFor(offer), ...patch },
    }));
  };
  const previewTotal = (offer: any) => {
    const draft = draftFor(offer);
    const subtotal = offer.items.reduce(
      (sum: number, item: any) =>
        sum + Number(item.retailerPrice) * item.quantity,
      0,
    );
    const value = Math.max(0, Number(draft.discountValue) || 0);
    const discount =
      draft.discountType === "percentage"
        ? Math.min(subtotal, (subtotal * Math.min(value, 100)) / 100)
        : Math.min(subtotal, value);
    return {
      subtotal,
      discount,
      delivery: Math.max(0, Number(draft.deliveryCharge) || 0),
      total:
        subtotal - discount + Math.max(0, Number(draft.deliveryCharge) || 0),
    };
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            <Store className="h-3.5 w-3.5" /> Retailer offers
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Open orders
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Quote complete requests using your configured store prices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600">{pool.length} active</Badge>
          <Badge variant="outline" className="border-slate-200 text-slate-600">
            <Radio
              className={`mr-1 h-3 w-3 ${isConnected ? "text-emerald-600" : "text-slate-400"}`}
            />
            {isConnected ? "Live" : "Polling"}
          </Badge>
        </div>
      </header>

      <Tabs defaultValue="active">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="active">
            Active <span className="ml-1.5 text-xs">{pool.length}</span>
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-5 space-y-4">
          {poolQuery.isLoading ? (
            <div className="grid min-h-52 place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : pool.length === 0 ? (
            <Card className="border-dashed border-slate-300 shadow-none">
              <CardContent className="py-14 text-center">
                <Package className="mx-auto h-9 w-9 text-slate-300" />
                <p className="mt-3 font-medium text-slate-800">
                  No active requests
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Exact-stock requests within 5 km will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            pool.map((offer: any) => {
              const frozen =
                Boolean(offer.priceFrozenAt) ||
                new Date(offer.offerDeadline).getTime() <= Date.now();
              const totals = previewTotal(offer);
              const draft = draftFor(offer);
              return (
                <Card
                  key={offer.bidId}
                  className="overflow-hidden border-slate-200 shadow-none"
                >
                  <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-950">
                          {offer.orderNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            offer.status === "submitted"
                              ? "border-emerald-200 text-emerald-700"
                              : "border-slate-200"
                          }
                        >
                          {frozen
                            ? "Awaiting customer"
                            : offer.status === "submitted"
                              ? "Offer submitted"
                              : "Needs offer"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />{" "}
                          {offer.customerArea || "Service area"} ·{" "}
                          {offer.distanceKm.toFixed(2)} km
                        </span>
                        <span className="flex items-center gap-1 text-amber-700">
                          <Clock3 className="h-3.5 w-3.5" />{" "}
                          {frozen ? "Selection window" : "Offers close"}{" "}
                          <Countdown
                            deadline={
                              frozen
                                ? offer.selectionDeadline
                                : offer.offerDeadline
                            }
                          />
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="grid gap-6 lg:grid-cols-[1.45fr_0.75fr]">
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Exact items · store prices
                        </p>
                        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                          {offer.items.map((item: any) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 p-3"
                            >
                              <div className="relative h-11 w-11 overflow-hidden rounded-lg bg-slate-100">
                                <Image
                                  src={
                                    item.productImage ||
                                    "/placeholder-image.svg"
                                  }
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
                                <p className="text-sm font-semibold text-slate-900">
                                  {money.format(item.retailerPrice)}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  Store price
                                </p>
                              </div>
                              {!frozen && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  asChild
                                  className="h-8 w-8 text-slate-500"
                                >
                                  <Link
                                    href={item.pricingUrl}
                                    aria-label={`Edit store price for ${item.productName}`}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Customer contact and exact address remain private
                          until your offer is accepted.
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-4 flex items-center gap-2">
                          <SlidersHorizontal className="h-4 w-4 text-emerald-700" />
                          <p className="font-medium text-slate-900">
                            Offer terms
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label
                              htmlFor={`discount-type-${offer.bidId}`}
                              className="text-xs text-slate-600"
                            >
                              Discount type
                            </Label>
                            <select
                              id={`discount-type-${offer.bidId}`}
                              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                              value={draft.discountType}
                              disabled={frozen}
                              onChange={(event) =>
                                updateDraft(offer, {
                                  discountType: event.target
                                    .value as OfferDraft["discountType"],
                                })
                              }
                            >
                              <option value="fixed">Fixed amount</option>
                              <option value="percentage">Percentage</option>
                            </select>
                          </div>
                          <div>
                            <Label
                              htmlFor={`discount-${offer.bidId}`}
                              className="text-xs text-slate-600"
                            >
                              Discount{" "}
                              {draft.discountType === "percentage" ? "%" : "৳"}
                            </Label>
                            <Input
                              id={`discount-${offer.bidId}`}
                              type="number"
                              min="0"
                              max={
                                draft.discountType === "percentage"
                                  ? "100"
                                  : undefined
                              }
                              className="mt-1 h-9 bg-white"
                              value={draft.discountValue}
                              disabled={frozen}
                              onChange={(event) =>
                                updateDraft(offer, {
                                  discountValue: event.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <Label
                              htmlFor={`delivery-${offer.bidId}`}
                              className="text-xs text-slate-600"
                            >
                              Delivery charge ৳
                            </Label>
                            <Input
                              id={`delivery-${offer.bidId}`}
                              type="number"
                              min="0"
                              className="mt-1 h-9 bg-white"
                              value={draft.deliveryCharge}
                              disabled={frozen}
                              onChange={(event) =>
                                updateDraft(offer, {
                                  deliveryCharge: event.target.value,
                                })
                              }
                            />
                          </div>
                        </div>

                        <Separator className="my-4" />
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-slate-600">Items</dt>
                            <dd>
                              {money.format(
                                frozen ? offer.itemSubtotal : totals.subtotal,
                              )}
                            </dd>
                          </div>
                          <div className="flex justify-between text-emerald-700">
                            <dt>Discount</dt>
                            <dd>
                              −
                              {money.format(
                                frozen ? offer.discountAmount : totals.discount,
                              )}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-slate-600">Delivery</dt>
                            <dd>
                              {money.format(
                                frozen ? offer.deliveryCharge : totals.delivery,
                              )}
                            </dd>
                          </div>
                          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
                            <dt>Final total</dt>
                            <dd>
                              {money.format(
                                frozen ? offer.finalTotal : totals.total,
                              )}
                            </dd>
                          </div>
                        </dl>

                        {!frozen && (
                          <div className="mt-4 flex gap-2">
                            {offer.status === "submitted" && (
                              <Button
                                variant="outline"
                                className="flex-1"
                                disabled={withdraw.isPending}
                                onClick={() =>
                                  withdraw.mutate({ bidId: offer.bidId })
                                }
                              >
                                Withdraw
                              </Button>
                            )}
                            <Button
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                              disabled={submit.isPending}
                              onClick={() =>
                                submit.mutate({
                                  bidId: offer.bidId,
                                  discountType: draft.discountType,
                                  discountValue:
                                    Number(draft.discountValue) || 0,
                                  deliveryCharge:
                                    Number(draft.deliveryCharge) || 0,
                                })
                              }
                            >
                              {submit.isPending ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="mr-2 h-4 w-4" />
                              )}
                              {offer.status === "submitted"
                                ? "Revise offer"
                                : "Submit offer"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {historyQuery.isLoading ? (
              <div className="grid min-h-44 place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="py-14 text-center text-sm text-slate-500">
                No offer history yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map((entry: any) => (
                  <div
                    key={entry.offerId}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {entry.orderNumber}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(entry.createdAt).toLocaleString("en-BD")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {entry.finalTotal != null && (
                        <span className="text-sm font-semibold">
                          {money.format(entry.finalTotal)}
                        </span>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          entry.outcome === "accepted"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 text-slate-600"
                        }
                      >
                        {entry.outcome === "accepted" ? (
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        ) : (
                          <XCircle className="mr-1 h-3.5 w-3.5" />
                        )}
                        {entry.outcome.replaceAll("_", " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
