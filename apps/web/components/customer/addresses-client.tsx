/**
 * Client component for customer addresses using Customer API
 */
"use client";

import { useMyAddresses } from "@/hooks/use-customer-api";
import { AddressList } from "@/components/account/address-list";
import { Skeleton } from "@/components/ui/skeleton";

export function AddressesClient() {
  const { data, isLoading, isError } = useMyAddresses();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load addresses</p>
      </div>
    );
  }

  const addresses = data?.addresses || [];

  return <AddressList addresses={addresses} />;
}
