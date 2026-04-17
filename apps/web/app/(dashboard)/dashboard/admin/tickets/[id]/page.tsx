"use client";

import { useParams } from "next/navigation";
import { AdminTicketDetails } from "./ticket-details-client";

export default function AdminTicketDetailPage() {
    const params = useParams();
    const ticketId = params?.id ? parseInt(params.id as string, 10) : 0;

    if (!ticketId || isNaN(ticketId)) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                Invalid ticket ID
            </div>
        );
    }

    return <AdminTicketDetails ticketId={ticketId} />;
}
