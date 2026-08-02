"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveOrder } from "@/hooks/use-customer-api";

export function ActiveOrderRedirect() {
  const router = useRouter();
  const { data, isLoading } = useActiveOrder();

  useEffect(() => {
    if (isLoading) return;
    router.replace(
      data?.order?.orderNumber
        ? `/account/orders/${data.order.orderNumber}`
        : "/account/orders",
    );
  }, [data?.order?.orderNumber, isLoading, router]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 py-10" aria-live="polite">
      <p className="text-sm text-slate-500">Opening your active order…</p>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
