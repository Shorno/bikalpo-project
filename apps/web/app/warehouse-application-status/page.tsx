"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, Clock, Warehouse, XCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc } from "@/utils/orpc";

const statusConfig = {
    pending: {
        icon: Clock,
        title: "Application Under Review",
        description: "Our team is reviewing your warehouse application. This usually takes 1-2 business days.",
        color: "text-yellow-600",
        bgColor: "bg-yellow-100",
        badgeVariant: "outline" as const,
    },
    approved: {
        icon: CheckCircle,
        title: "Application Approved!",
        description: "Congratulations! Your warehouse account has been approved. You can now access your warehouse dashboard.",
        color: "text-green-600",
        bgColor: "bg-green-100",
        badgeVariant: "default" as const,
    },
    rejected: {
        icon: XCircle,
        title: "Application Not Approved",
        description: "Unfortunately, your warehouse application was not approved at this time. Please review the notes below and consider reapplying.",
        color: "text-red-600",
        bgColor: "bg-red-100",
        badgeVariant: "destructive" as const,
    },
};

export default function WarehouseApplicationStatusPage() {
    const { data: application, isLoading: loading } = useQuery({
        ...orpc.warehouseApplication.getMyApplication.queryOptions(),
    });

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-amber-600" />
            </div>
        );
    }

    // No application found — redirect to apply
    if (!application || !application.status) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
                <div className="mx-auto max-w-md text-center">
                    <div className="mb-6 flex justify-center">
                        <div className="rounded-full bg-gray-100 p-4">
                            <Warehouse className="h-12 w-12 text-gray-400" />
                        </div>
                    </div>
                    <h1 className="mb-2 text-2xl font-bold tracking-tight">
                        No Application Found
                    </h1>
                    <p className="mb-6 text-muted-foreground">
                        You haven&apos;t submitted a warehouse application yet.
                    </p>
                    <div className="flex flex-col gap-3">
                        <Button asChild className="bg-amber-600 hover:bg-amber-700">
                            <Link href="/apply-warehouse">Apply Now</Link>
                        </Button>
                        <Button asChild variant="outline">
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Continue Shopping
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const status = application.status as keyof typeof statusConfig;
    const config = statusConfig[status];
    const StatusIcon = config.icon;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <Card className="mx-auto w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mb-4 flex justify-center">
                        <div className={`rounded-full p-4 ${config.bgColor}`}>
                            <StatusIcon className={`h-12 w-12 ${config.color}`} />
                        </div>
                    </div>
                    <CardTitle className="text-2xl">{config.title}</CardTitle>
                    <CardDescription className="text-base">
                        {config.description}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Application Details */}
                    <div className="rounded-lg bg-gray-50 p-4">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Warehouse Name</span>
                                <span className="font-medium">{application.warehouseName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Owner</span>
                                <span className="font-medium">{application.ownerName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Submitted</span>
                                <span className="font-medium">
                                    {new Date(application.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Status</span>
                                <Badge variant={config.badgeVariant} className="capitalize">
                                    {application.status}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Admin Notes (if rejected) */}
                    {application.status === "rejected" && application.adminNotes && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                            <p className="text-sm font-medium text-red-800">Admin Notes:</p>
                            <p className="mt-1 text-sm text-red-700">{application.adminNotes}</p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3 pt-2">
                        {application.status === "pending" && (
                            <Button asChild className="w-full bg-amber-600 hover:bg-amber-700">
                                <Link href="/apply-warehouse?edit=true">
                                    Edit Application
                                </Link>
                            </Button>
                        )}
                        {application.status === "approved" && (
                            <Button asChild className="w-full bg-green-600 hover:bg-green-700">
                                <Link href="/warehouse/dashboard">Go to Warehouse Dashboard</Link>
                            </Button>
                        )}
                        {application.status === "rejected" && (
                            <Button asChild className="w-full bg-amber-600 hover:bg-amber-700">
                                <Link href="/apply-warehouse?edit=true">Reapply</Link>
                            </Button>
                        )}
                        <Button asChild variant="outline" className="w-full">
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Continue Shopping
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
