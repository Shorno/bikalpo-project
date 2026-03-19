"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Clock, Crown, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

export function TrialBanner() {
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery({
    ...orpc.subscription.getMySubscription.queryOptions(),
  });

  if (!data || dismissed) return null;

  const { status, daysRemaining, isActive, subscription } = data;

  // No subscription exists
  if (status === "none") return null;

  // ── Active paid subscription — show package info ──
  if (status === "active" && isActive) {
    const planName = subscription?.plan?.name || "Active Plan";
    const expiryDate = subscription?.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
    const isUrgent = daysRemaining <= 7;

    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
          isUrgent
            ? "border-amber-200 bg-amber-50"
            : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <div className="flex items-center gap-2">
          {isUrgent ? (
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          ) : (
            <Crown className="h-4 w-4 text-emerald-600 shrink-0" />
          )}
          <p
            className={`text-sm font-medium ${
              isUrgent ? "text-amber-800" : "text-emerald-800"
            }`}
          >
            <span className="font-semibold">{planName}</span>
            {" · "}
            {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining
            {expiryDate && (
              <span className="text-xs opacity-75"> · Expires {expiryDate}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isUrgent && (
            <Link
              href="/dashboard/subscription"
              className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              Renew Now
            </Link>
          )}
          <button
            onClick={() => setDismissed(true)}
            className={`${isUrgent ? "text-amber-500 hover:text-amber-700" : "text-emerald-500 hover:text-emerald-700"}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Pending approval ──
  if (status === "pending_approval") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-sm font-medium text-blue-800">
            Your payment is under review. You&apos;ll be notified once approved.
          </p>
        </div>
      </div>
    );
  }

  // ── Expired ──
  if (status === "expired" || (status === "trial" && !isActive)) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-sm font-medium text-red-800">
            Your {status === "trial" ? "trial" : "subscription"} has expired.
            Subscribe to continue using your shop.
          </p>
        </div>
        <Link
          href="/dashboard/subscription"
          className="shrink-0 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
        >
          Subscribe Now
        </Link>
      </div>
    );
  }

  // ── Trial active ──
  if (status === "trial" && isActive) {
    const isUrgent = daysRemaining <= 3;

    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
          isUrgent
            ? "border-amber-200 bg-amber-50"
            : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <div className="flex items-center gap-2">
          {isUrgent ? (
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          ) : (
            <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
          )}
          <p
            className={`text-sm font-medium ${
              isUrgent ? "text-amber-800" : "text-emerald-800"
            }`}
          >
            {isUrgent
              ? `⚠️ Trial expires in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}!`
              : `🎉 Free trial: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/subscription"
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors ${
              isUrgent
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            Choose a Plan
          </Link>
          {!isUrgent && (
            <button
              onClick={() => setDismissed(true)}
              className="text-emerald-500 hover:text-emerald-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
