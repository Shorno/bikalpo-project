"use client";

import { RequestItemsList } from "@/components/features/item-request/request-items-list";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerItemRequests } from "@/hooks/use-customer-api";

export default function AccountRequestsPage() {
  const { data, isLoading, refetch } = useCustomerItemRequests();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
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
