"use client";

import { AlertCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useTicketDetails } from "@/hooks/use-customer-api";
import { TicketDetails } from "@/components/support";
import { Skeleton } from "@/components/ui/skeleton";

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params?.ticketId
    ? parseInt(params.ticketId as string, 10)
    : undefined;

  const { data, isLoading, error } = useTicketDetails(
    Number.isNaN(ticketId) ? undefined : ticketId,
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !data?.ticket) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900">Ticket Not Found</h3>
        <p className="text-sm text-gray-500 mt-1">
          {error?.message || "Unable to load ticket details"}
        </p>
      </div>
    );
  }

  return <TicketDetails ticket={data.ticket as any} />;
}
