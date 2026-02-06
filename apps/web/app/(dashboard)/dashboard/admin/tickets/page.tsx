import { format } from "date-fns";
import {
  CheckCircle,
  Clock,
  Loader2,
  MessageSquare,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import {
  getAllTickets,
  getTicketStats,
} from "@/actions/support/admin-ticket-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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

export default async function AdminTicketsPage() {
  const [ticketsResult, statsResult] = await Promise.all([
    getAllTickets({ page: 1, limit: 50 }),
    getTicketStats(),
  ]);

  const tickets = ticketsResult.data?.tickets || [];
  const stats = statsResult.data;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-muted-foreground">
            Manage customer support tickets and respond to inquiries.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Clock className="text-blue-500 size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.open || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Loader2 className="text-yellow-500 size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats?.inProgress || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="text-green-500 size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.resolved || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
          <CardDescription>
            View and respond to customer support tickets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    No support tickets found.
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => {
                  const statusStyle = getStatusColor(ticket.status);
                  const priorityStyle = getPriorityColor(ticket.priority);
                  return (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">
                        {ticket.ticketNumber}
                      </TableCell>
                      <TableCell>
                        {format(new Date(ticket.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {ticket.customer?.name || "Unknown"}
                          </span>
                          {ticket.customer?.shopName && (
                            <span className="text-xs text-muted-foreground">
                              {ticket.customer.shopName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate"
                        title={ticket.subject}
                      >
                        {ticket.subject}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            priorityStyle.bg,
                            priorityStyle.color,
                            "border-0 text-xs capitalize",
                          )}
                        >
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            statusStyle.bg,
                            statusStyle.color,
                            "border-0 text-xs capitalize",
                          )}
                        >
                          {ticket.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/admin/tickets/${ticket.id}`}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
