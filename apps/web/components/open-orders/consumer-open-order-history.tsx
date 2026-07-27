"use client";

import { format } from "date-fns";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  History,
  Inbox,
  Loader2,
  PackageCheck,
  ReceiptText,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOpenOrderHistory } from "@/hooks/use-customer-api";

const money = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});

type HistoryFilter = "all" | "active" | "confirmed" | "closed";

function stageGroup(stage: string): Exclude<HistoryFilter, "all"> {
  if (["collecting_offers", "selecting_offer"].includes(stage)) {
    return "active";
  }
  if (stage === "confirmed") return "confirmed";
  return "closed";
}

function stagePresentation(entry: any) {
  if (entry.requestStage === "collecting_offers") {
    return {
      label: "Collecting offers",
      detail: "Nearby retailers are preparing complete prices.",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      rail: "bg-amber-400",
      icon: Clock3,
    };
  }
  if (entry.requestStage === "selecting_offer") {
    return {
      label: "Choose an offer",
      detail: "Frozen retailer offers are ready for comparison.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      rail: "bg-emerald-500",
      icon: ReceiptText,
    };
  }
  if (entry.requestStage === "confirmed") {
    const delivered = entry.fulfillmentStatus === "delivered";
    const processing = entry.fulfillmentStatus === "processing";
    return {
      label: delivered
        ? "Delivered"
        : processing
          ? "Processing"
          : "Offer accepted",
      detail: entry.selectedRetailer
        ? `${entry.selectedRetailer} was selected for this complete order.`
        : "A retailer offer was accepted for this order.",
      className: delivered
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800",
      rail: delivered ? "bg-blue-500" : "bg-emerald-500",
      icon: delivered ? PackageCheck : CheckCircle2,
    };
  }
  if (entry.requestStage === "no_offers") {
    return {
      label: "No offers",
      detail: "No retailer submitted a complete offer before the deadline.",
      className: "border-slate-200 bg-slate-50 text-slate-600",
      rail: "bg-slate-300",
      icon: Inbox,
    };
  }
  if (entry.requestStage === "expired") {
    return {
      label: "Selection expired",
      detail: "The offer-selection window ended without a confirmation.",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      rail: "bg-amber-400",
      icon: Clock3,
    };
  }
  return {
    label: "Cancelled",
    detail: "This request was cancelled and all stock holds were released.",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    rail: "bg-rose-400",
    icon: XCircle,
  };
}

export function ConsumerOpenOrderHistory() {
  const query = useOpenOrderHistory();
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const history = (query.data as any)?.history ?? [];
  const counts = {
    all: history.length,
    active: history.filter(
      (entry: any) => stageGroup(entry.requestStage) === "active",
    ).length,
    confirmed: history.filter(
      (entry: any) => stageGroup(entry.requestStage) === "confirmed",
    ).length,
    closed: history.filter(
      (entry: any) => stageGroup(entry.requestStage) === "closed",
    ).length,
  };
  const visible =
    filter === "all"
      ? history
      : history.filter(
          (entry: any) => stageGroup(entry.requestStage) === filter,
        );

  if (query.isLoading) {
    return (
      <div className="grid min-h-96 place-items-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center">
          <Loader2 className="mx-auto size-7 animate-spin text-emerald-600 motion-reduce:animate-none" />
          <p className="mt-3 text-sm font-medium text-slate-600">
            Loading Open Order history…
          </p>
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white px-5 py-14 text-center">
        <XCircle className="mx-auto size-9 text-rose-500" />
        <h1 className="mt-4 text-xl font-semibold text-slate-950">
          Open Order history is unavailable
        </h1>
        <p className="mt-2 text-sm text-slate-500">Please try again shortly.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="absolute inset-x-0 top-0 h-1 bg-emerald-600" />
        <div className="flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.17em] text-emerald-700">
              <History className="size-3.5" aria-hidden="true" /> Open Order
              activity
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Open Order history
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review retailer-offer requests separately from purchases placed
              directly with a store.
            </p>
          </div>
          <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-center">
            {[
              ["Requests", counts.all],
              ["Active", counts.active],
              ["Accepted", counts.confirmed],
            ].map(([label, value], index) => (
              <div
                key={String(label)}
                className={`min-w-24 px-3 py-3 ${index > 0 ? "border-l border-slate-200" : ""}`}
              >
                <p className="text-lg font-bold tabular-nums text-slate-950">
                  {value}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as HistoryFilter)}
      >
        <TabsList>
          {(["all", "active", "confirmed", "closed"] as const).map((value) => (
            <TabsTrigger key={value} value={value} className="capitalize">
              {value === "confirmed" ? "Accepted" : value}
              <span className="hidden rounded-sm bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground sm:inline-flex">
                {counts[value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={filter}>
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Inbox className="size-6" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-lg font-semibold text-slate-900">
                {filter === "all"
                  ? "No Open Orders yet"
                  : `No ${filter === "confirmed" ? "accepted" : filter} Open Orders`}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Open Orders created from public reference products will appear
                here without mixing into your direct store purchases.
              </p>
              {filter === "all" && (
                <Button asChild variant="outline" className="mt-5">
                  <Link href="/products">Browse reference products</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {visible.map((entry: any) => {
                const presentation = stagePresentation(entry);
                const StatusIcon = presentation.icon;
                const displayTotal =
                  entry.finalTotal ?? entry.referenceSubtotal;
                return (
                  <article
                    key={entry.orderId}
                    className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_45px_-40px_rgba(15,23,42,0.55)]"
                  >
                    <div
                      className={`absolute inset-y-0 left-0 w-1 ${presentation.rail}`}
                    />
                    <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                          <StatusIcon className="size-4.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate font-mono text-sm font-bold text-slate-950 sm:text-base">
                              {entry.orderNumber}
                            </h2>
                            <Badge
                              variant="outline"
                              className={presentation.className}
                            >
                              {presentation.label}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Requested{" "}
                            {format(
                              new Date(entry.createdAt),
                              "MMM d, yyyy · h:mm a",
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 pl-[3.25rem] sm:justify-end sm:pl-0">
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                            {entry.finalTotal == null
                              ? "Reference amount"
                              : "Final total"}
                          </p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-950">
                            {money.format(displayTotal)}
                          </p>
                        </div>
                        <Button
                          asChild
                          className="h-10 bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700"
                        >
                          <Link href={`/open-orders/${entry.orderId}`}>
                            Details
                            <ArrowRight className="ml-1.5 size-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-6 text-slate-700">
                          {presentation.detail}
                        </p>
                        <div className="mt-4 flex min-w-0 items-center gap-3">
                          <div className="flex shrink-0 -space-x-2">
                            {entry.items.slice(0, 3).map((item: any) => (
                              <div
                                key={item.id}
                                className="relative size-10 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-sm"
                              >
                                <Image
                                  src={
                                    item.productImage ||
                                    "/placeholder-image.svg"
                                  }
                                  alt=""
                                  fill
                                  sizes="40px"
                                  className="object-contain p-1"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {entry.items[0]?.productName ??
                                "Open Order items"}
                              {entry.items.length > 1
                                ? ` +${entry.items.length - 1} more`
                                : ""}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {entry.items.length} exact item
                              {entry.items.length === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm lg:grid-cols-1">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-500">Offers</dt>
                          <dd className="font-semibold tabular-nums text-slate-900">
                            {entry.offerCount}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-500">Retailer</dt>
                          <dd className="max-w-32 truncate text-right font-semibold text-slate-900">
                            {entry.selectedRetailer ?? "Not selected"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
