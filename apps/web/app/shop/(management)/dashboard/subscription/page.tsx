"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Package,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionWall } from "@/components/features/subscription/subscription-wall";
import { orpc } from "@/utils/orpc";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    trial: "bg-emerald-100 text-emerald-700 border-emerald-200",
    active: "bg-blue-100 text-blue-700 border-blue-200",
    expired: "bg-red-100 text-red-700 border-red-200",
    pending_approval: "bg-amber-100 text-amber-700 border-amber-200",
    pending_payment: "bg-gray-100 text-gray-700 border-gray-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  };

  const labels: Record<string, string> = {
    trial: "Free Trial",
    active: "Active",
    expired: "Expired",
    pending_approval: "Pending Approval",
    pending_payment: "Pending Payment",
    cancelled: "Cancelled",
  };

  return (
    <Badge className={styles[status] || "bg-gray-100"}>
      {labels[status] || status}
    </Badge>
  );
}

export default function SubscriptionPage() {
  const { data, isLoading } = useQuery({
    ...orpc.subscription.getMySubscription.queryOptions(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No subscription or expired — show the subscription wall
  if (
    !data ||
    data.status === "none" ||
    data.status === "expired"
  ) {
    return <SubscriptionWall />;
  }

  const sub = data.subscription;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          Subscription
        </h1>
        <p className="text-muted-foreground">
          Manage your subscription plan and billing.
        </p>
      </div>

      {/* Current Status */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <StatusBadge status={data.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {data.status === "trial" ? "Trial" : "Plan"}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {data.status === "trial"
                ? "Free Trial"
                : sub?.plan
                  ? sub.plan.name
                  : "No Plan"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Days Remaining
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                data.daysRemaining <= 3
                  ? "text-red-600"
                  : data.daysRemaining <= 7
                    ? "text-amber-600"
                    : "text-emerald-600"
              }`}
            >
              {data.daysRemaining}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Details */}
      {sub && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {sub.billingCycle && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Billing Cycle
                    </p>
                    <p className="font-medium capitalize">
                      {sub.billingCycle}
                    </p>
                  </div>
                </div>
              )}

              {sub.trialEnd && data.status === "trial" && (
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Trial Ends
                    </p>
                    <p className="font-medium">
                      {new Date(sub.trialEnd).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              )}

              {sub.currentPeriodEnd && data.status === "active" && (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Renews On
                    </p>
                    <p className="font-medium">
                      {new Date(
                        sub.currentPeriodEnd,
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show plans for active/trial users to renew or upgrade */}
      {(data.status === "trial" || data.status === "active" || data.status === "pending_approval") && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {data.status === "trial"
              ? "Upgrade Now"
              : data.status === "active"
                ? "Renew Subscription"
                : "Payment Under Review"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {data.status === "trial"
              ? "Choose a plan to secure uninterrupted access when your trial ends."
              : data.status === "active"
                ? "Renew your current plan or switch to a different package."
                : "Your payment is being reviewed by the admin. You'll be notified once approved."}
          </p>
          {data.status !== "pending_approval" && <SubscriptionWall mode="renew" />}
        </div>
      )}
    </div>
  );
}
