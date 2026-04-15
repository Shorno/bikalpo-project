"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
    ArrowLeft,
    ArrowUpRight,
    Check,
    CheckCircle,
    Clock,
    Headphones,
    Loader2,
    MessageSquare,
    Send,
    ShieldAlert,
    Ticket,
    Timer,
    User,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { client } from "@/utils/orpc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    open: { label: "Open", color: "bg-blue-500/10 text-blue-600 border-blue-200", icon: <Clock className="h-3 w-3" /> },
    in_progress: { label: "In Progress", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: <Loader2 className="h-3 w-3" /> },
    resolved: { label: "Resolved", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: <CheckCircle className="h-3 w-3" /> },
    closed: { label: "Closed", color: "bg-slate-500/10 text-slate-500 border-slate-200", icon: <Check className="h-3 w-3" /> },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
    low: { label: "Low", color: "bg-slate-100 text-slate-600 border-slate-200" },
    medium: { label: "Medium", color: "bg-blue-100 text-blue-700 border-blue-200" },
    high: { label: "High", color: "bg-orange-100 text-orange-700 border-orange-200" },
    critical: { label: "Critical", color: "bg-red-100 text-red-700 border-red-200" },
};

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

// ─── Types ───────────────────────────────────────────────────────────────────

type TicketListItem = {
    id: number;
    ticketNumber: string;
    subject: string;
    message: string;
    status: string;
    priority: string;
    category: string;
    userType: string;
    escalationDeadline: string | null;
    createdAt: string;
    updatedAt: string;
    customer: {
        id: string;
        name: string;
        email: string;
        phoneNumber: string | null;
        shopName: string | null;
    } | null;
};

type TicketDetail = TicketListItem & {
    currentLevel: string;
    assignedToId: string | null;
    escalatedAt: string | null;
    autoEscalated: boolean | null;
    resolvedAt: string | null;
    closedAt: string | null;
    assignedHandler: {
        id: string;
        name: string;
        shopName: string | null;
        warehouseName: string | null;
        role: string | null;
    } | null;
    replies: {
        id: number;
        ticketId: number;
        userId: string;
        message: string;
        isStaffReply: boolean;
        createdAt: string;
        user: { id: string; name: string; image: string | null; role: string | null };
    }[];
    attachments: {
        id: number;
        url: string;
        fileName: string;
        fileType: string | null;
        createdAt: string;
    }[];
};

type IncomingStats = {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    overdue: number;
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * IncomingSupportPanel — Shows tickets assigned to the current user from the level below.
 *
 * - Shop owners see consumer tickets
 * - Warehouse owners see retailer tickets
 *
 * Features: KPI cards, ticket list with deadline countdown, detail view with reply,
 * resolve & escalate actions.
 */
export function IncomingSupportPanel() {
    const [view, setView] = useState<"list" | "detail">("list");
    const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);

    // ── Stats ──
    const [stats, setStats] = useState<IncomingStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    // ── List ──
    const [tickets, setTickets] = useState<TicketListItem[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, totalCount: 0, totalPages: 0 });
    const [listLoading, setListLoading] = useState(true);

    // ── Detail ──
    const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [replying, setReplying] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // ── Load Stats ──
    const loadStats = useCallback(async () => {
        try {
            setStatsLoading(true);
            const data = await client.userTicket.getIncomingStats();
            setStats(data);
        } catch {
            /* ignore */
        } finally {
            setStatsLoading(false);
        }
    }, []);

    // ── Load List ──
    const loadTickets = useCallback(async () => {
        try {
            setListLoading(true);
            const data = await client.userTicket.getIncomingTickets({
                page: currentPage,
                limit: 10,
                status: statusFilter === "all" ? undefined : statusFilter,
            });
            setTickets(data.tickets as unknown as TicketListItem[]);
            setPagination(data.pagination);
        } catch {
            toast.error("Failed to load tickets");
        } finally {
            setListLoading(false);
        }
    }, [currentPage, statusFilter]);

    // ── Load Detail ──
    const loadTicketDetail = useCallback(async (id: number) => {
        try {
            setDetailLoading(true);
            const data = await client.userTicket.getById({ id });
            setTicketDetail(data as unknown as TicketDetail);
        } catch {
            toast.error("Failed to load ticket details");
        } finally {
            setDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
        loadTickets();
    }, [loadStats, loadTickets]);

    useEffect(() => {
        if (selectedTicketId && view === "detail") {
            loadTicketDetail(selectedTicketId);
        }
    }, [selectedTicketId, view, loadTicketDetail]);

    // ── Actions ──
    const handleReply = async () => {
        if (!replyText.trim() || !selectedTicketId) return;
        try {
            setReplying(true);
            await client.userTicket.reply({
                ticketId: selectedTicketId,
                message: replyText,
            });
            toast.success("Reply sent");
            setReplyText("");
            loadTicketDetail(selectedTicketId);
            loadStats();
        } catch {
            toast.error("Failed to send reply");
        } finally {
            setReplying(false);
        }
    };

    const handleResolve = async () => {
        if (!selectedTicketId) return;
        try {
            setActionLoading(true);
            await client.userTicket.resolve({ ticketId: selectedTicketId });
            toast.success("Ticket resolved");
            loadTicketDetail(selectedTicketId);
            loadTickets();
            loadStats();
        } catch {
            toast.error("Failed to resolve ticket");
        } finally {
            setActionLoading(false);
        }
    };

    const handleEscalate = async () => {
        if (!selectedTicketId) return;
        try {
            setActionLoading(true);
            await client.userTicket.escalateToAdmin({ ticketId: selectedTicketId });
            toast.success("Ticket escalated to admin");
            // Return to list since we no longer handle this ticket
            setView("list");
            setSelectedTicketId(null);
            loadTickets();
            loadStats();
        } catch {
            toast.error("Failed to escalate ticket");
        } finally {
            setActionLoading(false);
        }
    };

    const openTicket = (id: number) => {
        setSelectedTicketId(id);
        setView("detail");
    };

    // ═══════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════

    if (view === "detail" && ticketDetail) {
        return renderDetailView();
    }

    return renderListView();

    // ── List View ──
    function renderListView() {
        return (
            <div className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {[
                        { label: "Total", value: stats?.total ?? 0, icon: <Ticket className="h-4 w-4" />, color: "text-slate-700" },
                        { label: "Open", value: stats?.open ?? 0, icon: <Clock className="h-4 w-4" />, color: "text-blue-600" },
                        { label: "In Progress", value: stats?.inProgress ?? 0, icon: <Loader2 className="h-4 w-4" />, color: "text-amber-600" },
                        { label: "Resolved", value: stats?.resolved ?? 0, icon: <CheckCircle className="h-4 w-4" />, color: "text-emerald-600" },
                        { label: "Closed", value: stats?.closed ?? 0, icon: <Check className="h-4 w-4" />, color: "text-slate-500" },
                        { label: "Overdue", value: stats?.overdue ?? 0, icon: <ShieldAlert className="h-4 w-4" />, color: "text-red-600" },
                    ].map((kpi) => (
                        <Card key={kpi.label} className="border border-slate-200">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={kpi.color}>{kpi.icon}</span>
                                    <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                                </div>
                                <p className={cn("text-2xl font-bold", kpi.color)}>
                                    {statsLoading ? "—" : kpi.value}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3">
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground ml-auto">
                        {pagination.totalCount} ticket{pagination.totalCount !== 1 ? "s" : ""}
                    </span>
                </div>

                {/* Ticket List */}
                {listLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : tickets.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Headphones className="h-12 w-12 text-muted-foreground/30 mb-4" />
                            <p className="text-muted-foreground font-medium">No incoming tickets</p>
                            <p className="text-sm text-muted-foreground/60 mt-1">
                                Tickets from your customers will appear here
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {tickets.map((ticket) => {
                            const sc = statusConfig[ticket.status] || statusConfig.open;
                            const pc = priorityConfig[ticket.priority] || priorityConfig.medium;
                            const dl = getDeadlineStatus(ticket.escalationDeadline);

                            return (
                                <Card
                                    key={ticket.id}
                                    className={cn(
                                        "cursor-pointer hover:border-slate-300 transition-colors",
                                        dl.isOverdue && "border-red-200 bg-red-50/30",
                                    )}
                                    onClick={() => openTicket(ticket.id)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-mono text-muted-foreground">
                                                        {ticket.ticketNumber}
                                                    </span>
                                                    <Badge variant="outline" className={cn("text-[10px] px-1.5", sc.color)}>
                                                        {sc.icon}
                                                        <span className="ml-1">{sc.label}</span>
                                                    </Badge>
                                                    <Badge variant="outline" className={cn("text-[10px] px-1.5", pc.color)}>
                                                        {pc.label}
                                                    </Badge>
                                                </div>
                                                <h4 className="font-medium text-sm truncate">{ticket.subject}</h4>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <User className="h-3 w-3" />
                                                        {ticket.customer?.name || "Unknown"}
                                                        {ticket.customer?.shopName && (
                                                            <span className="text-muted-foreground/60">
                                                                ({ticket.customer.shopName})
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={cn("text-xs flex items-center gap-1", dl.color)}>
                                                    <Timer className="h-3 w-3" />
                                                    {dl.label}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage((p) => p - 1)}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {currentPage} of {pagination.totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage >= pagination.totalPages}
                            onClick={() => setCurrentPage((p) => p + 1)}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    // ── Detail View ──
    function renderDetailView() {
        if (detailLoading || !ticketDetail) {
            return (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            );
        }

        const sc = statusConfig[ticketDetail.status] || statusConfig.open;
        const pc = priorityConfig[ticketDetail.priority] || priorityConfig.medium;
        const dl = getDeadlineStatus(ticketDetail.escalationDeadline);
        const isActive = ticketDetail.status === "open" || ticketDetail.status === "in_progress";

        const STATUS_STEPS = ["open", "in_progress", "resolved", "closed"] as const;
        const STATUS_LABELS: Record<string, string> = {
            open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed",
        };
        const currentStepIndex = STATUS_STEPS.indexOf(ticketDetail.status as typeof STATUS_STEPS[number]);

        return (
            <div className="space-y-6">
                {/* Back button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setView("list"); setSelectedTicketId(null); setTicketDetail(null); }}
                    className="gap-1"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to tickets
                </Button>

                {/* Status Stepper */}
                <Card className="border-0 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-800 to-slate-600 p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-mono font-bold text-white/80">
                                {ticketDetail.ticketNumber}
                            </span>
                            <Badge variant="outline" className={cn("text-xs border-white/20 text-white/90", sc.color.replace(/text-\S+/, "text-white"))}>
                                {sc.label}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-0">
                            {STATUS_STEPS.map((step, idx) => {
                                const isStepActive = idx <= currentStepIndex;
                                const isCurrent = idx === currentStepIndex;
                                return (
                                    <div key={step} className="flex items-center flex-1 last:flex-none">
                                        <div className="flex flex-col items-center">
                                            <div
                                                className={cn(
                                                    "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                                                    isCurrent
                                                        ? "bg-white text-slate-900 ring-2 ring-white/30 ring-offset-1 ring-offset-slate-700"
                                                        : isStepActive
                                                            ? "bg-white/70 text-slate-900"
                                                            : "bg-white/15 text-white/40",
                                                )}
                                            >
                                                {isStepActive && idx < currentStepIndex ? <Check className="h-3 w-3" /> : idx + 1}
                                            </div>
                                            <span className={cn("text-[9px] mt-1 font-medium", isCurrent ? "text-white" : isStepActive ? "text-white/60" : "text-white/25")}>
                                                {STATUS_LABELS[step]}
                                            </span>
                                        </div>
                                        {idx < STATUS_STEPS.length - 1 && (
                                            <div className={cn("flex-1 h-0.5 mx-1.5 rounded-full mt-[-12px]", idx < currentStepIndex ? "bg-white/50" : "bg-white/10")} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Card>

                {/* Header */}
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className={cn("text-xs", pc.color)}>
                                        {pc.label}
                                    </Badge>
                                    {dl.isOverdue && (
                                        <Badge variant="destructive" className="text-xs">
                                            <ShieldAlert className="h-3 w-3 mr-1" />
                                            Overdue
                                        </Badge>
                                    )}
                                </div>
                                <CardTitle className="text-lg">{ticketDetail.subject}</CardTitle>
                            </div>
                            {/* Actions */}
                            {isActive && (
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleEscalate}
                                        disabled={actionLoading}
                                        className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                    >
                                        <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                                        Escalate to Admin
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleResolve}
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
                                    {ticketDetail.customer?.name || "Unknown"}
                                    {ticketDetail.customer?.shopName && (
                                        <span className="text-muted-foreground font-normal ml-1">
                                            ({ticketDetail.customer.shopName})
                                        </span>
                                    )}
                                </p>
                                {ticketDetail.customer?.phoneNumber && (
                                    <p className="text-xs text-muted-foreground">{ticketDetail.customer.phoneNumber}</p>
                                )}
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Category</span>
                                <p className="font-medium capitalize">{ticketDetail.category}</p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Created</span>
                                <p className="font-medium">
                                    {format(new Date(ticketDetail.createdAt), "MMM dd, yyyy HH:mm")}
                                </p>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs">Escalation Deadline</span>
                                <p className={cn("font-medium", dl.color)}>
                                    {ticketDetail.escalationDeadline
                                        ? format(new Date(ticketDetail.escalationDeadline), "MMM dd, yyyy HH:mm")
                                        : "None"}
                                </p>
                                {ticketDetail.escalationDeadline && (
                                    <p className={cn("text-xs", dl.color)}>{dl.label}</p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Original Message */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Original Issue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{ticketDetail.message}</p>
                    </CardContent>
                </Card>

                {/* Replies */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Conversation ({ticketDetail.replies.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {ticketDetail.replies.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                No replies yet. Send a response below.
                            </p>
                        ) : (
                            ticketDetail.replies.map((reply) => (
                                <div
                                    key={reply.id}
                                    className={cn(
                                        "p-3 rounded-lg text-sm",
                                        reply.isStaffReply
                                            ? "bg-blue-50 border border-blue-100 ml-6"
                                            : "bg-slate-50 border border-slate-100 mr-6",
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-xs">
                                            {reply.user.name}
                                            {reply.isStaffReply && (
                                                <Badge variant="outline" className="ml-1.5 text-[10px] px-1">
                                                    Staff
                                                </Badge>
                                            )}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className="whitespace-pre-wrap">{reply.message}</p>
                                </div>
                            ))
                        )}

                        {/* Reply Input */}
                        {isActive && (
                            <div className="pt-3 border-t">
                                <Textarea
                                    placeholder="Type your response..."
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    rows={3}
                                    className="mb-2"
                                />
                                <div className="flex justify-end">
                                    <Button
                                        size="sm"
                                        onClick={handleReply}
                                        disabled={replying || !replyText.trim()}
                                    >
                                        {replying ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                        ) : (
                                            <Send className="h-4 w-4 mr-1" />
                                        )}
                                        Send Reply
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }
}
