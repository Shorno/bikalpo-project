"use client";

import { formatDistanceToNow } from "date-fns";
import {
    Check,
    CheckCircle,
    Clock,
    Headphones,
    Loader2,
    ShieldAlert,
    Ticket,
    Timer,
    User,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

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

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * IncomingSupportPanel — Shows tickets assigned to the current user from the level below.
 *
 * - Shop owners see consumer tickets
 * - Warehouse owners see retailer tickets
 *
 * Clicking a ticket navigates to /support/[ticketId]?from=incoming
 */
export function IncomingSupportPanel() {
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const pathname = usePathname();

    // Derive support base path from current pathname
    const supportBasePath = pathname?.replace(/\/$/, "") || "/dashboard/support";

    // ── TanStack Queries ──
    const { data: statsData, isLoading: statsLoading } = useQuery(
        orpc.userTicket.getIncomingStats.queryOptions({ input: {} }),
    );

    const { data: ticketsData, isLoading: listLoading } = useQuery(
        orpc.userTicket.getIncomingTickets.queryOptions({
            input: {
                page: currentPage,
                limit: 10,
                status: statusFilter === "all" ? undefined : statusFilter,
            },
        }),
    );

    const stats = statsData ?? null;
    const tickets = (ticketsData?.tickets ?? []) as any[];
    const pagination = ticketsData?.pagination ?? { page: 1, limit: 10, totalCount: 0, totalPages: 0 };

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
                    {tickets.map((ticket: any) => {
                        const sc = statusConfig[ticket.status] || statusConfig.open;
                        const pc = priorityConfig[ticket.priority] || priorityConfig.medium;
                        const dl = getDeadlineStatus(ticket.escalationDeadline);

                        return (
                            <Link
                                key={ticket.id}
                                href={`${supportBasePath}/${ticket.id}?from=incoming`}
                            >
                                <Card
                                    className={cn(
                                        "cursor-pointer hover:border-slate-300 transition-colors",
                                        dl.isOverdue && "border-red-200 bg-red-50/30",
                                    )}
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
                            </Link>
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
