"use client";

import { formatDistanceToNow } from "date-fns";
import { Clock, MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SupportTicket } from "@/db/schema/support";
import { cn } from "@/lib/utils";
import { TicketForm } from "./ticket-form";

interface TicketListProps {
  tickets: SupportTicket[];
}

function getStatusColor(status: string) {
  switch (status) {
    case "open":
      return { color: "text-blue-700", bg: "bg-blue-50" };
    case "in_progress":
      return { color: "text-yellow-700", bg: "bg-yellow-50" };
    case "resolved":
      return { color: "text-green-700", bg: "bg-green-50" };
    case "closed":
      return { color: "text-gray-700", bg: "bg-gray-100" };
    default:
      return { color: "text-gray-700", bg: "bg-gray-50" };
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high":
      return { color: "text-red-700", bg: "bg-red-50" };
    case "medium":
      return { color: "text-yellow-700", bg: "bg-yellow-50" };
    case "low":
      return { color: "text-gray-600", bg: "bg-gray-50" };
    default:
      return { color: "text-gray-600", bg: "bg-gray-50" };
  }
}

export function TicketList({ tickets }: TicketListProps) {
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <TicketForm
        onSuccess={() => setShowForm(false)}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">My Tickets</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Ticket
        </Button>
      </div>

      {/* Empty State */}
      {tickets.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <MessageSquare className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">No tickets yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Have a question or issue? Create a support ticket.
          </p>
          <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
            Create Your First Ticket
          </Button>
        </div>
      ) : (
        /* Ticket List */
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {tickets.map((ticket) => {
            const statusStyle = getStatusColor(ticket.status);
            const priorityStyle = getPriorityColor(ticket.priority);
            return (
              <Link
                key={ticket.id}
                href={`/customer/account/support/${ticket.id}`}
                className="flex items-center justify-between p-4 hover:bg-emerald-50/50 transition-colors bg-white"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-500">
                      {ticket.ticketNumber}
                    </span>
                    <Badge
                      className={cn(
                        statusStyle.bg,
                        statusStyle.color,
                        "border-0 text-xs capitalize",
                      )}
                    >
                      {ticket.status.replace("_", " ")}
                    </Badge>
                    <Badge
                      className={cn(
                        priorityStyle.bg,
                        priorityStyle.color,
                        "border-0 text-xs capitalize",
                      )}
                    >
                      {ticket.priority}
                    </Badge>
                  </div>
                  <p className="font-medium text-gray-900 truncate">
                    {ticket.subject}
                  </p>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {ticket.message}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="flex items-center gap-1 text-gray-400 text-sm">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDistanceToNow(new Date(ticket.createdAt), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
