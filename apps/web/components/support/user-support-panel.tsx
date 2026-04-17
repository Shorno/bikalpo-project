"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
    ArrowLeft,
    ArrowUpRight,
    Check,
    CheckCircle,
    Clock,
    FileText,
    Headphones,
    ImageIcon,
    Loader2,
    Lock,
    MessageSquare,
    Paperclip,
    Plus,
    Send,
    Ticket,
    User,
    X,
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fileToDataUrl } from "@/lib/cloudinary";
import { client } from "@/utils/orpc";

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
            return { color: "text-red-700", bg: "bg-red-50", dot: "bg-red-500" };
        case "medium":
            return { color: "text-orange-700", bg: "bg-orange-50", dot: "bg-orange-500" };
        case "low":
            return { color: "text-gray-600", bg: "bg-gray-50", dot: "bg-gray-400" };
        default:
            return { color: "text-gray-600", bg: "bg-gray-50", dot: "bg-gray-400" };
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketItem {
    id: number;
    ticketNumber: string;
    subject: string;
    message: string;
    status: string;
    priority: string;
    category: string;
    currentLevel?: string;
    escalatedAt?: string | null;
    autoEscalated?: boolean | null;
    assignedTo?: {
        id: string;
        name: string;
        shopName: string | null;
        warehouseName: string | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
}

interface TicketDetail extends TicketItem {
    resolvedAt: Date | null;
    closedAt: Date | null;
    assignedHandler?: {
        id: string;
        name: string;
        shopName: string | null;
        warehouseName: string | null;
        role: string | null;
    } | null;
    replies: {
        id: number;
        message: string;
        isStaffReply: boolean;
        createdAt: Date;
        user: { id: string; name: string; image: string | null };
    }[];
    attachments: {
        id: number;
        url: string;
        fileName: string;
    }[];
}

interface Stats {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface UserSupportPanelProps {
    /** Role of the logged-in user: 'consumer', 'shop_owner', 'warehouse' */
    userRole?: string;
}

export function UserSupportPanel({ userRole = "consumer" }: UserSupportPanelProps) {
    const [view, setView] = useState<"list" | "detail">("list");
    const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

    const openTicket = (id: number) => {
        setSelectedTicketId(id);
        setView("detail");
    };

    const goBack = () => {
        setView("list");
        setSelectedTicketId(null);
    };

    return view === "detail" && selectedTicketId ? (
        <TicketDetailView ticketId={selectedTicketId} onBack={goBack} />
    ) : (
        <TicketListView onOpenTicket={openTicket} userRole={userRole} />
    );
}

// ─── Ticket List View ────────────────────────────────────────────────────────

function TicketListView({ onOpenTicket, userRole }: { onOpenTicket: (id: number) => void; userRole: string }) {
    const [tickets, setTickets] = useState<TicketItem[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState("all");

    // New ticket dialog
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newSubject, setNewSubject] = useState("");
    const [newMessage, setNewMessage] = useState("");
    const [newCategory, setNewCategory] = useState("other");
    const [newPriority, setNewPriority] = useState("medium");
    const [creating, setCreating] = useState(false);

    // File attachments
    const [attachments, setAttachments] = useState<{ url: string; fileName: string; fileType: string; preview?: string }[]>([]);
    const [uploading, setUploading] = useState(false);

    // Shop/warehouse selector for hierarchical routing
    const [selectedTargetId, setSelectedTargetId] = useState("");
    const [targetOptions, setTargetOptions] = useState<{ id: string; label: string }[]>([]);
    const [targetLoading, setTargetLoading] = useState(false);

    // Fetch target options (shops for consumer, warehouses for shop_owner)
    useEffect(() => {
        async function fetchTargets() {
            if (userRole === "warehouse") return; // warehouse → admin, no selector needed
            setTargetLoading(true);
            try {
                if (userRole === "consumer" || userRole === "user" || !userRole) {
                    const shops = await client.userTicket.getMyShops();
                    setTargetOptions(
                        (shops || []).map((s: { id: string; shopName: string | null; name: string }) => ({
                            id: s.id,
                            label: s.shopName || s.name,
                        })),
                    );
                } else if (userRole === "shop_owner") {
                    const warehouses = await client.userTicket.getMyWarehouses();
                    setTargetOptions(
                        (warehouses || []).map((w: { id: string; warehouseName: string | null; name: string }) => ({
                            id: w.id,
                            label: w.warehouseName || w.name,
                        })),
                    );
                }
            } catch {
                /* ignore */
            } finally {
                setTargetLoading(false);
            }
        }
        fetchTargets();
    }, [userRole]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [ticketsResult, statsResult] = await Promise.all([
                client.userTicket.getMyTickets({
                    page,
                    limit: 10,
                    status: statusFilter !== "all" ? statusFilter : undefined,
                }),
                client.userTicket.getMyStats(),
            ]);

            setTickets((ticketsResult?.tickets as TicketItem[]) || []);
            setTotalPages(ticketsResult?.pagination?.totalPages || 1);
            setStats(statsResult as Stats);
        } catch {
            toast.error("Failed to load tickets");
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreate = async () => {
        if (!newSubject.trim() || newSubject.length < 5) {
            toast.error("Subject must be at least 5 characters");
            return;
        }
        if (!newMessage.trim() || newMessage.length < 10) {
            toast.error("Message must be at least 10 characters");
            return;
        }
        // Validation: consumer/shop_owner must select a target
        if (userRole !== "warehouse" && !selectedTargetId) {
            toast.error(
                userRole === "shop_owner"
                    ? "Please select a warehouse"
                    : "Please select a shop",
            );
            return;
        }

        setCreating(true);
        try {
            await client.userTicket.create({
                subject: newSubject,
                message: newMessage,
                category: newCategory as "order" | "payment" | "delivery" | "account" | "other",
                priority: newPriority as "low" | "medium" | "high",
                ...(userRole === "shop_owner"
                    ? { warehouseId: selectedTargetId }
                    : userRole !== "warehouse"
                        ? { shopId: selectedTargetId }
                        : {}),
                attachments: attachments.length > 0
                    ? attachments.map((a) => ({ url: a.url, fileName: a.fileName, fileType: a.fileType }))
                    : undefined,
            });
            toast.success("Support ticket created");
            setDialogOpen(false);
            setNewSubject("");
            setNewMessage("");
            setNewCategory("other");
            setNewPriority("medium");
            setSelectedTargetId("");
            setAttachments([]);
            fetchData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create ticket");
        } finally {
            setCreating(false);
        }
    };

    const kpiCards = [
        { label: "Total", value: stats?.total || 0, icon: Ticket, iconColor: "text-gray-500", bgAccent: "bg-gray-50" },
        { label: "Open", value: stats?.open || 0, icon: Clock, iconColor: "text-amber-500", bgAccent: "bg-amber-50" },
        { label: "In Progress", value: stats?.inProgress || 0, icon: Loader2, iconColor: "text-blue-500", bgAccent: "bg-blue-50" },
        { label: "Resolved", value: stats?.resolved || 0, icon: CheckCircle, iconColor: "text-emerald-500", bgAccent: "bg-emerald-50" },
    ];

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Support</h1>
                    <p className="text-sm text-muted-foreground">
                        Create and track your support tickets.
                    </p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            New Ticket
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[520px]">
                        <DialogHeader>
                            <DialogTitle>Create Support Ticket</DialogTitle>
                            <DialogDescription>
                                Describe your issue and our team will get back to you.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Subject</label>
                                <Input
                                    value={newSubject}
                                    onChange={(e) => setNewSubject(e.target.value)}
                                    placeholder="Brief description of your issue..."
                                />
                            </div>
                            {/* Target Selector: Shop (for consumer) or Warehouse (for shop_owner) */}
                            {userRole !== "warehouse" && (
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">
                                        {userRole === "shop_owner" ? "Select Warehouse" : "Select Shop"}
                                    </label>
                                    {targetLoading ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading...
                                        </div>
                                    ) : targetOptions.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-2">
                                            {userRole === "shop_owner"
                                                ? "No connected warehouses found"
                                                : "No shops found in your order history"}
                                        </p>
                                    ) : (
                                        <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
                                            <SelectTrigger className="text-sm">
                                                <SelectValue placeholder={
                                                    userRole === "shop_owner"
                                                        ? "Choose a warehouse..."
                                                        : "Choose a shop..."
                                                } />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {targetOptions.map((opt) => (
                                                    <SelectItem key={opt.id} value={opt.id}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">Category</label>
                                    <Select value={newCategory} onValueChange={setNewCategory}>
                                        <SelectTrigger className="text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="order">Order Issue</SelectItem>
                                            <SelectItem value="payment">Payment Issue</SelectItem>
                                            <SelectItem value="delivery">Delivery Issue</SelectItem>
                                            <SelectItem value="account">Account Issue</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block">Priority</label>
                                    <Select value={newPriority} onValueChange={setNewPriority}>
                                        <SelectTrigger className="text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Message</label>
                                <Textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Describe your issue in detail..."
                                    className="min-h-[120px]"
                                />
                            </div>
                            {/* File Attachments */}
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Attachments</label>
                                {attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {attachments.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-xs"
                                            >
                                                {file.fileType.startsWith("image/") ? (
                                                    <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                ) : (
                                                    <FileText className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                                )}
                                                <span className="max-w-[120px] truncate">{file.fileName}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {attachments.length < 5 && (
                                    <div
                                        className={cn(
                                            "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer hover:border-gray-400",
                                            uploading ? "border-blue-300 bg-blue-50/50" : "border-gray-200",
                                        )}
                                        onClick={() => {
                                            const input = document.createElement("input");
                                            input.type = "file";
                                            input.accept = "image/*,.pdf,.doc,.docx,.txt";
                                            input.multiple = true;
                                            input.onchange = async (e) => {
                                                const files = Array.from((e.target as HTMLInputElement).files || []);
                                                if (files.length === 0) return;
                                                const remaining = 5 - attachments.length;
                                                const toUpload = files.slice(0, remaining);
                                                setUploading(true);
                                                try {
                                                    for (const file of toUpload) {
                                                        if (file.size > 10 * 1024 * 1024) {
                                                            toast.error(`${file.name} is too large (max 10MB)`);
                                                            continue;
                                                        }
                                                        const dataUrl = await fileToDataUrl(file);
                                                        const result = await client.cloudinary.upload({
                                                            file: dataUrl,
                                                            folder: "support-attachments",
                                                        });
                                                        if (result.success) {
                                                            setAttachments((prev) => [
                                                                ...prev,
                                                                {
                                                                    url: result.url,
                                                                    fileName: file.name,
                                                                    fileType: file.type,
                                                                    preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
                                                                },
                                                            ]);
                                                        } else {
                                                            toast.error(`Failed to upload ${file.name}`);
                                                        }
                                                    }
                                                } catch {
                                                    toast.error("Upload failed");
                                                } finally {
                                                    setUploading(false);
                                                }
                                            };
                                            input.click();
                                        }}
                                    >
                                        {uploading ? (
                                            <div className="flex items-center justify-center gap-2 text-blue-600 text-sm">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Uploading...
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1">
                                                <Paperclip className="h-5 w-5 text-gray-400" />
                                                <span className="text-xs text-gray-500">
                                                    Click to attach files (images, PDF, docs)
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    Max 5 files, 10MB each
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreate} disabled={creating}>
                                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Submit Ticket
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {kpiCards.map((kpi) => (
                    <Card key={kpi.label} className="border-0 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-4 px-4">
                            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                {kpi.label}
                            </CardTitle>
                            <div className={cn("p-1.5 rounded-md", kpi.bgAccent)}>
                                <kpi.icon className={cn("h-3.5 w-3.5", kpi.iconColor)} />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold">
                                {loading ? "—" : kpi.value}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="w-[140px] h-9 text-xs">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Ticket List */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            ) : tickets.length === 0 ? (
                <Card className="border-0 shadow-sm">
                    <CardContent className="py-16 text-center">
                        <div className="p-3 rounded-full bg-gray-100 w-fit mx-auto mb-3">
                            <Headphones className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="font-medium text-gray-700">No support tickets</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                            {statusFilter !== "all"
                                ? "No tickets match this filter"
                                : "Create a ticket if you need assistance"}
                        </p>
                        {statusFilter === "all" && (
                            <Button size="sm" className="mt-4" onClick={() => setDialogOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Ticket
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {tickets.map((ticket) => {
                        const status = getStatusStyle(ticket.status);
                        const priority = getPriorityStyle(ticket.priority);

                        return (
                            <Card
                                key={ticket.id}
                                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => onOpenTicket(ticket.id)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1.5 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-semibold text-gray-500">
                                                    {ticket.ticketNumber}
                                                </span>
                                                <Badge className={cn(status.bg, status.color, "border-0 text-[10px] font-semibold px-2 py-0.5")}>
                                                    <span className={cn("h-1.5 w-1.5 rounded-full mr-1", status.dot)} />
                                                    {status.label}
                                                </Badge>
                                                <Badge className={cn(priority.bg, priority.color, "border-0 text-[10px] font-semibold capitalize px-2 py-0.5")}>
                                                    {ticket.priority}
                                                </Badge>
                                                {ticket.currentLevel === "level_2" && (
                                                    <Badge className="bg-orange-100 text-orange-700 border-0 text-[10px] font-semibold px-2 py-0.5">
                                                        <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                                                        Escalated to Admin
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="font-medium text-sm text-gray-900">
                                                {ticket.subject}
                                            </p>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span>{getCategoryLabel(ticket.category)}</span>
                                                <span>•</span>
                                                <span>{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</span>
                                            </div>
                                        </div>
                                        <MessageSquare className="h-4 w-4 text-gray-300 shrink-0 mt-1" />
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                            >
                                Previous
                            </Button>
                            <span className="text-xs text-gray-500">
                                Page {page} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Ticket Detail View ──────────────────────────────────────────────────────

function TicketDetailView({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [replyMsg, setReplyMsg] = useState("");
    const [sending, setSending] = useState(false);

    const fetchTicket = useCallback(async () => {
        setLoading(true);
        try {
            const result = await client.userTicket.getById({ id: ticketId });
            setTicket(result as unknown as TicketDetail);
        } catch {
            toast.error("Failed to load ticket");
            onBack();
        } finally {
            setLoading(false);
        }
    }, [ticketId, onBack]);

    useEffect(() => {
        fetchTicket();
    }, [fetchTicket]);

    const handleReply = async () => {
        if (!replyMsg.trim() || replyMsg.length < 5) {
            toast.error("Reply must be at least 5 characters");
            return;
        }
        setSending(true);
        try {
            await client.userTicket.reply({ ticketId, message: replyMsg });
            toast.success("Reply sent");
            setReplyMsg("");
            fetchTicket();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to send reply");
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!ticket) return null;

    const status = getStatusStyle(ticket.status);
    const priority = getPriorityStyle(ticket.priority);
    const canReply = ticket.status !== "closed";

    const STATUS_STEPS = ["open", "in_progress", "resolved", "closed"] as const;
    const STATUS_LABELS: Record<string, string> = {
        open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed",
    };
    const currentStepIndex = STATUS_STEPS.indexOf(ticket.status as typeof STATUS_STEPS[number]);

    return (
        <div className="space-y-5">
            {/* Back button */}
            <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-xs">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back to Tickets
            </Button>

            {/* Ticket Header */}
            <Card className="border-0 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-slate-800 to-slate-600 p-5 text-white">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
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
                    <div className="mt-5 flex items-center gap-0">
                        {STATUS_STEPS.map((step, idx) => {
                            const isActive = idx <= currentStepIndex;
                            const isCurrent = idx === currentStepIndex;
                            return (
                                <div key={step} className="flex items-center flex-1 last:flex-none">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={cn(
                                                "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                                                isCurrent
                                                    ? "bg-white text-slate-900 ring-2 ring-white/30 ring-offset-1 ring-offset-slate-700"
                                                    : isActive
                                                        ? "bg-white/70 text-slate-900"
                                                        : "bg-white/15 text-white/40",
                                            )}
                                        >
                                            {isActive && idx < currentStepIndex ? <Check className="h-3 w-3" /> : idx + 1}
                                        </div>
                                        <span className={cn("text-[9px] mt-1 font-medium", isCurrent ? "text-white" : isActive ? "text-white/60" : "text-white/25")}>
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

            {/* Handler & Escalation Info */}
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

            {/* Original Message */}
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-gray-500" />
                        </div>
                        <span className="font-semibold text-sm">You</span>
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
                            {ticket.attachments.map((att) => {
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
                    {ticket.replies.map((reply) => (
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
                                        {reply.isStaffReply ? "Support Team" : "You"}
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
                            <Button onClick={handleReply} disabled={sending || !replyMsg.trim()} size="sm">
                                {sending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-2 h-3.5 w-3.5" />}
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
