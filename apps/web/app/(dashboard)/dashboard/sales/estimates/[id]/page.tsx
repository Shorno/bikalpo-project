"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Package,
  Phone,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EstimateActionButtons } from "@/components/features/estimates/estimate-action-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SALES_BASE } from "@/lib/routes";
import { formatPrice } from "@/utils/currency";
import { orpc } from "@/utils/orpc";

const statusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: "bg-gray-100 text-gray-700", label: "Draft" },
  sent: { color: "bg-blue-100 text-blue-700", label: "Sent" },
  approved: { color: "bg-green-100 text-green-700", label: "Approved" },
  rejected: { color: "bg-red-100 text-red-700", label: "Rejected" },
  converted: { color: "bg-purple-100 text-purple-700", label: "Converted" },
};

function EstimateDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function EstimateDetailsPage() {
  const params = useParams();
  const estimateId = Number(params.id as string);

  const { data, isLoading, error } = useQuery({
    ...orpc.salesman.getEstimateById.queryOptions({
      input: { id: estimateId },
    }),
    enabled: !Number.isNaN(estimateId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <EstimateDetailSkeleton />
      </div>
    );
  }

  if (error || !data?.estimate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
            <Link href={`${SALES_BASE}/estimates`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-lg sm:text-xl font-bold">Estimate Not Found</h1>
        </div>
        <p className="text-muted-foreground">
          This estimate could not be found or you don't have access to it.
        </p>
        <Button asChild>
          <Link href={`${SALES_BASE}/estimates`}>Back to Estimates</Link>
        </Button>
      </div>
    );
  }

  const { estimate } = data;
  const status = statusConfig[estimate.status] || statusConfig.draft;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
          <Link href={`${SALES_BASE}/estimates`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold truncate">
            Estimate {estimate.estimateNumber}
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="secondary" className={`text-xs ${status.color}`}>
              {status.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(estimate.createdAt), "MMM d, yyyy")}
            </span>
          </div>
        </div>
        {/* Action buttons for employees */}
        <EstimateActionButtons estimate={estimate} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-xl sm:text-2xl font-bold text-primary">
              {formatPrice(estimate.total)}
            </p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-xl sm:text-2xl font-bold">
              {estimate.items.length}
            </p>
            <p className="text-xs text-muted-foreground">Items</p>
          </CardContent>
        </Card>
        <Card className="p-0 hidden sm:block">
          <CardContent className="p-3 text-center">
            <p className="text-sm font-medium truncate">
              {estimate.customer?.shopName || estimate.customer?.name || "—"}
            </p>
            <p className="text-xs text-muted-foreground">Customer</p>
          </CardContent>
        </Card>
        <Card className="p-0 hidden sm:block">
          <CardContent className="p-3 text-center">
            <p className="text-sm font-medium">
              {estimate.validUntil
                ? format(new Date(estimate.validUntil), "MMM d")
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Valid Until</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Info - Compact */}
      <div className="border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Customer</span>
        </div>
        <div className="space-y-1 text-sm">
          <p className="font-medium">
            {estimate.customer?.shopName || estimate.customer?.name}
          </p>
          {estimate.customer?.shopName && (
            <p className="text-muted-foreground">{estimate.customer.name}</p>
          )}
          {estimate.customer?.phoneNumber && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{estimate.customer.phoneNumber}</span>
            </div>
          )}
          {estimate.customer?.email && (
            <p className="text-muted-foreground truncate">
              {estimate.customer.email}
            </p>
          )}
        </div>
      </div>

      {/* Products List */}
      <div className="border rounded-lg">
        <div className="flex items-center gap-2 p-3 border-b">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Products</span>
        </div>
        <div className="divide-y">
          {estimate.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                {item.productImage ? (
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {item.productName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {formatPrice(item.unitPrice)}
                  {Number(item.discount) > 0 && (
                    <span className="text-green-600 ml-1">
                      (-{formatPrice(item.discount)})
                    </span>
                  )}
                </p>
              </div>
              <p className="text-sm font-semibold">
                {formatPrice(item.totalPrice)}
              </p>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="border-t p-3 space-y-1.5 bg-muted/30">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(estimate.subtotal)}</span>
          </div>
          {Number(estimate.discount) > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-{formatPrice(estimate.discount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span className="text-primary">{formatPrice(estimate.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {estimate.notes && (
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Notes</span>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {estimate.notes}
          </p>
        </div>
      )}

      {/* Converted Order Card */}
      {estimate.status === "converted" && estimate.convertedOrderId && (
        <div className="border rounded-lg p-3 bg-green-50 border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-semibold text-green-700">
              Converted to Order
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            This estimate has been converted to an order.
          </p>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href={`${SALES_BASE}/orders/${estimate.convertedOrderId}`}>
              View Order
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
