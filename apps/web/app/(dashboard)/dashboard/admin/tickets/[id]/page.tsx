import { AlertCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { getAdminTicketDetails } from "@/actions/support/admin-ticket-actions";
import { AdminTicketDetails } from "./ticket-details-client";

interface AdminTicketDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminTicketDetailPage({
  params,
}: AdminTicketDetailPageProps) {
  const { id } = await params;
  const ticketId = parseInt(id, 10);

  if (Number.isNaN(ticketId)) {
    notFound();
  }

  const result = await getAdminTicketDetails(ticketId);

  if (!result.success || !result.data) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">Ticket Not Found</h3>
          <p className="text-sm text-gray-500 mt-1">
            {result.error || "Unable to load ticket details"}
          </p>
        </div>
      </div>
    );
  }

  return <AdminTicketDetails ticket={result.data} />;
}
