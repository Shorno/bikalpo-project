"use client";

import { useCustomerItemRequests } from "@/hooks/use-customer-api";
import { RequestItemsList } from "@/components/features/item-request/request-items-list";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountRequestsPage() {
  const { data, isLoading, refetch } = useCustomerItemRequests();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <RequestItemsList
        requests={(data?.requests as any) || []}
        onRefresh={refetch}
      />
    </div>
  );
}
