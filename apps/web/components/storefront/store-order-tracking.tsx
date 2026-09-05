"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, PackageSearch } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { storeTrackingOrderHref } from "@/lib/store-tracking-links";
import { orpc } from "@/utils/orpc";

export function StoreOrderTracking({
  shopId,
  viewerId,
  name,
  storeHref,
  trackingHref,
}: {
  shopId: string;
  viewerId: string;
  name: string;
  storeHref: string;
  trackingHref: string;
}) {
  const [page, setPage] = useState(1);
  const router = useRouter();
  const options = orpc.customer.getStoreActiveOrders.queryOptions({
    input: { shopId, page },
  });
  const { data, isPending, isError, refetch } = useQuery({
    ...options,
    queryKey: [...options.queryKey, viewerId],
  });
  const singleOrder =
    data?.total === 1 ? data.orders[0]?.orderNumber : undefined;
  useEffect(() => {
    if (singleOrder)
      router.replace(storeTrackingOrderHref(trackingHref, singleOrder));
  }, [singleOrder, router, trackingHref]);
  useEffect(() => {
    if (data && page > 1 && data.orders.length === 0) setPage(1);
  }, [data, page]);

  return (
    <section
      className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14"
      aria-labelledby="store-tracking-title"
    >
      <Link
        href={storeHref}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to {name}
      </Link>
      <h1
        id="store-tracking-title"
        className="mt-6 text-3xl font-semibold tracking-tight"
      >
        Track your order
      </h1>
      <p className="mt-3 text-muted-foreground">Active orders from {name}.</p>
      {isPending || singleOrder ? (
        <p role="status" className="py-12 text-muted-foreground">
          {singleOrder ? "Opening your order…" : "Loading your orders…"}
        </p>
      ) : isError ? (
        <div className="mt-8 space-y-4">
          <p role="alert">
            We couldn’t load your orders. Please try again. If your session has
            expired, sign in again.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
            <Button asChild>
              <a href={`/login?redirect=${encodeURIComponent(trackingHref)}`}>
                Sign in
              </a>
            </Button>
          </div>
        </div>
      ) : data?.total === 0 ? (
        <div className="mt-8 border-y border-border py-10">
          <PackageSearch
            className="mb-4 size-8 text-primary"
            aria-hidden="true"
          />
          <h2 className="text-xl font-semibold">
            No active orders with {name}
          </h2>
          <p className="mt-3 max-w-prose leading-7 text-muted-foreground">
            When you place an order with this store, you can track it here until
            it is delivered, cancelled or returned.
          </p>
          <Button asChild className="mt-6 min-h-11">
            <Link href={storeHref}>Browse this store</Link>
          </Button>
        </div>
      ) : data ? (
        <div className="mt-8">
          <p className="mb-4 text-sm text-muted-foreground">
            Choose an order to view its progress.
          </p>
          <ul className="divide-y divide-border border-y border-border">
            {data.orders.map((order) => (
              <li key={order.orderNumber}>
                <Link
                  href={storeTrackingOrderHref(trackingHref, order.orderNumber)}
                  className="flex items-center justify-between gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-4 hover:text-primary"
                >
                  <span className="min-w-0">
                    <span className="block break-words font-semibold">
                      Order {order.orderNumber}
                    </span>
                    <span className="mt-2 block text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "Asia/Dhaka",
                      })}{" "}
                      · ৳{Number(order.total).toLocaleString("en-BD")}
                    </span>
                    <span className="mt-2 block text-sm capitalize">
                      {order.status.replaceAll("_", " ")}
                    </span>
                  </span>
                  <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          {data.total > data.pageSize && (
            <nav
              aria-label="Order pages"
              className="mt-6 flex items-center justify-between gap-3"
            >
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {page} of {Math.ceil(data.total / data.pageSize)}
              </span>
              <Button
                variant="outline"
                disabled={page * data.pageSize >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </div>
      ) : null}
    </section>
  );
}
