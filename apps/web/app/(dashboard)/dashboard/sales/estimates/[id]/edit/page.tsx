"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EditEstimateForm } from "@/components/features/estimates/edit-estimate-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SALES_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

function EditEstimatePageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export default function EditEstimatePage() {
  const params = useParams();
  const estimateId = Number(params.id as string);

  const { data, isLoading, error } = useQuery({
    ...orpc.salesman.getEstimateById.queryOptions({ input: { id: estimateId } }),
    enabled: !Number.isNaN(estimateId),
  });

  if (isLoading) {
    return <EditEstimatePageSkeleton />;
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
        <p className="text-muted-foreground">This estimate could not be found or you don't have access to it.</p>
        <Button asChild>
          <Link href={`${SALES_BASE}/estimates`}>Back to Estimates</Link>
        </Button>
      </div>
    );
  }

  const { estimate } = data;
  const isReadOnly = estimate.status === "converted" || estimate.status === "rejected";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
          <Link href={`${SALES_BASE}/estimates`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg sm:text-xl font-bold">
            Edit Estimate {estimate.estimateNumber}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Update the estimate details and items.
          </p>
        </div>
      </div>

      {isReadOnly && (
        <Alert
          variant="destructive"
          className="border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">
            Read-only Mode
          </AlertTitle>
          <AlertDescription className="text-xs">
            This estimate has been {estimate.status} and cannot be modified.
          </AlertDescription>
        </Alert>
      )}

      <EditEstimateForm estimate={estimate} isReadOnly={isReadOnly} />
    </div>
  );
}
