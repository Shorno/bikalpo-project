/**
 * Client component for order detail view (from orders list)
 */
"use client";

import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, Loader2, MapPin, Package, Phone, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useOrderByNumber } from "@/hooks/use-customer-api";
import { client } from "@/utils/orpc";

interface OrderDetailClientProps {
  orderNumber: string;
}

const statusConfig: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  pending: { color: "text-yellow-700", bg: "bg-yellow-50", label: "Pending" },
  confirmed: { color: "text-blue-700", bg: "bg-blue-50", label: "Confirmed" },
  processing: {
    color: "text-purple-700",
    bg: "bg-purple-50",
    label: "Processing",
  },
  out_for_delivery: {
    color: "text-indigo-700",
    bg: "bg-indigo-50",
    label: "Out for Delivery",
  },
  delivered: { color: "text-green-700", bg: "bg-green-50", label: "Delivered" },
  cancelled: { color: "text-red-700", bg: "bg-red-50", label: "Cancelled" },
};

const paymentMethodLabels: Record<string, string> = {
  cash_on_delivery: "Cash on Delivery",
  bkash: "bKash",
  nagad: "Nagad",
  bank_transfer: "Bank Transfer",
};

const formatPrice = (price: string | number) => {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(Number(price));
};

function OrderDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

export function OrderDetailClient({ orderNumber }: OrderDetailClientProps) {
  const { data, isLoading, isError } = useOrderByNumber(orderNumber);
  type OrderItem = NonNullable<
    NonNullable<typeof data>["order"]
  >["items"][number];

  // Report Issue state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportType, setReportType] = useState<"delivery" | "payment" | "product">("delivery");
  const [reportPriority, setReportPriority] = useState<"medium" | "high" | "critical">("medium");
  const [reportDescription, setReportDescription] = useState("");
  const [reportComment, setReportComment] = useState("");

  useEffect(() => {
    if (isError) {
      notFound();
    }
  }, [isError]);

  if (isLoading) return <OrderDetailSkeleton />;
  if (!data?.order) return null;

  const { order } = data;
  const config = statusConfig[order.status] || statusConfig.pending;

  // Show Report Issue for eligible statuses
  const canReport = ["confirmed", "processing", "out_for_delivery", "delivered", "returned"].includes(order.status);

  const handleSubmitComplaint = async () => {
    if (reportDescription.length < 10) {
      toast.error("Description must be at least 10 characters");
      return;
    }
    setReportLoading(true);
    try {
      await client.userComplaint.create({
        orderId: order.id,
        type: reportType,
        priority: reportPriority,
        description: reportDescription,
        userComment: reportComment || undefined,
      });
      toast.success("Complaint submitted successfully. Our team will investigate.");
      setReportOpen(false);
      setReportDescription("");
      setReportComment("");
      setReportType("delivery");
      setReportPriority("medium");
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit complaint");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/account/orders">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Order #{order.orderNumber}
            </h1>
            <p className="text-sm text-gray-500">
              Placed on {format(new Date(order.createdAt), "MMM d, yyyy")}
            </p>
          </div>
        </div>
        <Badge
          className={`${config.bg} ${config.color} border-0 text-sm shrink-0`}
        >
          {config.label}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order Items — Left */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              Order Items ({order.items?.length || 0})
            </h2>
          </div>

          <div className="divide-y divide-gray-50">
            {order.items?.map((item: OrderItem) => (
              <div key={item.id} className="flex items-center gap-4 p-4">
                <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                  <Image
                    src={item.productImage || "/placeholder-image.svg"}
                    alt={item.productName}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {item.productName}
                  </p>
                  {item.productSize && (
                    <p className="text-xs text-gray-500">
                      Pack: {item.productSize}
                    </p>
                  )}
                  <p className="text-sm text-gray-500">
                    {formatPrice(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <p className="font-semibold text-gray-900 shrink-0">
                  {formatPrice(item.totalPrice)}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-900">
                  {formatPrice(order.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Shipping</span>
                <span className="text-gray-900">
                  {Number(order.shippingCost) === 0
                    ? "Free"
                    : formatPrice(order.shippingCost)}
                </span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-red-600">
                    -{formatPrice(order.discount)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between pt-1">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-lg text-emerald-600">
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column — Shipping & Payment */}
        <div className="space-y-4">
          {/* Payment Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Payment
            </h3>
            <p className="text-sm text-gray-700 font-medium">
              {paymentMethodLabels[order.paymentMethod] || order.paymentMethod}
            </p>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
              Shipping Address
            </h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                <span className="text-gray-700 font-medium">
                  {order.shippingName}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div className="text-gray-600">
                  <p>{order.shippingAddress}</p>
                  <p>
                    {[
                      order.shippingArea,
                      order.shippingCity,
                      order.shippingPostalCode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                <span className="text-gray-600">{order.shippingPhone}</span>
              </div>
            </div>
          </div>

          {/* Customer Note */}
          {order.customerNote && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
                Your Note
              </p>
              <p className="text-sm text-amber-700">{order.customerNote}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <Button
              asChild
              className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Link href="/account/track">
                <Package className="h-4 w-4" />
                Track Order
              </Link>
            </Button>

            {/* Report Issue Button */}
            {canReport && (
              <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Report an Issue
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Report an Issue
                    </DialogTitle>
                    <DialogDescription>
                      File a complaint for Order #{order.orderNumber}. Our team will investigate and get back to you.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="complaint-type" className="text-sm font-medium">Issue Type</Label>
                        <Select value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
                          <SelectTrigger id="complaint-type" className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="delivery">Delivery</SelectItem>
                            <SelectItem value="payment">Payment</SelectItem>
                            <SelectItem value="product">Product</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="complaint-priority" className="text-sm font-medium">Priority</Label>
                        <Select value={reportPriority} onValueChange={(v) => setReportPriority(v as typeof reportPriority)}>
                          <SelectTrigger id="complaint-priority" className="h-9">
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
                    <div className="space-y-2">
                      <Label htmlFor="complaint-description" className="text-sm font-medium">
                        Describe the issue <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="complaint-description"
                        placeholder="Please describe the issue you're experiencing..."
                        value={reportDescription}
                        onChange={(e) => setReportDescription(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        Minimum 10 characters ({reportDescription.length}/5000)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="complaint-comment" className="text-sm font-medium">
                        Additional Comment <span className="text-muted-foreground">(optional)</span>
                      </Label>
                      <Textarea
                        id="complaint-comment"
                        placeholder="Any additional details..."
                        value={reportComment}
                        onChange={(e) => setReportComment(e.target.value)}
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setReportOpen(false)} disabled={reportLoading}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmitComplaint}
                      disabled={reportLoading || reportDescription.length < 10}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {reportLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Complaint
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

