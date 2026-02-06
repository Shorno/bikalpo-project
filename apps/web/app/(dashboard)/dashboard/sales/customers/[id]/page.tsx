"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, User } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getCustomerDetails } from "@/actions/employee/get-assigned-customers";
import { CustomerDetailsCard } from "@/components/features/customers/customer-details-card";
import { CustomerHistoryTabs } from "@/components/features/customers/customer-history-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SALES_BASE } from "@/lib/routes";

function CustomerDetailsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      {/* Tabs skeleton */}
      <Skeleton className="h-10 w-48" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    </div>
  );
}

export default function CustomerDetailsPage() {
  const params = useParams();
  const customerId = params.id as string;

  const { data: result, isLoading } = useQuery({
    queryKey: ["customer-details", customerId],
    queryFn: () => getCustomerDetails(customerId),
    enabled: !!customerId,
  });

  const customer = result?.success ? result.customer : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
          <Link href={`${SALES_BASE}/customers`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold">Customer Details</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            View customer information and history
          </p>
        </div>
      </div>

      {isLoading ? (
        <CustomerDetailsSkeleton />
      ) : !customer ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
          <User className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-base font-semibold">Customer not found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This customer may have been removed or doesn't exist.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link href={`${SALES_BASE}/customers`}>Back to Customers</Link>
          </Button>
        </div>
      ) : (
        <>
          <CustomerDetailsCard customer={customer} />
          <CustomerHistoryTabs
            estimates={customer.estimates}
            orders={customer.orders}
          />
        </>
      )}
    </div>
  );
}
