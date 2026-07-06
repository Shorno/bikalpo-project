"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SalesmanEstimateForm } from "@/components/features/estimates/salesman-estimate-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SALES_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

export default function EditEstimatePage() {
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
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !data?.estimate) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" className="gap-2" asChild>
          <Link href={`${SALES_BASE}/estimates`}>
            <ArrowLeft className="h-4 w-4" />
            Back to Estimates
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          This estimate could not be found or you do not have access.
        </p>
      </div>
    );
  }

  const estimate = data.estimate;
  const isClosed =
    estimate.status === "converted" || estimate.status === "rejected";
  const hasLegacyItems = estimate.items.some((item) => item.variantId == null);
  const isReadOnly = isClosed || hasLegacyItems;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0" asChild>
          <Link href={`${SALES_BASE}/estimates/${estimate.id}`}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Edit {estimate.estimateNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update products, customer, validity, and discount percentage.
          </p>
        </div>
      </div>

      {isReadOnly ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {hasLegacyItems ? "Legacy estimate" : "Read-only estimate"}
          </AlertTitle>
          <AlertDescription>
            {hasLegacyItems
              ? "This older estimate has products without warehouse variant snapshots. Create a new estimate from warehouse stock instead."
              : "Converted and rejected estimates cannot be edited."}
          </AlertDescription>
        </Alert>
      ) : (
        <SalesmanEstimateForm mode="edit" estimate={estimate} basePath={SALES_BASE} />
      )}
    </div>
  );
}
