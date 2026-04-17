"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
    AlertTriangle,
    ArrowLeft,
    ArrowUpRight,
    Building2,
    Check,
    ChevronRight,
    FileText,
    Loader2,
    Lock,
    Mail,
    MessageSquare,
    Phone,
    Send,
    ShieldAlert,
    StickyNote,
    User,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { client, orpc } from "@/utils/orpc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STEPS = ["open", "in_progress", "resolved", "closed"] as const;
const STATUS_LABELS: Record<string, string> = {
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
};

function getStatusColor(status: string) {
    switch (status) {
        case "open": return { color: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200" };
        case "in_progress": return { color: "text-blue-700", bg: "bg-blue-50", ring: "ring-blue-200" };
        case "resolved": return { color: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200" };
        case "closed": return { color: "text-gray-600", bg: "bg-gray-100", ring: "ring-gray-200" };
        default: return { color: "text-gray-600", bg: "bg-gray-50", ring: "ring-gray-200" };
    }
}

function getPriorityStyle(priority: string) {
    switch (priority) {
        case "critical": return { color: "text-red-800", bg: "bg-red-100", dot: "bg-red-600" };
        case "high": return { color: "text-red-700", bg: "bg-red-50", dot: "bg-red-500" };
        case "medium": return { color: "text-orange-700", bg: "bg-orange-50", dot: "bg-orange-500" };
        case "low": return { color: "text-gray-600", bg: "bg-gray-50", dot: "bg-gray-400" };
        default: return { color: "text-gray-600", bg: "bg-gray-50", dot: "bg-gray-400" };
    }
}

function getUserTypeLabel(type: string) {
    switch (type) {
        case "customer": return { label: "Customer", color: "text-violet-700", bg: "bg-violet-50" };
        case "retailer": return { label: "Retailer", color: "text-sky-700", bg: "bg-sky-50" };
        case "wholesaler": return { label: "Wholesaler", color: "text-teal-700", bg: "bg-teal-50" };
        default: return { label: type, color: "text-gray-600", bg: "bg-gray-50" };
    }
}

function getCategoryLabel(cat: string) {
    switch (cat) {
        case "order": return "Order Issue";
        case "payment": return "Payment Issue";
        case "delivery": return "Delivery Issue";
        case "account": return "Account Issue";
        default: return "Other";
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AdminTicketDetails({ ticketId }: { ticketId: number }) {
    const [replyMessage, setReplyMessage] = useState("");
    const [internalNote, setInternalNote] = useState("");
    const queryClient = useQueryClient();

    // ── Fetch ticket detail via TanStack Query ──
    const { data: result, isLoading, error } = useQuery(
        orpc.adminTicket.getById.queryOptions({
            input: { id: ticketId },
        }),
    );

    const ticket = result?.data as any;

    // ── Mutations ──

    const replyMutation = useMutation({
        mutationFn: (input: { ticketId: number; message: string }) =>
            client.adminTicket.addReply(input),
        onSuccess: () => {
            toast.success("Reply sent");
            setReplyMessage("");
            queryClient.invalidateQueries({ queryKey: orpc.adminTicket.key() });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to send reply"),
    });

    const noteMutation = useMutation({
        mutationFn: (input: { ticketId: number; note: string }) =>
            client.adminTicket.addInternalNote(input),
        onSuccess: () => {
            toast.success("Internal note saved");
            setInternalNote("");
            queryClient.invalidateQueries({ queryKey: orpc.adminTicket.key() });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save note"),
    });

    const statusMutation = useMutation({
        mutationFn: (input: { ticketId: number; status: "open" | "in_progress" | "resolved" | "closed" }) =>
            client.adminTicket.updateStatus(input),
        onSuccess: (_, variables) => {
            toast.success(`Status updated to ${STATUS_LABELS[variables.status]}`);
            queryClient.invalidateQueries({ queryKey: orpc.adminTicket.key() });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update status"),
    });

    const priorityMutation = useMutation({
        mutationFn: (input: { ticketId: number; priority: "low" | "medium" | "high" | "critical" }) =>
            client.adminTicket.updatePriority(input),
        onSuccess: () => {
            toast.success("Priority updated");
            queryClient.invalidateQueries({ queryKey: orpc.adminTicket.key() });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update priority"),
    });

    const escalateMutation = useMutation({
        mutationFn: (input: { ticketId: number }) =>
            client.adminTicket.escalate(input),
        onSuccess: () => {
            toast.success("Ticket escalated to critical");
            queryClient.invalidateQueries({ queryKey: orpc.adminTicket.key() });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to escalate"),
    });

    // ── Handlers ──

    function handleSendReply() {
        if (!replyMessage.trim() || replyMessage.length < 5) {
            toast.error("Reply must be at least 5 characters");
            return;
        }
        replyMutation.mutate({ ticketId, message: replyMessage });
    }

    function handleSaveNote() {
        if (!internalNote.trim()) {
            toast.error("Note cannot be empty");
            return;
        }
        noteMutation.mutate({ ticketId, note: internalNote });
    }

    function handleStatusChange(newStatus: string) {
        statusMutation.mutate({ ticketId, status: newStatus as "open" | "in_progress" | "resolved" | "closed" });
    }

    function handlePriorityChange(newPriority: string) {
        priorityMutation.mutate({ ticketId, priority: newPriority as "low" | "medium" | "high" | "critical" });
    }

    // ── Loading ──
    if (isLoading) {
        return (
            <div className="flex flex-col gap-6">
                <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 text-xs w-fit">
                    <Link href="/dashboard/admin/tickets">
                        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                        Back to Tickets
                    </Link>
                </Button>
                <Skeleton className="h-48 w-full rounded-xl" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-5">
                        <Skeleton className="h-40 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                    </div>
                    <div className="space-y-5">
                        <Skeleton className="h-48 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                    </div>
                </div>
            </div>
        );
    }

    // ── Error ──
    if (error || !ticket) {
        return (
            <div className="flex flex-col gap-6">
                <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 text-xs w-fit">
                    <Link href="/dashboard/admin/tickets">
                        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                        Back to Tickets
                    </Link>
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

    const statusStyle = getStatusColor(ticket.status);
    const priorityStyle = getPriorityStyle(ticket.priority);
    const userType = getUserTypeLabel(ticket.userType);
    const currentStepIndex = STATUS_STEPS.indexOf(ticket.status as typeof STATUS_STEPS[number]);
    const canReply = ticket.status !== "closed";

    // ── Build unified timeline ──

    type TimelineItem =
        | { type: "reply"; data: any }
        | { type: "note"; data: any };

    const timeline: TimelineItem[] = [
        ...(ticket.replies || []).map((r: any) => ({ type: "reply" as const, data: r })),
        ...(ticket.notes || []).map((n: any) => ({ type: "note" as const, data: n })),
    ].sort(
        (a, b) => new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime(),
    );

    // ── Render ──

    return (
        <div className="flex flex-col gap-6">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div>
                <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 text-xs">
                    <Link href="/dashboard/admin/tickets">
                        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                        Back to Tickets
                    </Link>
                </Button>

                {/* Gradient header card */}
                <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-sm font-bold opacity-80">
                                    {ticket.ticketNumber}
                                </span>
                                <Badge
                                    className={cn(
                                        userType.bg,
                                        userType.color,
                                        "border-0 text-[10px] font-semibold",
                                    )}
                                >
                                    {userType.label}
                                </Badge>
                                <Badge className="border-0 text-[10px] font-semibold bg-white/15 text-white/90">
                                    {getCategoryLabel(ticket.category)}
                                </Badge>
                                {(ticket.escalatedAt || ticket.currentLevel === "level_2") && (
                                    <Badge className="border-0 text-[10px] font-semibold bg-orange-500/30 text-orange-200">
                                        <ArrowUpRight className="mr-1 h-3 w-3" />
                                        Escalated {ticket.autoEscalated ? "(Auto)" : "(Manual)"}
                                    </Badge>
                                )}
                            </div>
                            <h1 className="text-xl font-bold">{ticket.subject}</h1>
                            <div className="flex items-center gap-4 text-sm text-white/60">
                                <span>
                                    <User className="inline h-3.5 w-3.5 mr-1" />
                                    {ticket.customer?.name || "Unknown"}
                                </span>
                                <span>
                                    Created {format(new Date(ticket.createdAt), "dd MMM yyyy, hh:mm a")}
                                </span>
                            </div>
                        </div>

                        {/* Priority & Status controls */}
                        <div className="flex items-center gap-3">
                            <div>
                                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Priority</p>
                                <Select
                                    value={ticket.priority}
                                    onValueChange={handlePriorityChange}
                                    disabled={priorityMutation.isPending}
                                >
                                    <SelectTrigger className="w-[120px] h-8 text-xs bg-white/10 border-white/20 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">🟢 Low</SelectItem>
                                        <SelectItem value="medium">🟠 Medium</SelectItem>
                                        <SelectItem value="high">🔴 High</SelectItem>
                                        <SelectItem value="critical">⚫ Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <p className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Status</p>
                                <Select
                                    value={ticket.status}
                                    onValueChange={handleStatusChange}
                                    disabled={statusMutation.isPending}
                                >
                                    <SelectTrigger className="w-[140px] h-8 text-xs bg-white/10 border-white/20 text-white">
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
                    </div>

                    {/* ── Lifecycle Stepper ─────────────────────────────────── */}
                    <div className="mt-6 flex items-center gap-0">
                        {STATUS_STEPS.map((step, idx) => {
                            const isActive = idx <= currentStepIndex;
                            const isCurrent = idx === currentStepIndex;
                            return (
                                <div key={step} className="flex items-center flex-1 last:flex-none">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={cn(
                                                "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                                                isCurrent
                                                    ? "bg-white text-slate-900 ring-2 ring-white/40 ring-offset-2 ring-offset-slate-800"
                                                    : isActive
                                                        ? "bg-white/80 text-slate-900"
                                                        : "bg-white/15 text-white/40",
                                            )}
                                        >
                                            {isActive && idx < currentStepIndex ? (
                                                <Check className="h-3.5 w-3.5" />
                                            ) : (
                                                idx + 1
                                            )}
                                        </div>
                                        <span
                                            className={cn(
                                                "text-[10px] mt-1.5 font-medium",
                                                isCurrent
                                                    ? "text-white"
                                                    : isActive
                                                        ? "text-white/70"
                                                        : "text-white/30",
                                            )}
                                        >
                                            {STATUS_LABELS[step]}
                                        </span>
                                    </div>
                                    {idx < STATUS_STEPS.length - 1 && (
                                        <div
                                            className={cn(
                                                "flex-1 h-0.5 mx-2 rounded-full mt-[-14px]",
                                                idx < currentStepIndex
                                                    ? "bg-white/60"
                                                    : "bg-white/15",
                                            )}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Main Content Grid ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT: Issue + Thread */}
                <div className="lg:col-span-2 space-y-5">
                    {/* Issue Description */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                                    <User className="h-4 w-4 text-gray-500" />
                                </div>
                                <div>
                                    <span className="font-semibold text-sm">
                                        {ticket.customer?.name || "Customer"}
                                    </span>
                                    <span className="text-gray-400 text-xs ml-2">
                                        {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                                    </span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {ticket.message}
                            </p>

                            {/* Attachments */}
                            {ticket.attachments?.length > 0 && (
                                <div className="mt-4 pt-4 border-t">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                        Attachments
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {ticket.attachments.map((att: any) => (
                                            <a
                                                key={att.id}
                                                href={att.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-50 hover:bg-gray-100 border transition-colors"
                                            >
                                                <FileText className="h-4 w-4 text-gray-500" />
                                                <span className="text-xs text-gray-700 font-medium truncate max-w-[120px]">
                                                    {att.fileName}
                                                </span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Communication Thread */}
                    {timeline.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-gray-400" />
                                Communication Thread
                                <span className="text-xs font-normal text-gray-400">
                                    ({timeline.length} message{timeline.length !== 1 ? "s" : ""})
                                </span>
                            </h3>
                            <div className="space-y-3">
                                {timeline.map((item) => {
                                    if (item.type === "note") {
                                        // Internal note
                                        return (
                                            <Card
                                                key={`note-${item.data.id}`}
                                                className="border-amber-200 bg-amber-50/50 shadow-none"
                                            >
                                                <CardContent className="pt-4 pb-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center">
                                                            <StickyNote className="h-3.5 w-3.5 text-amber-600" />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-xs text-amber-800">
                                                                {item.data.user.name}
                                                            </span>
                                                            <Badge className="bg-amber-100 text-amber-700 border-0 text-[9px] px-1.5 py-0">
                                                                <Lock className="h-2.5 w-2.5 mr-0.5" />
                                                                Internal
                                                            </Badge>
                                                            <span className="text-gray-400 text-[11px]">
                                                                {formatDistanceToNow(new Date(item.data.createdAt), { addSuffix: true })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-amber-900 whitespace-pre-wrap ml-9">
                                                        {item.data.note}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        );
                                    }

                                    // Reply (staff or customer)
                                    const reply = item.data;
                                    return (
                                        <Card
                                            key={`reply-${reply.id}`}
                                            className={cn(
                                                "shadow-none",
                                                reply.isStaffReply
                                                    ? "border-emerald-200 bg-emerald-50/40"
                                                    : "border-gray-200",
                                            )}
                                        >
                                            <CardContent className="pt-4 pb-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div
                                                        className={cn(
                                                            "h-7 w-7 rounded-full flex items-center justify-center",
                                                            reply.isStaffReply ? "bg-emerald-100" : "bg-gray-100",
                                                        )}
                                                    >
                                                        <User
                                                            className={cn(
                                                                "h-3.5 w-3.5",
                                                                reply.isStaffReply ? "text-emerald-600" : "text-gray-500",
                                                            )}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-xs">
                                                            {reply.isStaffReply ? "Support Team" : reply.user?.name || "Customer"}
                                                        </span>
                                                        {reply.isStaffReply && (
                                                            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] px-1.5 py-0">
                                                                Staff
                                                            </Badge>
                                                        )}
                                                        <span className="text-gray-400 text-[11px]">
                                                            {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap ml-9">
                                                    {reply.message}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Reply Form */}
                    {canReply ? (
                        <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Send className="h-4 w-4 text-gray-400" />
                                    Reply to User
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Textarea
                                    value={replyMessage}
                                    onChange={(e) => setReplyMessage(e.target.value)}
                                    placeholder="Type your reply to the user..."
                                    className="min-h-[100px] resize-none text-sm"
                                />
                                <div className="flex justify-end">
                                    <Button
                                        onClick={handleSendReply}
                                        disabled={replyMutation.isPending || !replyMessage.trim()}
                                        size="sm"
                                    >
                                        {replyMutation.isPending ? (
                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Send className="mr-2 h-3.5 w-3.5" />
                                        )}
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

                {/* RIGHT: Sidebar */}
                <div className="space-y-5">
                    {/* Customer Info */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold">Customer Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                                    <User className="h-5 w-5 text-gray-500" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">
                                        {ticket.customer?.name || "N/A"}
                                    </p>
                                    <Badge
                                        className={cn(
                                            userType.bg,
                                            userType.color,
                                            "border-0 text-[10px] font-semibold mt-0.5",
                                        )}
                                    >
                                        {userType.label}
                                    </Badge>
                                </div>
                            </div>

                            <Separator />

                            {ticket.customer?.shopName && (
                                <div className="flex items-center gap-3">
                                    <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">{ticket.customer.shopName}</p>
                                        <p className="text-[11px] text-gray-500">Shop Name</p>
                                    </div>
                                </div>
                            )}

                            {ticket.customer?.warehouseName && (
                                <div className="flex items-center gap-3">
                                    <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">{ticket.customer.warehouseName}</p>
                                        <p className="text-[11px] text-gray-500">Warehouse</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium">{ticket.customer?.email || "N/A"}</p>
                                    <p className="text-[11px] text-gray-500">Email</p>
                                </div>
                            </div>

                            {ticket.customer?.phoneNumber && (
                                <div className="flex items-center gap-3">
                                    <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                                    <div>
                                        <p className="text-sm font-medium">{ticket.customer.phoneNumber}</p>
                                        <p className="text-[11px] text-gray-500">Phone</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Ticket Meta */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold">Ticket Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">Category</span>
                                <span className="text-xs font-medium">{getCategoryLabel(ticket.category)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">Priority</span>
                                <div className="flex items-center gap-1.5">
                                    <span className={cn("h-2 w-2 rounded-full", priorityStyle.dot)} />
                                    <Badge className={cn(priorityStyle.bg, priorityStyle.color, "border-0 text-[10px] font-semibold capitalize px-2 py-0.5")}>
                                        {ticket.priority}
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">Status</span>
                                <Badge className={cn(statusStyle.bg, statusStyle.color, "border-0 text-[10px] font-semibold capitalize px-2 py-0.5")}>
                                    {ticket.status.replace("_", " ")}
                                </Badge>
                            </div>
                            <Separator />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">Created</span>
                                <span className="text-xs">{format(new Date(ticket.createdAt), "dd MMM, hh:mm a")}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">Updated</span>
                                <span className="text-xs">{format(new Date(ticket.updatedAt), "dd MMM, hh:mm a")}</span>
                            </div>
                            {ticket.resolvedAt && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Resolved</span>
                                    <span className="text-xs">{format(new Date(ticket.resolvedAt), "dd MMM, hh:mm a")}</span>
                                </div>
                            )}
                            {ticket.closedAt && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Closed</span>
                                    <span className="text-xs">{format(new Date(ticket.closedAt), "dd MMM, hh:mm a")}</span>
                                </div>
                            )}
                            {ticket.escalatedAt && (
                                <div className="flex items-center justify-between text-red-600">
                                    <span className="text-xs flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Escalated
                                    </span>
                                    <span className="text-xs">{format(new Date(ticket.escalatedAt), "dd MMM, hh:mm a")}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Action Panel */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold">Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {/* Escalate */}
                            {ticket.status !== "closed" && ticket.priority !== "critical" && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8" disabled={escalateMutation.isPending}>
                                            <ShieldAlert className="mr-2 h-3.5 w-3.5 text-red-500" />
                                            Escalate Issue
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Escalate this ticket?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will set the priority to Critical and flag the ticket as escalated. This action is logged.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => escalateMutation.mutate({ ticketId })}
                                                className="bg-red-600 hover:bg-red-700"
                                            >
                                                {escalateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Escalate
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}

                            {/* Mark Resolved */}
                            {ticket.status !== "resolved" && ticket.status !== "closed" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start text-xs h-8"
                                    onClick={() => handleStatusChange("resolved")}
                                    disabled={statusMutation.isPending}
                                >
                                    <Check className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                                    Mark as Resolved
                                </Button>
                            )}

                            {/* Close Ticket */}
                            {ticket.status !== "closed" && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                                            <XCircle className="mr-2 h-3.5 w-3.5 text-gray-500" />
                                            Close Ticket
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Close this ticket?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Closed tickets cannot receive new replies. You can reopen it later if needed.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleStatusChange("closed")}>
                                                Close Ticket
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}

                            {/* Reopen */}
                            {ticket.status === "closed" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start text-xs h-8"
                                    onClick={() => handleStatusChange("open")}
                                    disabled={statusMutation.isPending}
                                >
                                    <ChevronRight className="mr-2 h-3.5 w-3.5 text-blue-500" />
                                    Reopen Ticket
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* Internal Notes */}
                    <Card className="border-0 shadow-sm border-l-2 border-l-amber-300">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <StickyNote className="h-4 w-4 text-amber-500" />
                                Internal Note
                            </CardTitle>
                            <p className="text-[11px] text-gray-500">Only visible to admin team</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Textarea
                                value={internalNote}
                                onChange={(e) => setInternalNote(e.target.value)}
                                placeholder="Add an internal note..."
                                className="min-h-[80px] resize-none text-sm bg-amber-50/50"
                            />
                            <Button
                                onClick={handleSaveNote}
                                disabled={noteMutation.isPending || !internalNote.trim()}
                                size="sm"
                                variant="outline"
                                className="w-full text-xs h-8"
                            >
                                {noteMutation.isPending ? (
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <StickyNote className="mr-2 h-3.5 w-3.5" />
                                )}
                                Save Note
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
