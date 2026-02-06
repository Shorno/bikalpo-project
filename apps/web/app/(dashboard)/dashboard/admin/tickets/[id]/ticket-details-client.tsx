"use client";

import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Building2,
  Loader2,
  Mail,
  Phone,
  Send,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  addStaffReply,
  updateTicketStatus,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TicketStatus } from "@/db/schema/support";
import { cn } from "@/lib/utils";

interface AdminTicketDetailsProps {
  ticket: {
    id: number;
    ticketNumber: string;
    subject: string;
    message: string;
    status: string;
    priority: string;
    createdAt: Date;
    updatedAt: Date;
    customer: {
      id: string;
      name: string;
      email: string;
      shopName: string | null;
      phoneNumber: string | null;
    } | null;
    replies: {
      id: number;
      message: string;
      isStaffReply: boolean;
      createdAt: Date;
      user: { id: string; name: string; image: string | null };
    }[];
  };
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

export function AdminTicketDetails({ ticket }: AdminTicketDetailsProps) {
  const [replyMessage, setReplyMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const statusStyle = getStatusColor(ticket.status);

  async function handleSendReply() {
    if (!replyMessage.trim() || replyMessage.length < 5) {
      toast.error("Reply must be at least 5 characters");
      return;
    }

    setIsLoading(true);
    try {
      const result = await addStaffReply(ticket.id, replyMessage);
      if (result.success) {
        toast.success("Reply sent successfully!");
        setReplyMessage("");
      } else {
        toast.error(result.error || "Failed to send reply");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setIsUpdatingStatus(true);
    try {
      const result = await updateTicketStatus(
        ticket.id,
        newStatus as TicketStatus,
      );
      if (result.success) {
        toast.success("Status updated!");
      } else {
        toast.error(result.error || "Failed to update status");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const canReply = ticket.status !== "closed";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/dashboard/admin/tickets">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tickets
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-500">{ticket.ticketNumber}</span>
            <Badge
              className={cn(
                statusStyle.bg,
                statusStyle.color,
                "border-0 text-xs capitalize",
              )}
            >
              {ticket.status.replace("_", " ")}
            </Badge>
          </div>
        </div>

        {/* Status Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <Select
            value={ticket.status}
            onValueChange={handleStatusChange}
            disabled={isUpdatingStatus}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Original Message */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-500" />
                </div>
                <div>
                  <span className="font-medium text-sm">
                    {ticket.customer?.name || "Customer"}
                  </span>
                  <span className="text-gray-400 text-sm ml-2">
                    {formatDistanceToNow(new Date(ticket.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 whitespace-pre-wrap">
                {ticket.message}
              </p>
            </CardContent>
          </Card>

          {/* Replies */}
          {ticket.replies.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Conversation</h4>
              {ticket.replies.map((reply) => (
                <Card
                  key={reply.id}
                  className={cn(
                    reply.isStaffReply && "border-emerald-200 bg-emerald-50/50",
                  )}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          reply.isStaffReply ? "bg-emerald-100" : "bg-gray-100",
                        )}
                      >
                        <User
                          className={cn(
                            "h-4 w-4",
                            reply.isStaffReply
                              ? "text-emerald-600"
                              : "text-gray-500",
                          )}
                        />
                      </div>
                      <div>
                        <span className="font-medium text-sm">
                          {reply.isStaffReply
                            ? "Support Team"
                            : reply.user.name}
                        </span>
                        <span className="text-gray-400 text-sm ml-2">
                          {formatDistanceToNow(new Date(reply.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {reply.message}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Reply Form */}
          {canReply ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Send Reply</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply to the customer..."
                  className="min-h-[100px] resize-none"
                />
                <div className="flex justify-end">
                  <Button onClick={handleSendReply} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send Reply
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gray-50">
              <CardContent className="py-4 text-center text-gray-500">
                This ticket is closed and cannot receive new replies.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Customer Info */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Information</CardTitle>
              <CardDescription>Contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {ticket.customer?.name || "N/A"}
                  </p>
                  <p className="text-sm text-gray-500">Customer</p>
                </div>
              </div>

              {ticket.customer?.shopName && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium">{ticket.customer.shopName}</p>
                    <p className="text-sm text-gray-500">Shop Name</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {ticket.customer?.email || "N/A"}
                  </p>
                  <p className="text-sm text-gray-500">Email</p>
                </div>
              </div>

              {ticket.customer?.phoneNumber && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium">{ticket.customer.phoneNumber}</p>
                    <p className="text-sm text-gray-500">Phone</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
