"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { SubscriptionWall } from "@/components/features/subscription/subscription-wall";
import { orpc } from "@/utils/orpc";

/**
 * Wraps shop dashboard content and blocks access when subscription is expired.
 * Only the /subscription page is allowed through so users can purchase a plan.
 */
export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSubscriptionPage = pathname?.includes("/subscription");

  const { data, isLoading } = useQuery({
    ...orpc.subscription.getMySubscription.queryOptions(),
  });

  // Allow the subscription page through always so users can buy a plan
  if (isSubscriptionPage) {
    return <>{children}</>;
  }

  // While loading, don't block — show a subtle spinner
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[30vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Block if expired or no subscription
  if (data && (data.status === "expired" || data.status === "none")) {
    return <SubscriptionWall />;
  }

  return <>{children}</>;
}
