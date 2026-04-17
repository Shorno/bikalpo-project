"use client";

import { format } from "date-fns";
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Download,
    Eye,
    Filter,
    Loader2,
    Search,
    ShieldAlert,
    XCircle,
    ChevronLeft,
    ChevronRight,
    FileWarning,
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
        case "investigating":
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComplaintRow {
    id: number;
    complaintNumber: string;
    orderId: number;
    userId: string;
    userType: string;
    type: string;
    priority: string;
    status: string;
    description: string;
    assignedAdminId: string | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
    orderNumber: string | null;
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
    investigating: number;
    resolved: number;
    closed: number;
    critical: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminComplaintsPage() {
    const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 15;

    // Filters
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [priorityFilter, setPriorityFilter] = useState("all");
    const [userTypeFilter, setUserTypeFilter] = useState("all");

    // Bulk actions
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [bulkLoading, setBulkLoading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [complaintsResult, statsResult] = await Promise.all([
                client.adminComplaint.getAll({
                    page,
                    limit,
                    search: search || undefined,
                    status: statusFilter !== "all" ? statusFilter : undefined,
                    type: typeFilter !== "all" ? typeFilter : undefined,
                    priority: priorityFilter !== "all" ? priorityFilter : undefined,
                    userType: userTypeFilter !== "all" ? userTypeFilter : undefined,
                }),
                client.adminComplaint.getStats(),
            ]);

            setComplaints((complaintsResult.data?.complaints as ComplaintRow[]) || []);
            setTotalPages(complaintsResult.data?.pagination?.totalPages || 1);
            setTotalCount(complaintsResult.data?.pagination?.totalCount || 0);
            setStats(statsResult.data as Stats);
        } catch {
            toast.error("Failed to load complaints");
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter, typeFilter, priorityFilter, userTypeFilter]);

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
    const allSelected = complaints.length > 0 && selectedIds.length === complaints.length;
    const toggleAll = () => {
        if (allSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(complaints.map((c) => c.id));
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
            await client.adminComplaint.bulkUpdateStatus({
                complaintIds: selectedIds,
                status: "resolved",
            });
            toast.success(`${selectedIds.length} complaints marked as resolved`);
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
            const result = await client.adminComplaint.exportComplaints({
                status: statusFilter !== "all" ? statusFilter : undefined,
                type: typeFilter !== "all" ? typeFilter : undefined,
                priority: priorityFilter !== "all" ? priorityFilter : undefined,
                userType: userTypeFilter !== "all" ? userTypeFilter : undefined,
            });

            const data = result.data;
            if (!data || data.length === 0) {
                toast.error("No complaints to export");
                return;
            }

            // Convert to CSV
            const headers = [
                "Complaint #", "Order #", "Type", "Priority", "Status",
                "User Type", "Customer", "Email", "Phone", "Created", "Resolved",
            ];
            const rows = data.map((c) => [
                c.complaintNumber,
                c.orderNumber || "",
                c.type,
                c.priority,
                c.status,
                c.userType,
                c.customerName || "",
                c.customerEmail || "",
                c.customerPhone || "",
                c.createdAt ? format(new Date(c.createdAt), "yyyy-MM-dd") : "",
                c.resolvedAt ? format(new Date(c.resolvedAt), "yyyy-MM-dd") : "",
            ]);

            const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `complaints-${format(new Date(), "yyyy-MM-dd")}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success("Complaints exported");
        } catch {
            toast.error("Export failed");
        }
    };

    const kpiCards = [
        {
            label: "Total Complaints",
            value: stats?.total || 0,
            icon: FileWarning,
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
            label: "Investigating",
            value: stats?.investigating || 0,
            icon: Eye,
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
            label: "Critical",
            value: stats?.critical || 0,
            icon: ShieldAlert,
            color: "text-red-600",
            iconColor: "text-red-500",
            bgAccent: "bg-red-50",
        },
    ];

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Complaint Management</h1>
                    <p className="text-sm text-muted-foreground">
                        Investigate and resolve customer, retailer &amp; wholesaler complaints.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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
                                placeholder="Search by Complaint ID, Order #, Name, or Phone..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Filter className="h-4 w-4 text-muted-foreground hidden md:block" />
                            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                                <SelectTrigger className="w-[140px] h-9 text-xs">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="investigating">Investigating</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                                <SelectTrigger className="w-[130px] h-9 text-xs">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="delivery">Delivery</SelectItem>
                                    <SelectItem value="payment">Payment</SelectItem>
                                    <SelectItem value="product">Product</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
                                <SelectTrigger className="w-[130px] h-9 text-xs">
                                    <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Priority</SelectItem>
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
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Bulk Actions Bar */}
            {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-sm font-medium text-blue-700">
                        {selectedIds.length} complaint{selectedIds.length > 1 ? "s" : ""} selected
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

            {/* Complaints Table */}
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
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Complaint</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Order</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">User</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Type</TableHead>
                                <TableHead className="text-xs font-semibold uppercase tracking-wider">Priority</TableHead>
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
                                            <span className="text-gray-500 text-sm">Loading complaints...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : complaints.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-48 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-3 rounded-full bg-gray-100">
                                                <FileWarning className="h-6 w-6 text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-700">No complaints found</p>
                                                <p className="text-sm text-gray-500 mt-0.5">
                                                    {search || statusFilter !== "all"
                                                        ? "Try adjusting your filters"
                                                        : "No complaints have been submitted yet"}
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setSearchInput("");
                                                    setStatusFilter("all");
                                                    setTypeFilter("all");
                                                    setPriorityFilter("all");
                                                    setUserTypeFilter("all");
                                                    setPage(1);
                                                }}
                                            >
                                                Reset Filters
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                complaints.map((c) => {
                                    const statusStyle = getStatusColor(c.status);
                                    const priorityStyle = getPriorityColor(c.priority);
                                    const typeStyle = getTypeBadge(c.type);
                                    const userTypeStyle = getUserTypeBadge(c.userType);

                                    return (
                                        <TableRow key={c.id} className="group hover:bg-gray-50/60">
                                            <TableCell className="pl-4">
                                                <Checkbox
                                                    checked={selectedIds.includes(c.id)}
                                                    onCheckedChange={() => toggleOne(c.id)}
                                                    aria-label={`Select ${c.complaintNumber}`}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-xs font-semibold text-gray-900">
                                                        {c.complaintNumber}
                                                    </span>
                                                    <p className="text-xs text-muted-foreground truncate max-w-[180px] mt-0.5">
                                                        {c.description}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-xs text-gray-700">
                                                    {c.orderNumber || `#${c.orderId}`}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {c.customer?.name || "Unknown"}
                                                    </span>
                                                    <Badge
                                                        className={cn(
                                                            userTypeStyle.bg,
                                                            userTypeStyle.color,
                                                            "border-0 text-[9px] font-semibold px-1.5 py-0 w-fit mt-0.5",
                                                        )}
                                                    >
                                                        {userTypeStyle.label}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={cn(
                                                        typeStyle.bg,
                                                        typeStyle.color,
                                                        "border-0 text-[10px] font-semibold px-2 py-0.5",
                                                    )}
                                                >
                                                    {typeStyle.label}
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
                                                        {c.priority}
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
                                                        {c.status}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell>
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
                                                    <Link href={`/dashboard/admin/complaints/${c.id}`}>
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
