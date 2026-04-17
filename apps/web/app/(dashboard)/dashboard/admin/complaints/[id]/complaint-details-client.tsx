"use client";

import { format } from "date-fns";
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle,
    Clock,
    Eye,
    Loader2,
    Mail,
    MessageSquare,
    Phone,
    PhoneCall,
    Send,
    ShieldAlert,
    Store,
    User,
    Wallet,
    XCircle,
    FileText,
    Activity,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { client } from "@/utils/orpc";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Reply {
    id: number;
    complaintId: number;
    userId: string;
    message: string;
    isAdminReply: boolean;
    createdAt: Date;
    user: {
        id: string | null;
        name: string;
        image: string | null;
    };
}

interface ActionLog {
    id: number;
    complaintId: number;
    action: string;
    note: string | null;
    createdAt: Date;
    performedBy: string;
    performerName: string | null;
}

interface ComplaintData {
    id: number;
    complaintNumber: string;
    orderId: number;
    userId: string;
    userType: string;
    type: string;
    priority: string;
    status: string;
    description: string;
    userComment: string | null;
    assignedAdminId: string | null;
    delayReason: string | null;
    investigationNotes: string | null;
    resolution: string | null;
    compensationAmount: string | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
    closedAt: Date | null;
    orderNumber: string | null;
    orderStatus: string | null;
    orderTotal: string | null;
    customer: {
        id: string | null;
        name: string | null;
        email: string | null;
        shopName: string | null;
        phoneNumber: string | null;
        role: string | null;
        warehouseName: string | null;
        image: string | null;
    } | null;
    replies: Reply[];
    actionLogs: ActionLog[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusSteps = ["open", "investigating", "resolved", "closed"] as const;
const statusLabels: Record<string, string> = {
    open: "Open",
    investigating: "Investigating",
    resolved: "Resolved",
    closed: "Closed",
};

function getStatusColor(status: string) {
    switch (status) {
        case "open": return "text-amber-600";
        case "investigating": return "text-blue-600";
        case "resolved": return "text-emerald-600";
        case "closed": return "text-gray-500";
        default: return "text-gray-500";
    }
}

function getPriorityBadge(priority: string) {
    switch (priority) {
        case "critical": return { label: "Critical", color: "text-red-800", bg: "bg-red-100" };
        case "high": return { label: "High", color: "text-red-700", bg: "bg-red-50" };
        case "medium": return { label: "Medium", color: "text-orange-700", bg: "bg-orange-50" };
        default: return { label: priority, color: "text-gray-600", bg: "bg-gray-50" };
    }
}

function getTypeBadge(type: string) {
    switch (type) {
        case "delivery": return { label: "Delivery", color: "text-amber-700", bg: "bg-amber-50" };
        case "payment": return { label: "Payment", color: "text-emerald-700", bg: "bg-emerald-50" };
        case "product": return { label: "Product", color: "text-indigo-700", bg: "bg-indigo-50" };
        default: return { label: type, color: "text-gray-600", bg: "bg-gray-50" };
    }
}

function getUserTypeBadge(type: string) {
    switch (type) {
        case "customer": return { label: "Customer", color: "text-violet-700", bg: "bg-violet-50" };
        case "retailer": return { label: "Retailer", color: "text-sky-700", bg: "bg-sky-50" };
        case "wholesaler": return { label: "Wholesaler", color: "text-teal-700", bg: "bg-teal-50" };
        default: return { label: type, color: "text-gray-600", bg: "bg-gray-50" };
    }
}

const formatPrice = (price: string | number | null) => {
    if (!price) return "—";
    return new Intl.NumberFormat("en-BD", {
        style: "currency",
        currency: "BDT",
        minimumFractionDigits: 0,
    }).format(Number(price));
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ComplaintDetailsClient({ complaint: initialComplaint }: { complaint: ComplaintData }) {
    const router = useRouter();
    const [complaint, setComplaint] = useState(initialComplaint);
    const [replyMessage, setReplyMessage] = useState("");
    const [replyLoading, setReplyLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const [priorityLoading, setPriorityLoading] = useState(false);

    // Investigation fields
    const [delayReason, setDelayReason] = useState(complaint.delayReason || "");
    const [investigationNotes, setInvestigationNotes] = useState(complaint.investigationNotes || "");
    const [investigationLoading, setInvestigationLoading] = useState(false);

    // Resolve dialog
    const [resolveOpen, setResolveOpen] = useState(false);
    const [resolution, setResolution] = useState("");
    const [compensationAmount, setCompensationAmount] = useState("");
    const [resolveLoading, setResolveLoading] = useState(false);

    // Action log
    const [actionLoading, setActionLoading] = useState(false);

    const currentStepIndex = statusSteps.indexOf(complaint.status as typeof statusSteps[number]);
    const priorityStyle = getPriorityBadge(complaint.priority);
    const typeStyle = getTypeBadge(complaint.type);
    const userTypeStyle = getUserTypeBadge(complaint.userType);

    // ─── Refetch complaint ────────────────────────────────────────────────────

    const refetchComplaint = async () => {
        try {
            const result = await client.adminComplaint.getById({ id: complaint.id });
            if (result.data) {
                setComplaint(result.data as unknown as ComplaintData);
            }
        } catch {
            /* silently fail */
        }
    };

    // ─── Action Handlers ──────────────────────────────────────────────────────

    const handleStatusChange = async (newStatus: string) => {
        setStatusLoading(true);
        try {
            await client.adminComplaint.updateStatus({
                complaintId: complaint.id,
                status: newStatus as "open" | "investigating" | "resolved" | "closed",
            });
            toast.success(`Status changed to ${statusLabels[newStatus]}`);
            await refetchComplaint();
        } catch {
            toast.error("Failed to update status");
        } finally {
            setStatusLoading(false);
        }
    };

    const handlePriorityChange = async (newPriority: string) => {
        setPriorityLoading(true);
        try {
            await client.adminComplaint.updatePriority({
                complaintId: complaint.id,
                priority: newPriority as "medium" | "high" | "critical",
            });
            toast.success(`Priority changed to ${newPriority}`);
            await refetchComplaint();
        } catch {
            toast.error("Failed to update priority");
        } finally {
            setPriorityLoading(false);
        }
    };

    const handleAddReply = async () => {
        if (!replyMessage.trim()) return;
        setReplyLoading(true);
        try {
            await client.adminComplaint.addReply({
                complaintId: complaint.id,
                message: replyMessage,
            });
            toast.success("Reply sent");
            setReplyMessage("");
            await refetchComplaint();
        } catch {
            toast.error("Failed to send reply");
        } finally {
            setReplyLoading(false);
        }
    };

    const handleSaveInvestigation = async () => {
        setInvestigationLoading(true);
        try {
            await client.adminComplaint.addInvestigationNote({
                complaintId: complaint.id,
                delayReason: delayReason || undefined,
                investigationNotes: investigationNotes || undefined,
            });
            toast.success("Investigation notes saved");
            await refetchComplaint();
        } catch {
            toast.error("Failed to save notes");
        } finally {
            setInvestigationLoading(false);
        }
    };

    const handleLogAction = async (action: string, note?: string) => {
        setActionLoading(true);
        try {
            await client.adminComplaint.addActionLog({
                complaintId: complaint.id,
                action,
                note: note || undefined,
            });
            toast.success(`Action logged: ${action}`);
            await refetchComplaint();
        } catch {
            toast.error("Failed to log action");
        } finally {
            setActionLoading(false);
        }
    };

    const handleResolve = async () => {
        if (resolution.length < 10) {
            toast.error("Resolution must be at least 10 characters");
            return;
        }
        setResolveLoading(true);
        try {
            await client.adminComplaint.resolve({
                complaintId: complaint.id,
                resolution,
                compensationAmount: compensationAmount || undefined,
            });
            toast.success("Complaint resolved");
            setResolveOpen(false);
            await refetchComplaint();
        } catch {
            toast.error("Failed to resolve complaint");
        } finally {
            setResolveLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Back + Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight">{complaint.complaintNumber}</h1>
                        <Badge className={cn(priorityStyle.bg, priorityStyle.color, "border-0 text-xs font-semibold px-2 py-0.5")}>
                            {priorityStyle.label}
                        </Badge>
                        <Badge className={cn(typeStyle.bg, typeStyle.color, "border-0 text-xs font-semibold px-2 py-0.5")}>
                            {typeStyle.label}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Filed {format(new Date(complaint.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        {complaint.orderNumber && (
                            <> · Order <Link href={`/dashboard/admin/orders`} className="text-blue-600 hover:underline">{complaint.orderNumber}</Link></>
                        )}
                    </p>
                </div>
            </div>

            {/* Status Stepper */}
            <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        {statusSteps.map((step, i) => {
                            const isCompleted = i <= currentStepIndex;
                            const isCurrent = step === complaint.status;
                            return (
                                <div key={step} className="flex items-center flex-1">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                                                isCurrent
                                                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                                                    : isCompleted
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-gray-100 text-gray-400",
                                            )}
                                        >
                                            {isCompleted && !isCurrent ? (
                                                <CheckCircle className="h-4 w-4" />
                                            ) : (
                                                i + 1
                                            )}
                                        </div>
                                        <span
                                            className={cn(
                                                "text-[10px] font-medium mt-1 uppercase tracking-wider",
                                                isCurrent ? "text-blue-600" : isCompleted ? "text-emerald-600" : "text-gray-400",
                                            )}
                                        >
                                            {statusLabels[step]}
                                        </span>
                                    </div>
                                    {i < statusSteps.length - 1 && (
                                        <div
                                            className={cn(
                                                "flex-1 h-0.5 mx-2",
                                                i < currentStepIndex ? "bg-emerald-300" : "bg-gray-200",
                                            )}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Main Content: 2-column */}
            <div className="grid gap-6 lg:grid-cols-3">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Issue Description */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Issue Description
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{complaint.description}</p>
                            {complaint.userComment && (
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Additional Comment</p>
                                    <p className="text-sm text-gray-700">{complaint.userComment}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Investigation Panel */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Investigation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Delay Reason</Label>
                                <Textarea
                                    placeholder="Enter the reason for delay (if any)..."
                                    value={delayReason}
                                    onChange={(e) => setDelayReason(e.target.value)}
                                    rows={2}
                                    className="resize-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">Investigation Notes</Label>
                                <Textarea
                                    placeholder="Internal investigation notes..."
                                    value={investigationNotes}
                                    onChange={(e) => setInvestigationNotes(e.target.value)}
                                    rows={3}
                                    className="resize-none"
                                />
                            </div>
                            <Button
                                size="sm"
                                onClick={handleSaveInvestigation}
                                disabled={investigationLoading}
                            >
                                {investigationLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                                Save Notes
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Communication Thread */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                <MessageSquare className="h-4 w-4" />
                                Communication ({complaint.replies.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {complaint.replies.length === 0 ? (
                                <div className="text-center py-6">
                                    <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">No replies yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 thin-scrollbar">
                                    {complaint.replies.map((reply) => (
                                        <div
                                            key={reply.id}
                                            className={cn(
                                                "p-3 rounded-lg",
                                                reply.isAdminReply
                                                    ? "bg-blue-50 border border-blue-100 ml-4"
                                                    : "bg-gray-50 border border-gray-100 mr-4",
                                            )}
                                        >
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <div
                                                    className={cn(
                                                        "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                                                        reply.isAdminReply
                                                            ? "bg-blue-200 text-blue-800"
                                                            : "bg-gray-200 text-gray-700",
                                                    )}
                                                >
                                                    {reply.user.name?.[0]?.toUpperCase() || "?"}
                                                </div>
                                                <span className="text-xs font-semibold text-gray-800">
                                                    {reply.user.name}
                                                </span>
                                                {reply.isAdminReply && (
                                                    <Badge className="bg-blue-100 text-blue-700 border-0 text-[9px] px-1.5 py-0">
                                                        Admin
                                                    </Badge>
                                                )}
                                                <span className="text-[10px] text-gray-400 ml-auto">
                                                    {format(new Date(reply.createdAt), "dd MMM, h:mm a")}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700 leading-relaxed">{reply.message}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Reply Form */}
                            {complaint.status !== "closed" && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <div className="flex gap-2">
                                        <Textarea
                                            placeholder="Type your reply..."
                                            value={replyMessage}
                                            onChange={(e) => setReplyMessage(e.target.value)}
                                            rows={2}
                                            className="resize-none flex-1"
                                        />
                                        <Button
                                            size="icon"
                                            className="shrink-0 h-auto"
                                            onClick={handleAddReply}
                                            disabled={replyLoading || !replyMessage.trim()}
                                        >
                                            {replyLoading ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Send className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    {/* Customer Info */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Customer Info
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                                    <User className="h-5 w-5 text-gray-500" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                        {complaint.customer?.name || "Unknown"}
                                    </p>
                                    <Badge className={cn(userTypeStyle.bg, userTypeStyle.color, "border-0 text-[9px] font-semibold px-1.5 py-0")}>
                                        {userTypeStyle.label}
                                    </Badge>
                                </div>
                            </div>
                            <Separator />
                            <div className="space-y-2 text-sm">
                                {complaint.customer?.email && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Mail className="h-3.5 w-3.5 text-gray-400" />
                                        {complaint.customer.email}
                                    </div>
                                )}
                                {complaint.customer?.phoneNumber && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                                        {complaint.customer.phoneNumber}
                                    </div>
                                )}
                                {complaint.customer?.shopName && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Store className="h-3.5 w-3.5 text-gray-400" />
                                        {complaint.customer.shopName}
                                    </div>
                                )}
                                {complaint.customer?.warehouseName && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Store className="h-3.5 w-3.5 text-gray-400" />
                                        {complaint.customer.warehouseName}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Complaint Details */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Complaint Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Status</p>
                                    <Select
                                        value={complaint.status}
                                        onValueChange={handleStatusChange}
                                        disabled={statusLoading}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="open">Open</SelectItem>
                                            <SelectItem value="investigating">Investigating</SelectItem>
                                            <SelectItem value="resolved">Resolved</SelectItem>
                                            <SelectItem value="closed">Closed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-0.5">Priority</p>
                                    <Select
                                        value={complaint.priority}
                                        onValueChange={handlePriorityChange}
                                        disabled={priorityLoading}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="critical">Critical</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Separator />
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Order</span>
                                    <span className="font-medium text-gray-900">{complaint.orderNumber || `#${complaint.orderId}`}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Order Status</span>
                                    <span className="font-medium text-gray-900 capitalize">{complaint.orderStatus?.replace("_", " ") || "—"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Order Total</span>
                                    <span className="font-medium text-gray-900">{formatPrice(complaint.orderTotal)}</span>
                                </div>
                            </div>
                            <Separator />
                            <div className="space-y-2 text-xs text-gray-500">
                                <div className="flex justify-between">
                                    <span>Created</span>
                                    <span>{format(new Date(complaint.createdAt), "dd MMM, yyyy h:mm a")}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Updated</span>
                                    <span>{format(new Date(complaint.updatedAt), "dd MMM, yyyy h:mm a")}</span>
                                </div>
                                {complaint.resolvedAt && (
                                    <div className="flex justify-between">
                                        <span>Resolved</span>
                                        <span>{format(new Date(complaint.resolvedAt), "dd MMM, yyyy h:mm a")}</span>
                                    </div>
                                )}
                                {complaint.closedAt && (
                                    <div className="flex justify-between">
                                        <span>Closed</span>
                                        <span>{format(new Date(complaint.closedAt), "dd MMM, yyyy h:mm a")}</span>
                                    </div>
                                )}
                            </div>

                            {/* Resolution info if resolved */}
                            {complaint.resolution && (
                                <>
                                    <Separator />
                                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                        <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1">Resolution</p>
                                        <p className="text-sm text-emerald-700">{complaint.resolution}</p>
                                        {complaint.compensationAmount && (
                                            <p className="text-sm text-emerald-700 font-semibold mt-1">
                                                Compensation: {formatPrice(complaint.compensationAmount)}
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Resolution Actions */}
                    {complaint.status !== "closed" && (
                        <Card className="border-0 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Resolution Actions
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start gap-2 h-9 text-xs"
                                    onClick={() => handleLogAction("Delivery partner contacted")}
                                    disabled={actionLoading}
                                >
                                    <PhoneCall className="h-3.5 w-3.5 text-blue-500" />
                                    Contact Delivery Partner
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start gap-2 h-9 text-xs"
                                    onClick={() => handleLogAction("Retailer notified")}
                                    disabled={actionLoading}
                                >
                                    <Store className="h-3.5 w-3.5 text-purple-500" />
                                    Notify Retailer
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start gap-2 h-9 text-xs"
                                    onClick={() => handleLogAction("Customer informed")}
                                    disabled={actionLoading}
                                >
                                    <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                                    Inform Customer
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start gap-2 h-9 text-xs"
                                    onClick={() => handleLogAction("Compensation offered")}
                                    disabled={actionLoading}
                                >
                                    <Wallet className="h-3.5 w-3.5 text-amber-500" />
                                    Compensation Offer
                                </Button>
                                <Separator />
                                <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            size="sm"
                                            className="w-full gap-2 h-9 bg-emerald-600 hover:bg-emerald-700"
                                        >
                                            <CheckCircle className="h-3.5 w-3.5" />
                                            Mark as Resolved
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[480px]">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2">
                                                <CheckCircle className="h-5 w-5 text-emerald-500" />
                                                Resolve Complaint
                                            </DialogTitle>
                                            <DialogDescription>
                                                Provide a resolution summary for {complaint.complaintNumber}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-2">
                                            <div className="space-y-2">
                                                <Label className="text-sm font-medium">
                                                    Resolution Summary <span className="text-red-500">*</span>
                                                </Label>
                                                <Textarea
                                                    placeholder="Describe how the issue was resolved..."
                                                    value={resolution}
                                                    onChange={(e) => setResolution(e.target.value)}
                                                    rows={4}
                                                    className="resize-none"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    Minimum 10 characters
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-sm font-medium">
                                                    Compensation Amount (optional)
                                                </Label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">৳</span>
                                                    <Input
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={compensationAmount}
                                                        onChange={(e) => setCompensationAmount(e.target.value)}
                                                        className="pl-7"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setResolveOpen(false)} disabled={resolveLoading}>
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleResolve}
                                                disabled={resolveLoading || resolution.length < 10}
                                                className="bg-emerald-600 hover:bg-emerald-700"
                                            >
                                                {resolveLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Resolve
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardContent>
                        </Card>
                    )}

                    {/* Action Log Timeline */}
                    <Card className="border-0 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                <Activity className="h-3.5 w-3.5" />
                                Action Log ({complaint.actionLogs.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {complaint.actionLogs.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">No actions logged yet</p>
                            ) : (
                                <div className="space-y-3 max-h-[300px] overflow-y-auto thin-scrollbar">
                                    {complaint.actionLogs.map((log) => (
                                        <div key={log.id} className="flex gap-3">
                                            <div className="flex flex-col items-center">
                                                <div className="h-2 w-2 rounded-full bg-blue-400 mt-1.5" />
                                                <div className="w-px flex-1 bg-gray-200" />
                                            </div>
                                            <div className="pb-3">
                                                <p className="text-sm font-medium text-gray-800">{log.action}</p>
                                                {log.note && (
                                                    <p className="text-xs text-gray-500 mt-0.5">{log.note}</p>
                                                )}
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    {log.performerName || "Admin"} · {format(new Date(log.createdAt), "dd MMM, h:mm a")}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
