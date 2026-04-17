"use client";

import { useParams, useSearchParams } from "next/navigation";
import { ManagementTicketDetail } from "@/components/support/management-ticket-detail";

export default function WarehouseTicketDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const ticketId = params?.ticketId ? parseInt(params.ticketId as string, 10) : 0;
    const perspective = searchParams.get("from") === "incoming" ? "handler" : "owner";

    if (!ticketId || isNaN(ticketId)) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                Invalid ticket ID
            </div>
        );
    }

    return (
        <div className="p-6">
            <ManagementTicketDetail
                ticketId={ticketId}
                backHref="/warehouse/dashboard/support"
                perspective={perspective as "owner" | "handler"}
            />
        </div>
    );
}
