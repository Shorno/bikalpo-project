"use client";

import { format } from "date-fns";
import {
    ArrowLeft,
    CheckCircle,
    Clock,
    Eye,
    FileText,
    Loader2,
    MessageSquare,
    Send,
    ShieldAlert,
    Activity,
    XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { client } from "@/utils/orpc";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Reply {
    id: number;
    complaintId?: number;
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
    action: string;
    note: string | null;
    createdAt: Date;
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
    resolution: string | null;
    compensationAmount: string | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
    closedAt: Date | null;
    orderNumber: string | null;
    orderStatus: string | null;
    orderTotal: string | null;
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

const formatPrice = (price: string | number | null) => {
    if (!price) return "—";
    return new Intl.NumberFormat("en-BD", {
        style: "currency",
        currency: "BDT",
        minimumFractionDigits: 0,
    }).format(Number(price));
};

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function DetailSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9" />
                <div className="space-y-1.5">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
            </div>
            <Skeleton className="h-16 w-full rounded-lg" />
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <Skeleton className="h-64 w-full rounded-lg" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-48 w-full rounded-lg" />
                    <Skeleton className="h-32 w-full rounded-lg" />
                </div>
            </div>
        </div>
    );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MyComplaintDetailPage() {
    const params = useParams();
    const router = useRouter();
    const complaintId = Number(params.id);

    const [complaint, setComplaint] = useState<ComplaintData | null>(null);
    const [loading, setLoading] = useState(true);
    const [replyMessage, setReplyMessage] = useState("");
    const [replyLoading, setReplyLoading] = useState(false);
    const [closeOpen, setCloseOpen] = useState(false);
    const [closeLoading, setCloseLoading] = useState(false);

    const fetchComplaint = useCallback(async () => {
        try {
            const result = await client.userComplaint.getById({ id: complaintId });
            if (result) {
                setComplaint(result as unknown as ComplaintData);
            }
        } catch {
            toast.error("Failed to load complaint");
        } finally {
            setLoading(false);
        }
    }, [complaintId]);

    useEffect(() => {
        if (!Number.isNaN(complaintId)) {
            fetchComplaint();
        }
    }, [complaintId, fetchComplaint]);

    const handleReply = async () => {
        if (!replyMessage.trim() || !complaint) return;
        setReplyLoading(true);
        try {
            await client.userComplaint.reply({
                complaintId: complaint.id,
                message: replyMessage,
            });
            toast.success("Reply sent");
            setReplyMessage("");
            await fetchComplaint();
        } catch {
            toast.error("Failed to send reply");
        } finally {
            setReplyLoading(false);
        }
    };

    const handleClose = async () => {
        if (!complaint) return;
        setCloseLoading(true);
        try {
            await client.userComplaint.close({ complaintId: complaint.id });
            toast.success("Complaint closed");
            setCloseOpen(false);
            await fetchComplaint();
        } catch {
            toast.error("Failed to close complaint");
        } finally {
            setCloseLoading(false);
        }
    };

    if (loading) return <DetailSkeleton />;

    if (!complaint) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-3 rounded-full bg-gray-100 mb-3">
                    <XCircle className="h-6 w-6 text-gray-400" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">Complaint not found</h2>
                <p className="text-sm text-gray-500 mt-1">
                    This complaint may have been removed or doesn&apos;t exist.
                </p>
                <Button asChild className="mt-4" size="sm">
                    <Link href="/warehouse/dashboard/support/complaints">Back to Complaints</Link>
                </Button>
            </div>
        );
    }

    const currentStepIndex = statusSteps.indexOf(complaint.status as typeof statusSteps[number]);
    const priorityStyle = getPriorityBadge(complaint.priority);
    const typeStyle = getTypeBadge(complaint.type);

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-lg font-bold text-gray-900">{complaint.complaintNumber}</h1>
                        <Badge className={cn(priorityStyle.bg, priorityStyle.color, "border-0 text-[10px] font-semibold px-2 py-0")}>
                            {priorityStyle.label}
                        </Badge>
                        <Badge className={cn(typeStyle.bg, typeStyle.color, "border-0 text-[10px] font-semibold px-2 py-0")}>
                            {typeStyle.label}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Filed {format(new Date(complaint.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        {complaint.orderNumber && (
                            <> · Order <span className="text-emerald-600">{complaint.orderNumber}</span></>
                        )}
                    </p>
                </div>
            </div>

            {/* Status Stepper */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                    {statusSteps.map((step, i) => {
                        const isCompleted = i <= currentStepIndex;
                        const isCurrent = step === complaint.status;
                        return (
                            <div key={step} className="flex items-center flex-1">
                                <div className="flex flex-col items-center">
                                    <div
                                        className={cn(
                                            "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors",
                                            isCurrent
                                                ? "bg-emerald-600 text-white ring-4 ring-emerald-100"
                                                : isCompleted
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-gray-100 text-gray-400",
                                        )}
                                    >
                                        {isCompleted && !isCurrent ? (
                                            <CheckCircle className="h-3.5 w-3.5" />
                                        ) : (
                                            i + 1
                                        )}
                                    </div>
                                    <span
                                        className={cn(
                                            "text-[9px] font-medium mt-1 uppercase tracking-wider",
                                            isCurrent ? "text-emerald-600" : isCompleted ? "text-emerald-600" : "text-gray-400",
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
            </div>

            {/* Main Content: 2-column */}
            <div className="grid gap-5 lg:grid-cols-3">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-5">
                    {/* Issue Description */}
                    <Card className="border border-gray-100 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5" />
                                Issue Description
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{complaint.description}</p>
                            {complaint.userComment && (
                                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Additional Comment</p>
                                    <p className="text-sm text-gray-700">{complaint.userComment}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Communication Thread */}
                    <Card className="border border-gray-100 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                <MessageSquare className="h-3.5 w-3.5" />
                                Communication ({complaint.replies.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {complaint.replies.length === 0 ? (
                                <div className="text-center py-8">
                                    <MessageSquare className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">No messages yet</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Start the conversation by sending a message.</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1 thin-scrollbar">
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
                                                        "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold",
                                                        reply.isAdminReply
                                                            ? "bg-blue-200 text-blue-800"
                                                            : "bg-emerald-200 text-emerald-800",
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
                                            placeholder="Type your message..."
                                            value={replyMessage}
                                            onChange={(e) => setReplyMessage(e.target.value)}
                                            rows={2}
                                            className="resize-none flex-1"
                                        />
                                        <Button
                                            size="icon"
                                            className="shrink-0 h-auto bg-emerald-600 hover:bg-emerald-700"
                                            onClick={handleReply}
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

                    {/* Admin Action Log */}
                    {complaint.actionLogs.length > 0 && (
                        <Card className="border border-gray-100 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                    <Activity className="h-3.5 w-3.5" />
                                    Activity Log
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="space-y-3">
                                    {complaint.actionLogs.map((log) => (
                                        <div key={log.id} className="flex items-start gap-3">
                                            <div className="mt-0.5 h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
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
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    {/* Complaint Details */}
                    <Card className="border border-gray-100 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                Complaint Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Order</span>
                                    <span className="font-medium text-emerald-600">
                                        {complaint.orderNumber || `#${complaint.orderId}`}
                                    </span>
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

                            {/* Resolution info */}
                            {complaint.resolution && (
                                <>
                                    <Separator />
                                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                        <p className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide mb-1">Resolution</p>
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

                    {/* Close Complaint Action */}
                    {complaint.status === "resolved" && (
                        <Card className="border border-gray-100 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Actions
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <p className="text-xs text-gray-500 mb-3">
                                    Your complaint has been resolved. If you&apos;re satisfied with the resolution, please close it.
                                </p>
                                <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            size="sm"
                                            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                                        >
                                            <CheckCircle className="h-3.5 w-3.5" />
                                            Close Complaint
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[400px]">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2">
                                                <CheckCircle className="h-5 w-5 text-emerald-500" />
                                                Confirm Close
                                            </DialogTitle>
                                            <DialogDescription>
                                                Are you satisfied with the resolution for {complaint.complaintNumber}? This action cannot be undone.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setCloseOpen(false)} disabled={closeLoading}>
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleClose}
                                                disabled={closeLoading}
                                                className="bg-emerald-600 hover:bg-emerald-700"
                                            >
                                                {closeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Yes, Close
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardContent>
                        </Card>
                    )}

                    {/* Status Info for non-resolved */}
                    {complaint.status === "open" && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                            <div className="flex items-center gap-2 mb-1">
                                <Clock className="h-3.5 w-3.5 text-amber-600" />
                                <p className="text-xs font-semibold text-amber-800">Awaiting Review</p>
                            </div>
                            <p className="text-xs text-amber-700">
                                Our team will review your complaint shortly. You&apos;ll be notified when investigation begins.
                            </p>
                        </div>
                    )}
                    {complaint.status === "investigating" && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="flex items-center gap-2 mb-1">
                                <Eye className="h-3.5 w-3.5 text-blue-600" />
                                <p className="text-xs font-semibold text-blue-800">Under Investigation</p>
                            </div>
                            <p className="text-xs text-blue-700">
                                Our team is actively investigating this issue. You can check the activity log for updates.
                            </p>
                        </div>
                    )}
                    {complaint.status === "closed" && (
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center gap-2 mb-1">
                                <ShieldAlert className="h-3.5 w-3.5 text-gray-500" />
                                <p className="text-xs font-semibold text-gray-700">Complaint Closed</p>
                            </div>
                            <p className="text-xs text-gray-600">
                                This complaint has been closed. If you have further issues, you can file a new complaint from your order page.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
