"use client";

import { HelpCircle } from "lucide-react";
import { useCustomerTickets } from "@/hooks/use-customer-api";
import { SupportPageClient } from "./support-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function SupportPage() {
  const { data, isLoading, error } = useCustomerTickets();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-12 w-72 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <HelpCircle className="h-10 w-10 text-gray-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900">Failed to load</h3>
        <p className="text-sm text-gray-500 mt-1">
          Unable to load support page
        </p>
      </div>
    );
  }

  return <SupportPageClient tickets={(data?.tickets as any) || []} />;
}
