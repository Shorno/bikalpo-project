"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Pencil,
  Plus,
  Send,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SALES_PORTAL_BASE } from "@/lib/sales-routing";
import { orpc } from "@/utils/orpc";

type EstimateRow = {
  id: number;
  estimateNumber: string;
  status: string;
  total: string;
  discountPercent?: string | number | null;
  createdAt: string | Date;
  customer?: {
    name?: string | null;
    shopName?: string | null;
    warehouseName?: string | null;
    phoneNumber?: string | null;
  } | null;
  items?: unknown[];
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

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(value: string | number | null | undefined) {
  return `Tk ${Number(value ?? 0).toLocaleString("en-BD")}`;
}

function customerName(estimate: EstimateRow) {
  return (
    estimate.customer?.shopName ||
    estimate.customer?.warehouseName ||
    estimate.customer?.name ||
    "Customer"
  );
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

export default function SalesmanEstimatesPage() {
  const { data, isLoading, error } = useQuery(
    orpc.salesman.getEstimates.queryOptions({ input: {} }),
  );

  const estimates = (data?.estimates ?? []) as EstimateRow[];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Failed to load estimates.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Estimates
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and track estimates for your assigned shops and warehouses.
          </p>
        </div>
        <Button asChild>
          <Link href={`${SALES_PORTAL_BASE}/estimates/create`}>
            <Plus className="mr-2 h-4 w-4" />
            Create Estimate
          </Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        {estimates.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <Clock className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No estimates yet</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Create an estimate from warehouse stock for one or more assigned
              customers.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href={`${SALES_PORTAL_BASE}/estimates/create`}>
                <Plus className="mr-2 h-3.5 w-3.5" />
                Create Estimate
              </Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estimate</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.map((estimate) => (
                <TableRow key={estimate.id}>
                  <TableCell>
                    <p className="font-medium">{estimate.estimateNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(estimate.createdAt)} ·{" "}
                      {estimate.items?.length ?? 0} items
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{customerName(estimate)}</p>
                    <p className="text-xs text-muted-foreground">
                      {estimate.customer?.phoneNumber ?? "No phone"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={estimate.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(estimate.discountPercent ?? 0)}%
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatMoney(estimate.total)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`${SALES_PORTAL_BASE}/estimates/${estimate.id}`}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View</span>
                        </Link>
                      </Button>
                      {!["converted", "rejected"].includes(estimate.status) && (
                        <Button asChild variant="ghost" size="icon">
                          <Link
                            href={`${SALES_PORTAL_BASE}/estimates/${estimate.id}/edit`}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
