"use client";

import {
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  History,
  Inbox,
  Loader2,
  LockKeyhole,
  MapPin,
  ReceiptText,
  Send,
  ShieldCheck,
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

function OfferBreakdown({
  subtotal,
  discount,
  delivery,
  total,
}: {
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
}) {
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-4">
        <dt className="text-slate-500">Items subtotal</dt>
        <dd className="font-medium tabular-nums text-slate-900">
          {money.format(subtotal)}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="text-slate-500">Discount</dt>
        <dd className="font-medium tabular-nums text-emerald-700">
          −{money.format(discount)}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4">
        <dt className="text-slate-500">Delivery charge</dt>
        <dd className="font-medium tabular-nums text-slate-900">
          {money.format(delivery)}
        </dd>
      </div>
      <div className="flex items-end justify-between gap-4 border-t border-slate-200 pt-4">
        <dt>
          <span className="block font-semibold text-slate-950">
            Final total
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-500">
            Customer pays on delivery
          </span>
        </dt>
        <dd className="text-xl font-bold tracking-tight tabular-nums text-slate-950">
          {money.format(total)}
        </dd>
      </div>
    </dl>
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
        sum +
        Number(item.currentStorePrice ?? item.retailerPrice) * item.quantity,
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
    <div className="mx-auto max-w-7xl space-y-7 pb-12">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-emerald-600" />
        <div className="flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              <Store className="size-3.5" aria-hidden="true" /> Retailer offer
              desk
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Open orders
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              Review exact-stock requests, prepare one complete price, and
              follow the customer’s decision from a single workspace.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div className="min-w-32 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Work queue
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                <span className="mr-1.5 text-xl font-bold tabular-nums text-emerald-700">
                  {pool.length}
                </span>
                active
              </p>
            </div>
            <div className="min-w-32 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Updates
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span
                  className={`relative flex size-2.5 ${isConnected ? "text-emerald-500" : "text-amber-500"}`}
                >
                  {isConnected && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                  )}
                  <span className="relative inline-flex size-2.5 rounded-full bg-current" />
                </span>
                {isConnected ? "Live" : "Polling"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <Tabs defaultValue="active" className="space-y-5">
        <div className="border-b border-slate-200">
          <TabsList className="h-auto gap-7 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="active"
              className="relative h-11 rounded-none border-0 bg-transparent px-0 text-sm font-semibold text-slate-500 shadow-none after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none data-[state=active]:after:bg-emerald-600"
            >
              Active requests
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">
                {pool.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="relative h-11 rounded-none border-0 bg-transparent px-0 text-sm font-semibold text-slate-500 shadow-none after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none data-[state=active]:after:bg-emerald-600"
            >
              History
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="active" className="mt-0 space-y-5">
          {poolQuery.isLoading ? (
            <div className="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white">
              <div className="text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-emerald-600 motion-reduce:animate-none" />
                <p className="mt-3 text-sm font-medium text-slate-600">
                  Loading active requests…
                </p>
              </div>
            </div>
          ) : pool.length === 0 ? (
            <Card className="overflow-hidden border-dashed border-slate-300 bg-white py-0 shadow-none">
              <CardContent className="px-5 py-16 text-center sm:py-20">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Inbox className="size-6" aria-hidden="true" />
                </span>
                <p className="mt-5 text-lg font-semibold text-slate-900">
                  No active requests
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Exact-stock requests within 10 km appear here automatically.
                  Keep your inventory and Pricing page current to receive
                  eligible requests.
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
              const displayedTotals = frozen
                ? {
                    subtotal: Number(offer.itemSubtotal),
                    discount: Number(offer.discountAmount),
                    delivery: Number(offer.deliveryCharge),
                    total: Number(offer.finalTotal),
                  }
                : totals;
              const submitted = offer.status === "submitted";
              return (
                <Card
                  key={offer.bidId}
                  className="relative gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white py-0 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.45)] ring-0"
                >
                  <div
                    className={`absolute inset-y-0 left-0 w-1 ${frozen ? "bg-amber-400" : "bg-emerald-500"}`}
                  />
                  <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-3.5">
                        <span
                          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${frozen ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                        >
                          {frozen ? (
                            <LockKeyhole
                              className="size-5"
                              aria-hidden="true"
                            />
                          ) : (
                            <ReceiptText
                              className="size-5"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-sm font-bold tracking-tight text-slate-950 sm:text-base">
                              {offer.orderNumber}
                            </p>
                            <Badge
                              variant="outline"
                              className={
                                frozen
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : submitted
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-white text-slate-600"
                              }
                            >
                              {frozen
                                ? "Awaiting customer decision"
                                : submitted
                                  ? "Offer submitted"
                                  : "Action required"}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="size-3.5" aria-hidden="true" />
                              {offer.customerArea || "Service area"}
                            </span>
                            <span>{offer.distanceKm.toFixed(2)} km away</span>
                            <span>
                              {offer.items.length} exact item
                              {offer.items.length === 1 ? "" : "s"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        className={`flex min-w-56 items-center justify-between gap-5 rounded-xl border px-4 py-3 ${frozen ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
                      >
                        <div>
                          <p
                            className={`text-[10px] font-bold uppercase tracking-[0.12em] ${frozen ? "text-amber-700" : "text-emerald-700"}`}
                          >
                            {frozen
                              ? "Customer selects within"
                              : "Submit before"}
                          </p>
                          <div
                            className={`mt-1 text-lg ${frozen ? "text-amber-800" : "text-emerald-800"}`}
                          >
                            <Countdown
                              deadline={
                                frozen
                                  ? offer.selectionDeadline
                                  : offer.offerDeadline
                              }
                            />
                          </div>
                        </div>
                        <Clock3
                          className={`size-5 ${frozen ? "text-amber-600" : "text-emerald-600"}`}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
                      <section className="min-w-0 p-5 sm:p-6 lg:border-r lg:border-slate-100">
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                              Exact inventory match
                            </p>
                            <h3 className="mt-1 text-base font-semibold text-slate-950">
                              Items included in this request
                            </h3>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${frozen ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-100 text-slate-600 ring-slate-200"}`}
                          >
                            {frozen && (
                              <LockKeyhole
                                className="size-3"
                                aria-hidden="true"
                              />
                            )}
                            {frozen ? "Prices frozen" : "Store prices live"}
                          </span>
                        </div>

                        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                          {offer.items.map((item: any) => (
                            <div
                              key={item.id}
                              className="flex min-w-0 items-center gap-3 p-3.5 transition-colors hover:bg-slate-50/80 motion-reduce:transition-none sm:gap-4"
                            >
                              <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:size-14">
                                <Image
                                  src={
                                    item.productImage ||
                                    "/placeholder-image.svg"
                                  }
                                  alt=""
                                  fill
                                  className="object-contain p-1.5"
                                  sizes="56px"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
                                  {item.productName}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                  <span>{item.productSize}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-medium text-slate-600">
                                    Qty {item.quantity}
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-bold tabular-nums text-slate-950">
                                  {money.format(item.retailerPrice)}
                                </p>
                                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                                  Per item
                                </p>
                              </div>
                              {!frozen && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  asChild
                                  className="size-10 shrink-0 border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 sm:hidden"
                                >
                                  <Link
                                    href={item.pricingUrl}
                                    aria-label={`Open Pricing for ${item.productName}`}
                                  >
                                    <ExternalLink className="size-4" />
                                  </Link>
                                </Button>
                              )}
                              {!frozen && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="hidden h-9 shrink-0 border-slate-200 bg-white px-2.5 text-xs text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 sm:inline-flex"
                                >
                                  <Link
                                    href={item.pricingUrl}
                                    aria-label={`Edit store price for ${item.productName}`}
                                  >
                                    Pricing
                                    <ExternalLink className="ml-1.5 size-3.5" />
                                  </Link>
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600">
                          <ShieldCheck
                            className="mt-0.5 size-4 shrink-0 text-emerald-700"
                            aria-hidden="true"
                          />
                          <p>
                            Customer contact details and the exact address stay
                            private until the customer accepts your offer.
                          </p>
                        </div>
                      </section>

                      <aside className="bg-slate-50/70 p-5 sm:p-6">
                        {frozen ? (
                          <div>
                            <div className="flex items-start gap-3">
                              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                                <LockKeyhole
                                  className="size-4.5"
                                  aria-hidden="true"
                                />
                              </span>
                              <div>
                                <p className="text-base font-semibold text-slate-950">
                                  Your offer is locked
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  The customer is comparing frozen offers. No
                                  further changes can be made.
                                </p>
                              </div>
                            </div>

                            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                    Submitted total
                                  </p>
                                  <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-slate-950">
                                    {money.format(displayedTotals.total)}
                                  </p>
                                </div>
                                <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                                  <CircleDollarSign
                                    className="size-5"
                                    aria-hidden="true"
                                  />
                                </span>
                              </div>
                              <OfferBreakdown {...displayedTotals} />
                            </div>

                            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">
                              You will receive an immediate notification if the
                              customer selects this offer.
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start gap-3">
                              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                                <SlidersHorizontal
                                  className="size-4.5"
                                  aria-hidden="true"
                                />
                              </span>
                              <div>
                                <p className="text-base font-semibold text-slate-950">
                                  {submitted
                                    ? "Revise your offer"
                                    : "Build your offer"}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  Product prices come from Pricing. Set only the
                                  discount and delivery charge here.
                                </p>
                              </div>
                            </div>

                            <div className="mt-5 grid grid-cols-2 gap-3.5">
                              <div>
                                <Label
                                  htmlFor={`discount-type-${offer.bidId}`}
                                  className="text-xs font-semibold text-slate-700"
                                >
                                  Discount type
                                </Label>
                                <select
                                  id={`discount-type-${offer.bidId}`}
                                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-shadow focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/15 motion-reduce:transition-none"
                                  value={draft.discountType}
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
                                  className="text-xs font-semibold text-slate-700"
                                >
                                  Discount{" "}
                                  {draft.discountType === "percentage"
                                    ? "%"
                                    : "৳"}
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
                                  className="mt-1.5 h-11 border-slate-200 bg-white focus-visible:border-emerald-500 focus-visible:ring-emerald-500/15"
                                  value={draft.discountValue}
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
                                  className="text-xs font-semibold text-slate-700"
                                >
                                  Delivery charge ৳
                                </Label>
                                <Input
                                  id={`delivery-${offer.bidId}`}
                                  type="number"
                                  min="0"
                                  className="mt-1.5 h-11 border-slate-200 bg-white focus-visible:border-emerald-500 focus-visible:ring-emerald-500/15"
                                  value={draft.deliveryCharge}
                                  onChange={(event) =>
                                    updateDraft(offer, {
                                      deliveryCharge: event.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>

                            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                Offer preview
                              </p>
                              <OfferBreakdown {...displayedTotals} />
                            </div>

                            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row lg:flex-col-reverse xl:flex-row">
                              {submitted && (
                                <Button
                                  variant="outline"
                                  className="h-11 flex-1 border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                                  disabled={withdraw.isPending}
                                  onClick={() =>
                                    withdraw.mutate({ bidId: offer.bidId })
                                  }
                                >
                                  Withdraw
                                </Button>
                              )}
                              <Button
                                className="h-11 flex-1 bg-emerald-600 font-semibold text-white hover:bg-emerald-700 focus-visible:ring-emerald-600"
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
                                  <Loader2 className="mr-2 size-4 animate-spin motion-reduce:animate-none" />
                                ) : (
                                  <Send className="mr-2 size-4" />
                                )}
                                {submitted ? "Update offer" : "Submit offer"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </aside>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)]">
            {historyQuery.isLoading ? (
              <div className="grid min-h-72 place-items-center">
                <div className="text-center">
                  <Loader2 className="mx-auto size-6 animate-spin text-emerald-600 motion-reduce:animate-none" />
                  <p className="mt-3 text-sm font-medium text-slate-600">
                    Loading offer history…
                  </p>
                </div>
              </div>
            ) : history.length === 0 ? (
              <div className="px-5 py-16 text-center sm:py-20">
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <History className="size-6" aria-hidden="true" />
                </span>
                <p className="mt-5 text-lg font-semibold text-slate-900">
                  No offer history yet
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Accepted, withdrawn, expired, and not-selected offers will be
                  recorded here after they leave the active queue.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-end justify-between gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Completed work
                    </p>
                    <h2 className="mt-1 font-semibold text-slate-950">
                      Offer outcomes
                    </h2>
                  </div>
                  <p className="text-xs font-medium tabular-nums text-slate-500">
                    {history.length} record{history.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="divide-y divide-slate-100">
                  {history.map((entry: any) => {
                    const accepted = entry.outcome === "accepted";
                    const expired = entry.outcome === "expired";
                    const label =
                      entry.outcome === "not_selected"
                        ? "Not selected"
                        : entry.outcome === "withdrawn"
                          ? "Withdrawn"
                          : expired
                            ? "Expired"
                            : "Accepted";
                    return (
                      <div
                        key={entry.offerId}
                        className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-slate-50/70 motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between sm:px-6"
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <span
                            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                              accepted
                                ? "bg-emerald-100 text-emerald-700"
                                : expired
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {accepted ? (
                              <CheckCircle2
                                className="size-4.5"
                                aria-hidden="true"
                              />
                            ) : expired ? (
                              <Clock3 className="size-4.5" aria-hidden="true" />
                            ) : (
                              <XCircle
                                className="size-4.5"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-mono text-sm font-bold text-slate-950">
                              {entry.orderNumber}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {new Date(entry.createdAt).toLocaleString(
                                "en-BD",
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 pl-[3.375rem] sm:justify-end sm:pl-0">
                          {entry.finalTotal != null && (
                            <div className="text-right">
                              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                                Offer total
                              </p>
                              <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-950">
                                {money.format(entry.finalTotal)}
                              </p>
                            </div>
                          )}
                          <Badge
                            variant="outline"
                            className={
                              accepted
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : expired
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : "border-slate-200 bg-slate-50 text-slate-600"
                            }
                          >
                            {label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
