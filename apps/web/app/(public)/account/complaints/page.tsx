"use client";

import { format } from "date-fns";
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Eye,
    FileWarning,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Search,
    XCircle,
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

function getStatusStyle(status: string) {
    switch (status) {
        case "open":
            return { color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500", label: "Open" };
        case "investigating":
            return { color: "text-blue-700", bg: "bg-blue-50", dot: "bg-blue-500", label: "Investigating" };
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
        case "critical":
            return { color: "text-red-800", bg: "bg-red-100", dot: "bg-red-600" };
        case "high":
            return { color: "text-red-700", bg: "bg-red-50", dot: "bg-red-500" };
        case "medium":
            return { color: "text-orange-700", bg: "bg-orange-50", dot: "bg-orange-500" };
        default:
            return { color: "text-gray-600", bg: "bg-gray-50", dot: "bg-gray-400" };
    }
}

function getTypeBadge(type: string) {
    switch (type) {
        case "delivery":
            return { label: "Delivery", color: "text-amber-700", bg: "bg-amber-50" };
        case "payment":
            return { label: "Payment", color: "text-emerald-700", bg: "bg-emerald-50" };
        case "product":
            return { label: "Product", color: "text-indigo-700", bg: "bg-indigo-50" };
        default:
            return { label: type, color: "text-gray-600", bg: "bg-gray-50" };
    }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComplaintRow {
    id: number;
    complaintNumber: string;
    orderId: number;
    type: string;
    priority: string;
    status: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
    orderNumber: string | null;
}

interface Stats {
    total: number;
    open: number;
    investigating: number;
    resolved: number;
    closed: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MyComplaintsPage() {
    const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 10;

    const [statusFilter, setStatusFilter] = useState("all");

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [complaintsResult, statsResult] = await Promise.all([
                client.userComplaint.getMyComplaints({
                    page,
                    limit,
                    status: statusFilter !== "all" ? statusFilter : undefined,
                }),
                client.userComplaint.getMyStats(),
            ]);

            setComplaints((complaintsResult.complaints as ComplaintRow[]) || []);
            setTotalPages(complaintsResult.pagination?.totalPages || 1);
            setTotalCount(complaintsResult.pagination?.totalCount || 0);
            setStats(statsResult as Stats);
        } catch {
            toast.error("Failed to load complaints");
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const statusTabs = [
        { value: "all", label: "All", count: stats?.total },
        { value: "open", label: "Open", count: stats?.open, dotColor: "bg-amber-500" },
        { value: "investigating", label: "Investigating", count: stats?.investigating, dotColor: "bg-blue-500" },
        { value: "resolved", label: "Resolved", count: stats?.resolved, dotColor: "bg-emerald-500" },
        { value: "closed", label: "Closed", count: stats?.closed, dotColor: "bg-gray-400" },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-gray-900">My Complaints</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Track and manage your filed complaints.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total", value: stats?.total || 0, icon: FileWarning, color: "text-gray-900", iconColor: "text-gray-500", bgAccent: "bg-gray-50" },
                    { label: "Open", value: stats?.open || 0, icon: Clock, color: "text-amber-600", iconColor: "text-amber-500", bgAccent: "bg-amber-50" },
                    { label: "Investigating", value: stats?.investigating || 0, icon: Eye, color: "text-blue-600", iconColor: "text-blue-500", bgAccent: "bg-blue-50" },
                    { label: "Resolved", value: stats?.resolved || 0, icon: CheckCircle, color: "text-emerald-600", iconColor: "text-emerald-500", bgAccent: "bg-emerald-50" },
                ].map((kpi) => (
                    <Card key={kpi.label} className="border border-gray-100 shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                            <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                {kpi.label}
                            </CardTitle>
                            <div className={cn("p-1.5 rounded-md", kpi.bgAccent)}>
                                <kpi.icon className={cn("h-3.5 w-3.5", kpi.iconColor)} />
                            </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                            <div className={cn("text-xl font-bold", kpi.color)}>
                                {loading ? "—" : kpi.value}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100 overflow-x-auto">
                {statusTabs.map((tab) => (
                    <button
                        key={tab.value}
                        onClick={() => { setStatusFilter(tab.value); setPage(1); }}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap",
                            statusFilter === tab.value
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700 hover:bg-white/60",
                        )}
                    >
                        {tab.dotColor && (
                            <span className={cn("h-1.5 w-1.5 rounded-full", tab.dotColor)} />
                        )}
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0 rounded-full",
                                statusFilter === tab.value
                                    ? "bg-gray-100 text-gray-700"
                                    : "bg-gray-200/60 text-gray-500",
                            )}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Complaints Table */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                            <TableHead className="text-xs font-semibold uppercase tracking-wider">Complaint</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider">Order</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider hidden sm:table-cell">Type</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider hidden sm:table-cell">Priority</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Date</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wider text-right pr-4">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                        <span className="text-gray-500 text-sm">Loading complaints...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : complaints.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-48 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-3 rounded-full bg-gray-100">
                                            <FileWarning className="h-6 w-6 text-gray-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-700">No complaints found</p>
                                            <p className="text-sm text-gray-500 mt-0.5">
                                                {statusFilter !== "all"
                                                    ? "Try selecting a different status filter"
                                                    : "You haven't filed any complaints yet"}
                                            </p>
                                        </div>
                                        {statusFilter !== "all" && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => { setStatusFilter("all"); setPage(1); }}
                                            >
                                                Show All
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            complaints.map((c) => {
                                const statusS = getStatusStyle(c.status);
                                const priorityS = getPriorityStyle(c.priority);
                                const typeS = getTypeBadge(c.type);

                                return (
                                    <TableRow key={c.id} className="group hover:bg-gray-50/60">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-mono text-xs font-semibold text-gray-900">
                                                    {c.complaintNumber}
                                                </span>
                                                <p className="text-xs text-muted-foreground truncate max-w-[160px] mt-0.5">
                                                    {c.description}
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-mono text-xs text-gray-700">
                                                {c.orderNumber || `#${c.orderId}`}
                                            </span>
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            <Badge
                                                className={cn(
                                                    typeS.bg, typeS.color,
                                                    "border-0 text-[10px] font-semibold px-2 py-0.5",
                                                )}
                                            >
                                                {typeS.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn("h-2 w-2 rounded-full", priorityS.dot)} />
                                                <Badge
                                                    className={cn(
                                                        priorityS.bg, priorityS.color,
                                                        "border-0 text-[10px] font-semibold capitalize px-2 py-0.5",
                                                    )}
                                                >
                                                    {c.priority}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn("h-2 w-2 rounded-full", statusS.dot)} />
                                                <Badge
                                                    className={cn(
                                                        statusS.bg, statusS.color,
                                                        "border-0 text-[10px] font-semibold capitalize px-2 py-0.5",
                                                    )}
                                                >
                                                    {statusS.label}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <span className="text-xs text-muted-foreground">
                                                {format(new Date(c.createdAt), "dd MMM")}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right pr-4">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                asChild
                                            >
                                                <Link href={`/account/complaints/${c.id}`}>
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
            </div>

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, totalCount)} of{" "}
                        {totalCount} complaints
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
