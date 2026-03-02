"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    ArrowLeft,
    Building2,
    Calendar,
    Check,
    ExternalLink,
    FileText,
    Loader2,
    Mail,
    MapPin,
    Phone,
    Store,
    User,
    X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/utils/orpc";

const statusConfig = {
    pending: {
        label: "Pending Review",
        variant: "outline" as const,
        className: "text-yellow-600 border-yellow-600 bg-yellow-50",
        dotColor: "bg-yellow-500",
    },
    approved: {
        label: "Approved",
        variant: "default" as const,
        className: "bg-green-600 text-white",
        dotColor: "bg-green-500",
    },
    rejected: {
        label: "Rejected",
        variant: "destructive" as const,
        className: "",
        dotColor: "bg-red-500",
    },
};

export default function SellerApplicationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const applicationId = params.id as string;

    console.log(applicationId);

    const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
    const [adminNotes, setAdminNotes] = useState("");

    const { data: application, isLoading, isError, error } = useQuery({
        ...orpc.sellerApplication.getById.queryOptions({
            input: { applicationId },
        }),
    });

    const approveMutation = useMutation({
        mutationFn: (params: { applicationId: string; adminNotes?: string }) =>
            client.sellerApplication.approve(params),
        onSuccess: () => {
            toast.success("Application approved — user upgraded to shop owner");
            queryClient.invalidateQueries();
            setActionType(null);
            setAdminNotes("");
        },
        onError: (error) => {
            toast.error(error.message || "Failed to approve");
        },
    });

    const rejectMutation = useMutation({
        mutationFn: (params: { applicationId: string; adminNotes?: string }) =>
            client.sellerApplication.reject(params),
        onSuccess: () => {
            toast.success("Application rejected");
            queryClient.invalidateQueries();
            setActionType(null);
            setAdminNotes("");
        },
        onError: (error) => {
            toast.error(error.message || "Failed to reject");
        },
    });

    const handleConfirmAction = () => {
        if (!actionType) return;
        const payload = {
            applicationId,
            adminNotes: adminNotes || undefined,
        };
        if (actionType === "approve") {
            approveMutation.mutate(payload);
        } else {
            rejectMutation.mutate(payload);
        }
    };

    const isActionPending = approveMutation.isPending || rejectMutation.isPending;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (isError || !application) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <FileText className="size-12 text-muted-foreground" />
                <p className="text-lg text-muted-foreground">
                    {isError ? `Error: ${error?.message || "Failed to load application"}` : "Application not found"}
                </p>
                <Button asChild variant="outline">
                    <Link href="/dashboard/admin/seller-applications">
                        <ArrowLeft className="mr-2 size-4" />
                        Back to Applications
                    </Link>
                </Button>
            </div>
        );
    }

    const status = application.status as keyof typeof statusConfig;
    const config = statusConfig[status];
    const documents = (application.documents as string[]) || [];
    const isPending = application.status === "pending";

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push("/dashboard/admin/seller-applications")}
                    >
                        <ArrowLeft className="size-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight">
                                {application.shopName}
                            </h1>
                            <Badge variant={config.variant} className={config.className}>
                                {config.label}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Submitted {format(new Date(application.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                        </p>
                    </div>
                </div>

                {isPending && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                            onClick={() => setActionType("approve")}
                        >
                            <Check className="size-4 mr-2" />
                            Approve
                        </Button>
                        <Button
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => setActionType("reject")}
                        >
                            <X className="size-4 mr-2" />
                            Reject
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Left Column — Main Details */}
                <div className="md:col-span-2 flex flex-col gap-6">
                    {/* Business Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Store className="size-4" />
                                Business Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-sm text-muted-foreground">Shop Name</p>
                                    <p className="font-medium">{application.shopName}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Owner Name</p>
                                    <p className="font-medium">{application.ownerName}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Business Type</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {application.businessType === "retail" ? (
                                            <Store className="size-4 text-blue-500" />
                                        ) : (
                                            <Building2 className="size-4 text-orange-500" />
                                        )}
                                        <span className="capitalize font-medium">
                                            {application.businessType}
                                        </span>
                                        {application.businessType === "retail" ? (
                                            <Badge variant="secondary" className="text-xs">
                                                Can sell B2C
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-xs">
                                                Buyer only
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Trade License</p>
                                    <p className="font-medium">
                                        {application.tradeLicenseNumber || "Not provided"}
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <MapPin className="size-4 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">Shop Address</p>
                                </div>
                                <p className="font-medium">{application.shopAddress}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Documents */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <FileText className="size-4" />
                                Uploaded Documents
                                {documents.length > 0 && (
                                    <Badge variant="secondary" className="ml-auto">
                                        {documents.length} file{documents.length > 1 ? "s" : ""}
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {documents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/30">
                                    <FileText className="size-8 text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                        No documents uploaded
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {documents.map((doc, index) => (
                                        <div
                                            key={index}
                                            className="group relative overflow-hidden rounded-lg border bg-muted/30"
                                        >
                                            <div className="relative aspect-[4/3]">
                                                <Image
                                                    src={doc}
                                                    alt={`Document ${index + 1}`}
                                                    fill
                                                    className="object-cover"
                                                    sizes="(max-width: 768px) 50vw, 33vw"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                                <a
                                                    href={doc}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1.5 shadow-sm"
                                                >
                                                    <ExternalLink className="size-3.5" />
                                                </a>
                                            </div>
                                            <div className="px-3 py-2">
                                                <p className="text-xs text-muted-foreground">
                                                    Document {index + 1}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Admin Review (if reviewed) */}
                    {application.reviewedAt && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Check className="size-4" />
                                    Review Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Reviewed By</p>
                                        <p className="font-medium">
                                            {(application as any).reviewer?.name || "Unknown"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Reviewed At</p>
                                        <p className="font-medium">
                                            {format(new Date(application.reviewedAt), "MMM d, yyyy 'at' h:mm a")}
                                        </p>
                                    </div>
                                </div>
                                {application.adminNotes && (
                                    <>
                                        <Separator />
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Admin Notes</p>
                                            <p className="text-sm bg-muted/50 rounded-md p-3">
                                                {application.adminNotes}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column — Applicant Info */}
                <div className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <User className="size-4" />
                                Applicant
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary font-semibold">
                                    {(application as any).user?.name?.[0]?.toUpperCase() || "?"}
                                </div>
                                <div>
                                    <p className="font-medium">{(application as any).user?.name}</p>
                                    <Badge variant="outline" className="text-xs capitalize">
                                        {(application as any).user?.role}
                                    </Badge>
                                </div>
                            </div>
                            <Separator />
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center gap-2">
                                    <Mail className="size-4 text-muted-foreground shrink-0" />
                                    <span className="truncate">{(application as any).user?.email}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone className="size-4 text-muted-foreground shrink-0" />
                                    <span>{application.phoneNumber}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Calendar className="size-4" />
                                Timeline
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative space-y-4">
                                <div className="flex gap-3">
                                    <div className="flex flex-col items-center">
                                        <div className="size-2.5 rounded-full bg-blue-500 mt-1.5" />
                                        {application.reviewedAt && (
                                            <div className="w-px h-full bg-border" />
                                        )}
                                    </div>
                                    <div className="-mt-0.5">
                                        <p className="text-sm font-medium">Submitted</p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(application.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                        </p>
                                    </div>
                                </div>
                                {application.reviewedAt && (
                                    <div className="flex gap-3">
                                        <div className="flex flex-col items-center">
                                            <div className={`size-2.5 rounded-full mt-1.5 ${config.dotColor}`} />
                                        </div>
                                        <div className="-mt-0.5">
                                            <p className="text-sm font-medium capitalize">{application.status}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {format(new Date(application.reviewedAt), "MMM d, yyyy 'at' h:mm a")}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Approve / Reject Dialog */}
            <Dialog open={!!actionType} onOpenChange={() => { setActionType(null); setAdminNotes(""); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {actionType === "approve" ? "Approve" : "Reject"} Application
                        </DialogTitle>
                        <DialogDescription>
                            {actionType === "approve"
                                ? `Approving will upgrade "${application.shopName}" to a shop owner account.`
                                : `Rejecting will deny "${application.shopName}'s" seller application.`}
                            {actionType === "approve" && application.businessType === "retail" && (
                                <span className="mt-1 block text-green-600">
                                    ✓ Retail type — will be seller-enabled (can sell B2C)
                                </span>
                            )}
                            {actionType === "approve" && application.businessType === "restaurant" && (
                                <span className="mt-1 block text-blue-600">
                                    ℹ Restaurant type — buyer-only (wholesale purchasing)
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Admin Notes {actionType === "reject" && "(recommended)"}
                        </label>
                        <Textarea
                            placeholder={
                                actionType === "approve"
                                    ? "Optional notes for the applicant..."
                                    : "Reason for rejection..."
                            }
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => { setActionType(null); setAdminNotes(""); }}
                            disabled={isActionPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmAction}
                            disabled={isActionPending}
                            className={
                                actionType === "approve"
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-red-600 hover:bg-red-700"
                            }
                        >
                            {isActionPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                            {actionType === "approve" ? "Approve" : "Reject"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
