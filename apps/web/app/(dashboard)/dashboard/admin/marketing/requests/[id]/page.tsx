"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Check,
  Clock,
  Loader2,
  MapPin,
  Package,
  Phone,
  Truck,
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
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/utils/orpc";

const STATUS_STEPS = [
  { key: "pending", label: "Received", icon: Clock },
  { key: "approved", label: "Approved", icon: Check },
  { key: "dispatched", label: "Dispatched", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Package },
];

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  approved: 1,
  dispatched: 2,
  delivered: 3,
  rejected: -1,
};

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [adminNote, setAdminNote] = useState("");

  const { data: request, isLoading } = useQuery({
    ...orpc.adminMarketing.getRequestById.queryOptions({
      input: { id: params.id as string },
    }),
  });

  // ── Mutations ──────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: (params: { requestId: string; adminNote?: string }) =>
      client.adminMarketing.approveRequest(params),
    onSuccess: () => {
      toast.success("Request approved");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (params: { requestId: string; adminNote?: string }) =>
      client.adminMarketing.rejectRequest(params),
    onSuccess: () => {
      toast.success("Request rejected");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });

  const dispatchMutation = useMutation({
    mutationFn: (params: { requestId: string; adminNote?: string }) =>
      client.adminMarketing.markDispatched(params),
    onSuccess: () => {
      toast.success("Marked as dispatched");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });

  const deliverMutation = useMutation({
    mutationFn: (params: { requestId: string; adminNote?: string }) =>
      client.adminMarketing.markDelivered(params),
    onSuccess: () => {
      toast.success("Marked as delivered");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    dispatchMutation.isPending ||
    deliverMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Request not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/dashboard/admin/marketing">
            <ArrowLeft className="mr-2 size-4" />
            Back to Marketing
          </Link>
        </Button>
      </div>
    );
  }

  const currentStep = STATUS_ORDER[request.status] ?? -1;
  const isRejected = request.status === "rejected";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard/admin/marketing">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">
              {request.requestNumber}
            </h1>
            <Badge
              variant="outline"
              className={`capitalize ${
                isRejected
                  ? "border-red-200 text-red-600 bg-red-50"
                  : currentStep >= 3
                    ? "border-green-200 text-green-700 bg-green-50"
                    : "border-amber-200 text-amber-600 bg-amber-50"
              }`}
            >
              {request.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Submitted {format(new Date(request.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
      </div>

      {/* ── Status Pipeline ─────────────────────────────────────── */}
      {!isRejected && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Status Tracking
          </h2>
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, idx) => {
              const completed = currentStep >= idx;
              const active = currentStep === idx;
              return (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex items-center justify-center size-10 rounded-full border-2 transition-all ${
                        completed
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : active
                            ? "border-amber-400 bg-amber-50 text-amber-600"
                            : "border-muted bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {completed && !active ? (
                        <Check className="size-4" />
                      ) : (
                        <step.icon className="size-4" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        completed ? "text-emerald-600" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 transition-all ${
                        currentStep > idx ? "bg-emerald-400" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isRejected && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700 font-medium">
            ❌ This request was rejected
            {request.reviewedAt &&
              ` on ${format(new Date(request.reviewedAt), "MMM d, yyyy")}`}
          </p>
          {request.adminNote && (
            <p className="text-sm text-red-600 mt-1">
              Reason: {request.adminNote}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* ── Seller Info ───────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="size-4" />
              Seller Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">
                {(request as any).requestedBy?.name || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User Type</span>
              <Badge variant="secondary" className="capitalize text-xs">
                {request.userType}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="text-xs">
                {(request as any).requestedBy?.email || "—"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── Material Info ──────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="size-4" />
              Material Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Material</span>
              <span className="font-medium">
                {(request as any).material?.title || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="capitalize">
                {(request as any).material?.type}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size</span>
              <span>{(request as any).material?.sizeFormat || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity</span>
              <span className="font-bold">{request.quantity} pcs</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Delivery Info ──────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="size-4" />
              Delivery Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Type</span>
              <span className="capitalize">{request.deliveryType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Address</span>
              <span className="text-right max-w-[200px]">
                {request.deliveryAddress || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contact</span>
              <span>{request.deliveryContact || "—"}</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Payment Info ──────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              Payment & Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Type</span>
              <Badge variant="secondary" className="capitalize text-xs">
                {request.paymentType}
              </Badge>
            </div>
            {(request.paymentAmount ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">
                  ৳{request.paymentAmount}
                </span>
              </div>
            )}
            {(request as any).reviewedBy && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reviewed By</span>
                <span>{(request as any).reviewedBy.name}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Design Preview */}
      {(request as any).material?.designFileUrl && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Design Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative w-full max-w-md aspect-video rounded-lg overflow-hidden border bg-muted">
              <Image
                src={(request as any).material.designFileUrl}
                alt="Design preview"
                fill
                className="object-contain"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Action Panel ──────────────────────────────────────── */}
      {request.status !== "delivered" && request.status !== "rejected" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              ⚙ Action Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Note</label>
              <Textarea
                placeholder="লিখুন..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {request.status === "pending" && (
                <>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() =>
                      approveMutation.mutate({
                        requestId: request.id,
                        adminNote: adminNote || undefined,
                      })
                    }
                    disabled={isPending}
                  >
                    {approveMutation.isPending && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    <Check className="mr-1 size-4" />
                    Approve Request
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      rejectMutation.mutate({
                        requestId: request.id,
                        adminNote: adminNote || undefined,
                      })
                    }
                    disabled={isPending}
                  >
                    {rejectMutation.isPending && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    <X className="mr-1 size-4" />
                    Reject Request
                  </Button>
                </>
              )}
              {request.status === "approved" && (
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() =>
                    dispatchMutation.mutate({
                      requestId: request.id,
                      adminNote: adminNote || undefined,
                    })
                  }
                  disabled={isPending}
                >
                  {dispatchMutation.isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  <Truck className="mr-1 size-4" />
                  Mark as Dispatched
                </Button>
              )}
              {request.status === "dispatched" && (
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() =>
                    deliverMutation.mutate({
                      requestId: request.id,
                      adminNote: adminNote || undefined,
                    })
                  }
                  disabled={isPending}
                >
                  {deliverMutation.isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  <Package className="mr-1 size-4" />
                  Mark as Delivered
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
