"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  Pencil,
  Send,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SALES_PORTAL_BASE } from "@/lib/sales-routing";
import { orpc } from "@/utils/orpc";

type EstimateDetail = {
  id: number;
  estimateNumber: string;
  status: string;
  subtotal: string;
  discount: string;
  discountPercent?: string | number | null;
  total: string;
  createdAt: string | Date;
  validUntil?: string | Date | null;
  notes?: string | null;
  customer?: {
    name?: string | null;
    shopName?: string | null;
    warehouseName?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
  } | null;
  items: Array<{
    id: number;
    productName: string;
    productImage?: string | null;
    productSize?: string | null;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }>;
};

const statusMeta: Record<
  string,
  { label: string; icon: typeof Clock; className: string }
> = {
  pending: {
    label: "Pending Approval",
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  sent: {
    label: "Sent",
    icon: Send,
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  converted: {
    label: "Converted",
    icon: CheckCircle2,
    className: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className: "border-red-200 bg-red-50 text-red-700",
  },
  draft: {
    label: "Draft",
    icon: Clock,
    className: "border-muted bg-muted/50 text-muted-foreground",
  },
};

function formatMoney(value: string | number | null | undefined) {
  return `Tk ${Number(value ?? 0).toLocaleString("en-BD")}`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] ?? statusMeta.draft;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`gap-1 ${meta.className}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

export default function SalesmanEstimateDetailPage() {
  const params = useParams();
  const estimateId = Number(params.id);

  const { data, isLoading, error } = useQuery({
    ...orpc.salesman.getEstimateById.queryOptions({
      input: { id: estimateId },
    }),
    enabled: Number.isFinite(estimateId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !data?.estimate) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" className="gap-2">
          <Link href={`${SALES_PORTAL_BASE}/estimates`}>
            <ArrowLeft className="h-4 w-4" />
            Back to Estimates
          </Link>
        </Button>
        <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Estimate not found or you do not have access.
        </div>
      </div>
    );
  }

  const estimate = data.estimate as EstimateDetail;
  const customerName =
    estimate.customer?.shopName ||
    estimate.customer?.warehouseName ||
    estimate.customer?.name ||
    "Customer";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={`${SALES_PORTAL_BASE}/estimates`}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {estimate.estimateNumber}
              </h1>
              <StatusBadge status={estimate.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Created {formatDate(estimate.createdAt)}
            </p>
          </div>
        </div>
        {!["converted", "rejected"].includes(estimate.status) && (
          <Button asChild variant="outline">
            <Link href={`${SALES_PORTAL_BASE}/estimates/${estimate.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold">{formatMoney(estimate.total)}</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Discount</p>
            <p className="text-xl font-bold">
              {Number(estimate.discountPercent ?? 0)}%
            </p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Items</p>
            <p className="text-xl font-bold">{estimate.items.length}</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Valid Until</p>
            <p className="text-xl font-bold">
              {formatDate(estimate.validUntil)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="p-0">
          <CardContent className="space-y-3 p-5">
            <div>
              <h2 className="text-sm font-semibold">Customer</h2>
              <p className="mt-1 text-lg font-bold">{customerName}</p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>{estimate.customer?.name}</p>
              <p>{estimate.customer?.phoneNumber ?? "No phone"}</p>
              <p className="truncate">{estimate.customer?.email}</p>
            </div>
            {estimate.notes && (
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{estimate.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardContent className="p-0">
            <div className="border-b px-5 py-4">
              <h2 className="text-sm font-semibold">Products</h2>
            </div>
            <div className="divide-y">
              {estimate.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.productImage ? (
                      <Image
                        src={item.productImage}
                        alt={item.productName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Package className="m-3 h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.productSize || "Variant"} · {formatMoney(item.unitPrice)} x{" "}
                      {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold">{formatMoney(item.totalPrice)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t bg-muted/20 p-5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(estimate.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-destructive">
                  -{formatMoney(estimate.discount)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatMoney(estimate.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
