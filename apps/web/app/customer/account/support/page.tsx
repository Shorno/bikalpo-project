import { HelpCircle } from "lucide-react";
import { getCustomerTickets } from "@/actions/support/support-actions";
import { SupportPageClient } from "./support-client";

export default async function SupportPage() {
  const ticketsResult = await getCustomerTickets();

  if (!ticketsResult.success) {
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

  return <SupportPageClient tickets={ticketsResult.data?.tickets || []} />;
}
