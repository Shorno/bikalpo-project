"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Loader2, Send, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { addTicketReply } from "@/actions/support/support-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type AddReplyFormValues,
  addReplySchema,
} from "@/schema/support.schema";

interface TicketDetailsProps {
  ticket: {
    id: number;
    ticketNumber: string;
    subject: string;
    message: string;
    status: string;
    priority: string;
    createdAt: Date;
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

export function TicketDetails({ ticket }: TicketDetailsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const statusStyle = getStatusColor(ticket.status);

  const form = useForm<AddReplyFormValues>({
    resolver: zodResolver(addReplySchema),
    defaultValues: {
      ticketId: ticket.id,
      message: "",
    },
  });

  async function onSubmit(data: AddReplyFormValues) {
    setIsLoading(true);
    try {
      const result = await addTicketReply(data);
      if (result.success) {
        toast.success("Reply sent!");
        form.reset({ ticketId: ticket.id, message: "" });
      } else {
        toast.error(result.error || "Failed to send reply");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  const canReply = ticket.status !== "closed";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/customer/account/support">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tickets
            </Link>
          </Button>
          <h2 className="text-xl font-bold text-gray-900">{ticket.subject}</h2>
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
      </div>

      {/* Original Message */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="h-4 w-4 text-gray-500" />
          </div>
          <div>
            <span className="font-medium text-gray-900 text-sm">You</span>
            <span className="text-gray-400 text-sm ml-2">
              {formatDistanceToNow(new Date(ticket.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
        <p className="text-gray-700 whitespace-pre-wrap">{ticket.message}</p>
      </div>

      {/* Replies */}
      {ticket.replies.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Conversation</h4>
          {ticket.replies.map((reply) => (
            <div
              key={reply.id}
              className={cn(
                "rounded-lg border p-4",
                reply.isStaffReply
                  ? "bg-emerald-50 border-emerald-100"
                  : "bg-white border-gray-200",
              )}
            >
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
                      reply.isStaffReply ? "text-emerald-600" : "text-gray-500",
                    )}
                  />
                </div>
                <div>
                  <span className="font-medium text-gray-900 text-sm">
                    {reply.isStaffReply ? "Support Team" : reply.user.name}
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
            </div>
          ))}
        </div>
      )}

      {/* Reply Form */}
      {canReply ? (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Type your reply..."
                        className="min-h-[100px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send Reply
                </Button>
              </div>
            </form>
          </Form>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center text-gray-500">
          This ticket is closed and cannot receive new replies.
        </div>
      )}
    </div>
  );
}
