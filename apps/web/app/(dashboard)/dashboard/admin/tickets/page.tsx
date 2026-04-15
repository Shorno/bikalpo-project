"use client";

import { format } from "date-fns";
import {
    AlertTriangle,
    ArrowUpRight,
    CheckCircle,
    Clock,
    Download,
    Filter,
    Loader2,
    MessageSquare,
    Search,
    ShieldAlert,
    Ticket,
    XCircle,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import Link from "next/link";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { client } from "@/utils/orpc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusColor(status: string) {
    switch (status) {
        case "open":
            return { color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500" };
        case "in_progress":
            return { color: "text-blue-700", bg: "bg-blue-50", dot: "bg-blue-500" };
        case "resolved":
            return { color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500" };
        case "closed":
            return { color: "text-gray-600", bg: "bg-gray-100", dot: "bg-gray-400" };
        default:
            return { color: "text-gray-600", bg: "bg-gray-50", dot: "bg-gray-400" };
    }
}

function getPriorityColor(priority: string) {
    switch (priority) {
        case "critical":
            return { color: "text-red-800", bg: "bg-red-100", dot: "bg-red-600" };
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

function getUserTypeBadge(type: string) {
    switch (type) {
        case "customer":
            return { label: "Customer", color: "text-violet-700", bg: "bg-violet-50" };
        case "retailer":
            return { label: "Retailer", color: "text-sky-700", bg: "bg-sky-50" };
        case "wholesaler":
            return { label: "Wholesaler", color: "text-teal-700", bg: "bg-teal-50" };
        default:
            return { label: type, color: "text-gray-600", bg: "bg-gray-50" };
    }
}

function getCategoryBadge(category: string) {
    switch (category) {
        case "order":
            return { label: "Order", color: "text-indigo-700", bg: "bg-indigo-50" };
        case "payment":
            return { label: "Payment", color: "text-emerald-700", bg: "bg-emerald-50" };
        case "delivery":
            return { label: "Delivery", color: "text-amber-700", bg: "bg-amber-50" };
        case "account":
            return { label: "Account", color: "text-rose-700", bg: "bg-rose-50" };
        default:
            return { label: "Other", color: "text-gray-600", bg: "bg-gray-50" };
    }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface TicketRow {
    id: number;
    ticketNumber: string;
    subject: string;
    status: string;
    priority: string;
    category: string;
    userType: string;
    currentLevel?: string;
    autoEscalated?: boolean | null;
    escalatedAt?: string | null;
    createdAt: Date;
    customer: {
        id: string | null;
        name: string | null;
        email: string | null;
        shopName: string | null;
        phoneNumber: string | null;
    } | null;
}

interface Stats {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    critical: number;
    escalated: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminTicketsPage() {
    const [tickets, setTickets] = useState<TicketRow[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 15;

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [userTypeFilter, setUserTypeFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [ticketScope, setTicketScope] = useState<"all" | "direct" | "escalated">("all");

    // Bulk actions
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [bulkLoading, setBulkLoading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [ticketsResult, statsResult] = await Promise.all([
                client.adminTicket.getAll({
                    page,
                    limit,
                    search: search || undefined,
                    status: statusFilter !== "all" ? statusFilter : undefined,
                    priority: priorityFilter !== "all" ? priorityFilter : undefined,
                    userType: userTypeFilter !== "all" ? userTypeFilter : undefined,
                    category: categoryFilter !== "all" ? categoryFilter : undefined,
                    ticketScope,
                }),
                client.adminTicket.getStats(),
            ]);

            setTickets((ticketsResult.data?.tickets as TicketRow[]) || []);
            setTotalPages(ticketsResult.data?.pagination?.totalPages || 1);
            setTotalCount(ticketsResult.data?.pagination?.totalCount || 0);
            setStats(statsResult.data as Stats);
        } catch {
            toast.error("Failed to load tickets");
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter, priorityFilter, userTypeFilter, categoryFilter, ticketScope]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Debounced search
    const [searchInput, setSearchInput] = useState("");
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Selection helpers
    const allSelected = tickets.length > 0 && selectedIds.length === tickets.length;
    const toggleAll = () => {
        if (allSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(tickets.map((t) => t.id));
        }
    };
    const toggleOne = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    // Bulk action handlers
    const handleBulkResolve = async () => {
        if (selectedIds.length === 0) return;
        setBulkLoading(true);
        try {
            await client.adminTicket.bulkUpdateStatus({
                ticketIds: selectedIds,
                status: "resolved",
            });
            toast.success(`${selectedIds.length} tickets marked as resolved`);
            setSelectedIds([]);
            fetchData();
        } catch {
            toast.error("Bulk update failed");
        } finally {
            setBulkLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const result = await client.adminTicket.exportTickets({
                status: statusFilter !== "all" ? statusFilter : undefined,
                priority: priorityFilter !== "all" ? priorityFilter : undefined,
                userType: userTypeFilter !== "all" ? userTypeFilter : undefined,
                category: categoryFilter !== "all" ? categoryFilter : undefined,
            });

            const data = result.data;
            if (!data || data.length === 0) {
                toast.error("No tickets to export");
                return;
            }

            // Convert to CSV
            const headers = [
                "Ticket #", "Subject", "Status", "Priority", "Category",
                "User Type", "Customer", "Email", "Phone", "Created",
            ];
            const rows = data.map((t) => [
                t.ticketNumber,
                `"${(t.subject || "").replace(/"/g, '""')}"`,
                t.status,
                t.priority,
                t.category,
                t.userType,
                t.customerName || "",
                t.customerEmail || "",
                t.customerPhone || "",
                t.createdAt ? format(new Date(t.createdAt), "yyyy-MM-dd") : "",
            ]);

            const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `support-tickets-${format(new Date(), "yyyy-MM-dd")}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Tickets exported");
        } catch {
            toast.error("Export failed");
        }
    };

    const kpiCards = [
        {
            label: "Total Tickets",
            value: stats?.total || 0,
            icon: Ticket,
            color: "text-gray-900",
            iconColor: "text-gray-500",
            bgAccent: "bg-gray-50",
        },
        {
            label: "Open",
            value: stats?.open || 0,
            icon: Clock,
            color: "text-amber-600",
            iconColor: "text-amber-500",
            bgAccent: "bg-amber-50",
        },
        {
            label: "In Progress",
            value: stats?.inProgress || 0,
            icon: Loader2,
            color: "text-blue-600",
            iconColor: "text-blue-500",
            bgAccent: "bg-blue-50",
        },
        {
            label: "Resolved",
            value: stats?.resolved || 0,
            icon: CheckCircle,
            color: "text-emerald-600",
            iconColor: "text-emerald-500",
            bgAccent: "bg-emerald-50",
        },
        {
            label: "Critical Issues",
            value: stats?.critical || 0,
            icon: ShieldAlert,
            color: "text-red-600",
            iconColor: "text-red-500",
            bgAccent: "bg-red-50",
        },
        {
            label: "Escalated",
            value: stats?.escalated || 0,
            icon: ArrowUpRight,
            color: "text-orange-600",
            iconColor: "text-orange-500",
            bgAccent: "bg-orange-50",
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage customer, retailer & wholesaler support tickets.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
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
                            <div className={cn("text-2xl font-bold", kpi.color)}>
                                {loading ? "—" : kpi.value.toLocaleString()}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Search & Filters */}
            <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by Ticket ID, Name, or Phone..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Filter className="h-4 w-4 text-muted-foreground hidden md:block" />
                            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                                <SelectTrigger className="w-[130px] h-9 text-xs">
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
                            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
                                <SelectTrigger className="w-[130px] h-9 text-xs">
                                    <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Priority</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={userTypeFilter} onValueChange={(v) => { setUserTypeFilter(v); setPage(1); }}>
                                <SelectTrigger className="w-[130px] h-9 text-xs">
                                    <SelectValue placeholder="User Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Users</SelectItem>
                                    <SelectItem value="customer">Customer</SelectItem>
                                    <SelectItem value="retailer">Retailer</SelectItem>
                                    <SelectItem value="wholesaler">Wholesaler</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
                                <SelectTrigger className="w-[130px] h-9 text-xs">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Categories</SelectItem>
                                    <SelectItem value="order">Order</SelectItem>
                                    <SelectItem value="payment">Payment</SelectItem>
                                    <SelectItem value="delivery">Delivery</SelectItem>
                                    <SelectItem value="account">Account</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={ticketScope} onValueChange={(v) => { setTicketScope(v as "all" | "direct" | "escalated"); setPage(1); }}>
                                <SelectTrigger className="w-[130px] h-9 text-xs">
                                    <SelectValue placeholder="Scope" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Tickets</SelectItem>
                                    <SelectItem value="direct">Direct</SelectItem>
                                    <SelectItem value="escalated">Escalated</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-sm font-medium text-blue-700">
                        {selectedIds.length} ticket{selectedIds.length > 1 ? "s" : ""} selected
                    </span>
                    <div className="flex items-center gap-2 ml-auto">
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={handleBulkResolve}
                            disabled={bulkLoading}
                        >
                            {bulkLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle className="mr-1 h-3 w-3" />}
                            Mark Resolved
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setSelectedIds([])}
                        >
                            <XCircle className="mr-1 h-3 w-3" />
                            Clear
                        </Button>
                    </div>
                </div>
            )}

            {/* Tickets Table */}
            <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                                <TableHead className="w-10 pl-4">
                                    <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={toggleAll}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Ticket</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">User</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Type</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Category</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">
                                    <div className="flex items-center gap-1">
                                        Priority
                                        <ArrowUpDown className="h-3 w-3" />
                                    </div>
                                </TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Date</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-right pr-4">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-48 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                            <span className="text-gray-500 text-sm">Loading tickets...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : tickets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-48 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-3 rounded-full bg-gray-100">
                                                <MessageSquare className="h-6 w-6 text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-700">No support tickets</p>
                                                <p className="text-sm text-gray-500 mt-0.5">
                                                    {search || statusFilter !== "all"
                                                        ? "Try adjusting your filters"
                                                        : "No tickets have been submitted yet"}
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSearchInput("");
                                                    setStatusFilter("all");
                                                    setPriorityFilter("all");
                                                    setUserTypeFilter("all");
                                                    setCategoryFilter("all");
                                                    setPage(1);
                                                }}
                                            >
                                                Reset Filters
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                tickets.map((ticket) => {
                                    const statusStyle = getStatusColor(ticket.status);
                                    const priorityStyle = getPriorityColor(ticket.priority);
                                    const userTypeStyle = getUserTypeBadge(ticket.userType);
                                    const categoryStyle = getCategoryBadge(ticket.category);
                                    const isEscalated = ticket.currentLevel === "level_2";

                                    return (
                                        <TableRow key={ticket.id} className="group hover:bg-gray-50/60">
                                            <TableCell className="pl-4">
                                                <Checkbox
                                                    checked={selectedIds.includes(ticket.id)}
                                                    onCheckedChange={() => toggleOne(ticket.id)}
                                                    aria-label={`Select ${ticket.ticketNumber}`}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-semibold text-gray-900">
                                                        {ticket.ticketNumber}
                                                    </span>
                                                    {isEscalated && (
                                                        <Badge className="bg-orange-100 text-orange-700 border-0 text-[9px] px-1.5 py-0">
                                                            <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" />
                                                            {ticket.autoEscalated ? "Auto" : "Manual"}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate max-w-[180px] mt-0.5">
                                                    {ticket.subject}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {ticket.customer?.name || "Unknown"}
                                                    </span>
                                                    {ticket.customer?.shopName && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {ticket.customer.shopName}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={cn(
                                                        userTypeStyle.bg,
                                                        userTypeStyle.color,
                                                        "border-0 text-[10px] font-semibold px-2 py-0.5",
                                                    )}
                                                >
                                                    {userTypeStyle.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={cn(
                                                        categoryStyle.bg,
                                                        categoryStyle.color,
                                                        "border-0 text-[10px] font-semibold px-2 py-0.5",
                                                    )}
                                                >
                                                    {categoryStyle.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={cn("h-2 w-2 rounded-full", priorityStyle.dot)} />
                                                    <Badge
                                                        className={cn(
                                                            priorityStyle.bg,
                                                            priorityStyle.color,
                                                            "border-0 text-[10px] font-semibold capitalize px-2 py-0.5",
                                                        )}
                                                    >
                                                        {ticket.priority}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={cn("h-2 w-2 rounded-full", statusStyle.dot)} />
                                                    <Badge
                                                        className={cn(
                                                            statusStyle.bg,
                                                            statusStyle.color,
                                                            "border-0 text-[10px] font-semibold capitalize px-2 py-0.5",
                                                        )}
                                                    >
                                                        {ticket.status.replace("_", " ")}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(ticket.createdAt), "dd MMM")}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right pr-4">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                    asChild
                                                >
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

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, totalCount)} of{" "}
                        {totalCount} tickets
                    </p>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (page <= 3) {
                                pageNum = i + 1;
                            } else if (page >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                            } else {
                                pageNum = page - 2 + i;
                            }
                            return (
                                <Button
                                    key={pageNum}
                                    variant={page === pageNum ? "default" : "outline"}
                                    size="sm"
                                    className="h-8 w-8 p-0 text-xs"
                                    onClick={() => setPage(pageNum)}
                                >
                                    {pageNum}
                                </Button>
                            );
                        })}
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
