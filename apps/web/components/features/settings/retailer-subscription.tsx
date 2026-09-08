"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { type client, orpc } from "@/utils/orpc";

type CurrentSubscription = NonNullable<
  Awaited<ReturnType<typeof client.retailerSubscription.current>>["current"]
>;
type SubscriptionQuote = Awaited<
  ReturnType<typeof client.retailerSubscription.quote>
>;

export function subscriptionMoney(amountMinor: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}
export function subscriptionDate(
  value: Date | string | null | undefined,
  fallback = "Not available",
) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Dhaka",
      }).format(new Date(value))
    : fallback;
}
function subscriptionDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(new Date(value));
}
export function useRetailerSubscription() {
  const { data: session } = authClient.useSession();
  const enabled =
    session?.user.role === "shop_owner" &&
    session.user.businessType === "retail";
  const options = orpc.retailerSubscription.current.queryOptions();
  return {
    enabled,
    ...useQuery({
      ...options,
      queryKey: [...options.queryKey, session?.user.id ?? null],
      enabled,
      retry: false,
      refetchInterval: 60_000,
    }),
  };
}

export function SubscriptionDetails({
  current,
}: {
  current: CurrentSubscription | null | undefined;
}) {
  const fields = [
    ["Current Plan", current?.planName],
    ["Subscription Status", current?.status],
    ["Plan Start Date", subscriptionDate(current?.startsAt)],
    [
      "Expiry Date",
      current ? subscriptionDate(current.expiresAt, "No expiry") : null,
    ],
    ["Auto Renewal", current ? "Off" : null],
    [
      "Next Billing Date",
      current
        ? subscriptionDate(current.nextBillingAt, "Not scheduled")
        : null,
    ],
    ["Payment Status", current?.paymentStatus],
  ];
  return (
    <dl className="divide-y">
      {fields.map(([label, value]) => (
        <div key={label} className="grid grid-cols-2 gap-4 py-3 text-sm">
          <dt className="text-gray-500">{label}</dt>
          <dd className="break-words text-right font-medium text-gray-950">
            {value || "Not available"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SubscriptionDialog({
  variant = "outline",
}: {
  variant?: "outline" | "secondary";
}) {
  const queryClient = useQueryClient();
  const subscription = useRetailerSubscription();
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<SubscriptionQuote | null>(null);
  const [confirmationKey, setConfirmationKey] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const quoteMutation = useMutation({
    ...orpc.retailerSubscription.quote.mutationOptions(),
    onSuccess: (result) => {
      setQuote(result);
      setConfirmationKey(crypto.randomUUID());
      setAccepted(false);
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      void subscription.refetch();
    },
  });
  const confirmMutation = useMutation({
    ...orpc.retailerSubscription.confirm.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpc.retailerSubscription.current.key(),
      });
      toast.success("Subscription activated with dummy payment");
      setQuote(null);
      setError("");
    },
    onError: (err) => {
      setError(err.message);
      if ("code" in err && err.code === "CONFLICT") {
        void subscription.refetch();
      }
      // Keep the quote/key for safe retries after ambiguous network failures.
    },
  });
  const busy = quoteMutation.isPending || confirmMutation.isPending;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (next) void subscription.refetch();
        if (!next) {
          setQuote(null);
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          View Subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {quote ? "Confirm Dummy Payment" : "Your subscription"}
          </DialogTitle>
          <DialogDescription>
            {quote
              ? "This is a simulated payment. No money will be charged."
              : "Review your current plan or choose a longer term for a lower monthly cost."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {quote ? (
          <div className="space-y-5">
            <div className="rounded-xl border bg-gray-50 p-5">
              <p className="font-semibold">
                {quote.planName} · {quote.durationMonths} months
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {subscriptionMoney(quote.amountMinor)}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                One payment ·{" "}
                {subscriptionMoney(quote.amountMinor / quote.durationMonths)}{" "}
                per month
              </p>
              <dl className="mt-4 grid gap-2 text-sm">
                <div>
                  <dt className="inline text-gray-500">Starts: </dt>
                  <dd className="inline">Immediately after confirmation</dd>
                </div>
                <div>
                  <dt className="inline text-gray-500">Estimated expiry: </dt>
                  <dd className="inline">
                    {subscriptionDateTime(quote.previewExpiresAt)} (Bangladesh
                    time)
                  </dd>
                </div>
                <div>
                  <dt className="inline text-gray-500">Confirm before: </dt>
                  <dd className="inline">
                    {subscriptionDateTime(quote.quoteExpiresAt)}
                  </dd>
                </div>
              </dl>
            </div>
            {quote.replacesPaidTerm && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                Your current term ends {subscriptionDate(quote.previousExpiry)}.
                This upgrade replaces it immediately. Unused time is forfeited,
                with no refund, credit or carryover.
              </p>
            )}
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                disabled={busy}
                className="mt-1 size-4 accent-emerald-600"
              />
              <span>
                I confirm this dummy payment and the subscription terms above.
                Auto renewal is off.
              </span>
            </label>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setQuote(null);
                  setError("");
                }}
              >
                Back to plans
              </Button>
              <Button
                disabled={!accepted || busy}
                onClick={() =>
                  confirmMutation.mutate({
                    quoteId: quote.id,
                    idempotencyKey: confirmationKey,
                    acceptDummyPayment: true,
                  })
                }
              >
                {confirmMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Confirm Dummy Payment
              </Button>
            </DialogFooter>
          </div>
        ) : subscription.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : subscription.isError ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-red-700">
              {subscription.error.message}
            </p>
            <Button
              variant="outline"
              onClick={() => void subscription.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            <SubscriptionDetails current={subscription.data?.current} />
            {!subscription.data?.current && (
              <p className="text-sm text-gray-500">
                Your subscription is not initialized. Contact support to set up
                your Free plan.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {subscription.data?.plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col rounded-xl border p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{plan.name}</h3>
                    {plan.id === subscription.data?.current?.planId && (
                      <span className="text-xs font-medium text-emerald-700">
                        Current plan
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xl font-semibold tabular-nums">
                    {subscriptionMoney(plan.amountMinor)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {plan.durationMonths
                      ? `For ${plan.durationMonths} months · ${subscriptionMoney(plan.amountMinor / plan.durationMonths)}/month`
                      : "No expiry"}
                  </p>
                  <p className="my-3 text-sm text-gray-500">
                    {plan.description}
                  </p>
                  <Button
                    className="mt-auto"
                    variant="outline"
                    disabled={!plan.action || busy}
                    onClick={() => {
                      setError("");
                      quoteMutation.mutate({ planId: plan.id });
                    }}
                  >
                    {quoteMutation.isPending &&
                    quoteMutation.variables?.planId === plan.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {plan.action ||
                      (plan.id === subscription.data?.current?.planId
                        ? "Current plan"
                        : "Unavailable during current term")}
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Payments are simulated. Plans do not auto-renew. Active plans can
              be upgraded to a longer term; expired plans can be renewed.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RetailerSubscriptionSection() {
  const subscription = useRetailerSubscription();
  return (
    <section
      className="flex flex-col p-6 md:col-span-2 xl:col-span-1"
      aria-labelledby="user-plan-heading"
    >
      <h2
        id="user-plan-heading"
        className="flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-950 uppercase"
      >
        <CreditCard className="size-4 text-emerald-700" aria-hidden="true" />
        User Plan
      </h2>
      {subscription.enabled && subscription.isLoading ? (
        <Skeleton className="mt-5 h-64 w-full" />
      ) : (
        <SubscriptionDetails current={subscription.data?.current} />
      )}
      {subscription.isError && (
        <p role="alert" className="text-xs text-red-700">
          Could not load your subscription. Open View Subscription to retry.
        </p>
      )}
      <div className="mt-auto pt-5">
        {subscription.enabled && <SubscriptionDialog />}
      </div>
    </section>
  );
}

export function RetailerSubscriptionBanner() {
  const subscription = useRetailerSubscription();
  if (!subscription.enabled) return null;
  const current = subscription.data?.current;
  return (
    <section className="flex flex-col justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-5">
      <div>
        <p className="text-xs font-medium text-emerald-700">Subscription</p>
        <p className="mt-2 text-lg font-semibold">
          {current?.planName ||
            (subscription.isLoading ? "Loading…" : "Not available")}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {current
            ? `${current.status} · ${current.expiresAt ? `Expires ${subscriptionDate(current.expiresAt)}` : "No expiry"}`
            : "View your plan and available upgrades."}
        </p>
      </div>
      <div className="mt-4">
        <SubscriptionDialog />
      </div>
    </section>
  );
}
