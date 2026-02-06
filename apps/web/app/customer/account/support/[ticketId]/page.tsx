import { AlertCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { getTicketDetails } from "@/actions/support/support-actions";
import { TicketDetails } from "@/components/support";

interface TicketDetailPageProps {
  params: Promise<{ ticketId: string }>;
}

export default async function TicketDetailPage({
  params,
}: TicketDetailPageProps) {
  const { ticketId } = await params;
  const ticketIdNum = parseInt(ticketId, 10);

  if (Number.isNaN(ticketIdNum)) {
    notFound();
  }

  const result = await getTicketDetails(ticketIdNum);

  if (!result.success || !result.data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <h3 className="font-semibold text-gray-900">Ticket Not Found</h3>
        <p className="text-sm text-gray-500 mt-1">
          {result.error || "Unable to load ticket details"}
        </p>
      </div>
    );
  }

  return <TicketDetails ticket={result.data} />;
}
