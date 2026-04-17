"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
    ArrowLeft,
    ArrowUpRight,
    Check,
    CheckCircle,
    FileText,
    ImageIcon,
    Loader2,
    Lock,
    MessageSquare,
    Paperclip,
    Send,
    ShieldAlert,
    Timer,
    User,
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusStyle(status: string) {
    switch (status) {
        case "open":
            return { color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500", label: "Open" };
        case "in_progress":
            return { color: "text-blue-700", bg: "bg-blue-50", dot: "bg-blue-500", label: "In Progress" };
        case "resolved":
            return { color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500", label: "Resolved" };
        case "closed":
            return { color: "text-gray-600", bg: "bg-gray-100", dot: "bg-gray-400", label: "Closed" };
        default:
            return { color: "text-gray-600", bg: "bg-gray-50", dot: "bg-gray-400", label: status };
    }
}

function getPriorityStyle(priority: string) {
    switch (priority) {
        case "high":
            return { color: "text-red-700", bg: "bg-red-50" };
        case "medium":
            return { color: "text-orange-700", bg: "bg-orange-50" };
        case "low":
            return { color: "text-gray-600", bg: "bg-gray-50" };
        default:
            return { color: "text-gray-600", bg: "bg-gray-50" };
    }
}

function getCategoryLabel(cat: string) {
    switch (cat) {
        case "order": return "Order";
        case "payment": return "Payment";
        case "delivery": return "Delivery";
        case "account": return "Account";
        default: return "Other";
    }
}

function getDeadlineStatus(deadline: string | Date | null): {
    label: string;
    color: string;
    isOverdue: boolean;
} {
    if (!deadline) return { label: "No deadline", color: "text-slate-400", isOverdue: false };
    const now = new Date();
    const dl = new Date(deadline);
    const diff = dl.getTime() - now.getTime();

    if (diff <= 0) {
        return { label: "Overdue", color: "text-red-600 font-semibold", isOverdue: true };
    }
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours < 6) {
        return { label: `${hours}h ${minutes}m left`, color: "text-orange-600 font-medium", isOverdue: false };
    }
    return { label: `${hours}h left`, color: "text-slate-500", isOverdue: false };
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ManagementTicketDetailProps {
    ticketId: number;
    /** Base path for the "Back" link, e.g. "/warehouse/dashboard/support" */
    backHref: string;
    /** "owner" = I created this ticket (my-tickets), "handler" = assigned to me (incoming) */
    perspective: "owner" | "handler";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ManagementTicketDetail({ ticketId, backHref, perspective }: ManagementTicketDetailProps) {
    const [replyMsg, setReplyMsg] = useState("");
    const queryClient = useQueryClient();
    const router = useRouter();

    // ── Fetch ticket detail ──
    const { data: ticket, isLoading, error } = useQuery(
        orpc.userTicket.getById.queryOptions({
            input: { id: ticketId },
        }),
    );

    // ── Reply mutation ──
    const replyMutation = useMutation({
        mutationFn: (input: { ticketId: number; message: string }) =>
            client.userTicket.reply(input),
        onSuccess: () => {
            toast.success("Reply sent");
            setReplyMsg("");
            queryClient.invalidateQueries({ queryKey: orpc.userTicket.key() });
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to send reply");
        },
    });

    // ── Resolve mutation (handler only) ──
    const resolveMutation = useMutation({
        mutationFn: (input: { ticketId: number }) =>
            client.userTicket.resolve(input),
        onSuccess: () => {
            toast.success("Ticket resolved");
            queryClient.invalidateQueries({ queryKey: orpc.userTicket.key() });
        },
        onError: () => toast.error("Failed to resolve ticket"),
    });

    // ── Escalate mutation (handler only) ──
    const escalateMutation = useMutation({
        mutationFn: (input: { ticketId: number }) =>
            client.userTicket.escalateToAdmin(input),
        onSuccess: () => {
            toast.success("Ticket escalated to admin");
            queryClient.invalidateQueries({ queryKey: orpc.userTicket.key() });
            router.push(backHref);
        },
        onError: () => toast.error("Failed to escalate ticket"),
    });

    const handleReply = () => {
        if (!replyMsg.trim() || replyMsg.length < 5) {
            toast.error("Reply must be at least 5 characters");
            return;
        }
        replyMutation.mutate({ ticketId, message: replyMsg });
    };

    // ── Loading state ──
    if (isLoading) {
        return (
            <div className="space-y-5">
                <Button variant="ghost" size="sm" onClick={() => router.push(backHref)} className="-ml-2 text-xs">
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    Back to Tickets
                </Button>
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-48 w-full rounded-lg" />
            </div>
        );
    }

    // ── Error / not found ──
    if (error || !ticket) {
        return (
            <div className="space-y-5">
                <Button variant="ghost" size="sm" onClick={() => router.push(backHref)} className="-ml-2 text-xs">
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    Back to Tickets
                </Button>
                <div className="flex flex-col items-center justify-center py-16 border rounded-lg bg-muted/30">
                    <ShieldAlert className="w-10 h-10 text-destructive/40 mb-3" />
                    <p className="text-sm font-medium">Ticket not found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {(error as any)?.message || "Unable to load ticket details"}
                    </p>
                </div>
            </div>
        );
    }

    const status = getStatusStyle(ticket.status);
    const priority = getPriorityStyle(ticket.priority);
    const dl = getDeadlineStatus(ticket.escalationDeadline);
    const canReply = ticket.status !== "closed";
    const isActive = ticket.status === "open" || ticket.status === "in_progress";
    const actionLoading = resolveMutation.isPending || escalateMutation.isPending;

    const STATUS_STEPS = ["open", "in_progress", "resolved", "closed"] as const;
    const STATUS_LABELS: Record<string, string> = {
        open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed",
    };
    const currentStepIndex = STATUS_STEPS.indexOf(ticket.status as typeof STATUS_STEPS[number]);

    return (
        <div className="space-y-5">
            {/* Back button */}
            <Button variant="ghost" size="sm" onClick={() => router.push(backHref)} className="-ml-2 text-xs">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back to Tickets
            </Button>

            {/* Ticket Header with Stepper */}
            <Card className="border-0 shadow-sm overflow-hidden py-0">
                <div className="bg-gradient-to-r from-slate-800 to-slate-600 p-6 text-white">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold opacity-80">
                                    {ticket.ticketNumber}
                                </span>
                                <Badge className="border-0 text-[10px] font-semibold bg-white/15 text-white/90">
                                    {getCategoryLabel(ticket.category)}
                                </Badge>
                            </div>
                            <h2 className="text-lg font-bold">{ticket.subject}</h2>
                            <p className="text-xs text-white/60">
                                Created {format(new Date(ticket.createdAt), "dd MMM yyyy, hh:mm a")}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge className={cn(priority.bg, priority.color, "border-0 text-[10px] font-semibold capitalize")}>
                                {ticket.priority}
                            </Badge>
                            <Badge className={cn(status.bg, status.color, "border-0 text-[10px] font-semibold")}>
                                {status.label}
                            </Badge>
                        </div>
                    </div>

                    {/* Stepper */}
                    <div className="mt-6 flex items-center gap-0">
                        {STATUS_STEPS.map((step, idx) => {
                            const isStepActive = idx <= currentStepIndex;
                            const isCurrent = idx === currentStepIndex;
                            return (
                                <div key={step} className="flex items-center flex-1 last:flex-none">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={cn(
                                                "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all",
                                                isCurrent
                                                    ? "bg-white text-slate-900 ring-2 ring-white/30 ring-offset-2 ring-offset-slate-700"
                                                    : isStepActive
                                                        ? "bg-white/70 text-slate-900"
                                                        : "bg-white/15 text-white/40",
                                            )}
                                        >
                                            {isStepActive && idx < currentStepIndex ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                                        </div>
                                        <span className={cn("text-[10px] mt-1.5 font-medium", isCurrent ? "text-white" : isStepActive ? "text-white/60" : "text-white/25")}>
                                            {STATUS_LABELS[step]}
                                        </span>
                                    </div>
                                    {idx < STATUS_STEPS.length - 1 && (
                                        <div className={cn("flex-1 h-0.5 mx-2 rounded-full mt-[-14px]", idx < currentStepIndex ? "bg-white/50" : "bg-white/10")} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>

            {/* Info Cards — content depends on perspective */}
            {perspective === "handler" ? (
                /* Handler sees: customer info + escalation deadline + actions */
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className={cn("text-xs", priority.bg, priority.color)}>
                                        {ticket.priority}
                                    </Badge>
                                    {dl.isOverdue && (
                                        <Badge variant="destructive" className="text-xs">
                                            <ShieldAlert className="h-3 w-3 mr-1" />
                                            Overdue
                                        </Badge>
                                    )}
                                </div>
                                <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                            </div>
                            {isActive && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => escalateMutation.mutate({ ticketId })}
                                        disabled={actionLoading}
                                        className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                    >
                                        <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                                        Escalate to Admin
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => resolveMutation.mutate({ ticketId })}
                                        disabled={actionLoading}
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                        Resolve
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground text-xs">From</span>
                                <p className="font-medium">
                                    {ticket.customer?.name || "Unknown"}
                                    {ticket.customer?.shopName && (
                                        <span className="text-muted-foreground font-normal ml-1">
                                            ({ticket.customer.shopName})
                                        </span>
                                    )}
                                </p>
                                {ticket.customer?.phoneNumber && (
                                    <p className="text-xs text-muted-foreground">{ticket.customer.phoneNumber}</p>
                                )}
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Category</span>
                                <p className="font-medium capitalize">{ticket.category}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Created</span>
                                <p className="font-medium">
                                    {format(new Date(ticket.createdAt), "MMM dd, yyyy HH:mm")}
                                </p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Escalation Deadline</span>
                                <p className={cn("font-medium", dl.color)}>
                                    {ticket.escalationDeadline
                                        ? format(new Date(ticket.escalationDeadline), "MMM dd, yyyy HH:mm")
                                        : "None"}
                                </p>
                                {ticket.escalationDeadline && (
                                    <p className={cn("text-xs flex items-center gap-1", dl.color)}>
                                        <Timer className="h-3 w-3" />
                                        {dl.label}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                /* Owner sees: assigned handler + escalation status */
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-xs text-muted-foreground font-medium">Assigned To</span>
                                <p className="font-medium mt-0.5">
                                    {ticket.assignedHandler
                                        ? ticket.assignedHandler.shopName || ticket.assignedHandler.warehouseName || ticket.assignedHandler.name
                                        : ticket.currentLevel === "level_2"
                                            ? "Admin Team"
                                            : "Pending"}
                                </p>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground font-medium">Escalation Status</span>
                                <div className="mt-0.5">
                                    {ticket.currentLevel === "level_2" ? (
                                        <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px] font-semibold">
                                            <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                                            Escalated to Admin
                                            {ticket.autoEscalated && " (Auto)"}
                                        </Badge>
                                    ) : (
                                        <Badge className="bg-blue-50 text-blue-700 border-0 text-[10px] font-semibold">
                                            Level 1 — Being Handled
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            {ticket.escalatedAt && (
                                <div>
                                    <span className="text-xs text-muted-foreground font-medium">Escalated At</span>
                                    <p className="font-medium mt-0.5">
                                        {format(new Date(ticket.escalatedAt), "dd MMM yyyy, hh:mm a")}
                                    </p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Original Message */}
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                        <span className="font-semibold text-sm">
                            {perspective === "owner" ? "You" : ticket.customer?.name || "Customer"}
                        </span>
                        <span className="text-gray-400 text-xs">
                            {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                        </span>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                        {ticket.message}
                    </p>
                </CardContent>
            </Card>

            {/* Attachments */}
            {ticket.attachments && ticket.attachments.length > 0 && (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-gray-400" />
                            Attachments ({ticket.attachments.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {ticket.attachments.map((att: any) => {
                                const isImage = att.fileName?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
                                return (
                                    <a
                                        key={att.id}
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 p-2 rounded-md border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-sm"
                                    >
                                        {isImage ? (
                                            <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
                                        ) : (
                                            <FileText className="h-4 w-4 text-orange-500 shrink-0" />
                                        )}
                                        <span className="truncate text-xs">{att.fileName}</span>
                                    </a>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Replies Thread */}
            {ticket.replies.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-gray-400" />
                        Replies ({ticket.replies.length})
                    </h3>
                    {ticket.replies.map((reply: any) => (
                        <Card
                            key={reply.id}
                            className={cn(
                                "shadow-none",
                                reply.isStaffReply ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200",
                            )}
                        >
                            <CardContent className="pt-4 pb-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className={cn("h-7 w-7 rounded-full flex items-center justify-center", reply.isStaffReply ? "bg-emerald-100" : "bg-gray-100")}>
                                        <User className={cn("h-3.5 w-3.5", reply.isStaffReply ? "text-emerald-600" : "text-gray-500")} />
                                    </div>
                                    <span className="font-semibold text-xs">
                                        {reply.user?.name || (reply.isStaffReply ? "Support Team" : "Customer")}
                                    </span>
                                    {reply.isStaffReply && (
                                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] px-1.5 py-0">Staff</Badge>
                                    )}
                                    <span className="text-gray-400 text-[11px]">
                                        {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap ml-9">
                                    {reply.message}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Reply Form */}
            {canReply ? (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Send className="h-4 w-4 text-gray-400" />
                            Write a Reply
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Textarea
                            value={replyMsg}
                            onChange={(e) => setReplyMsg(e.target.value)}
                            placeholder="Type your reply..."
                            className="min-h-[100px] resize-none text-sm"
                        />
                        <div className="flex justify-end">
                            <Button onClick={handleReply} disabled={replyMutation.isPending || !replyMsg.trim()} size="sm">
                                {replyMutation.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
                                Send Reply
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-gray-50 border-0 shadow-none">
                    <CardContent className="py-6 text-center text-sm text-gray-500">
                        <Lock className="h-5 w-5 mx-auto mb-2 text-gray-400" />
                        This ticket is closed and cannot receive new replies.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
