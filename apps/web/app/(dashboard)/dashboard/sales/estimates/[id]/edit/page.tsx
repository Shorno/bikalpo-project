import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEstimateById } from "@/actions/estimate/get-estimates";
import { EditEstimateForm } from "@/components/features/estimates/edit-estimate-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SALES_BASE } from "@/lib/routes";

export default async function EditEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getEstimateById(Number(id));

  if (!result.success || !result.estimate) {
    notFound();
  }

  const { estimate } = result;

  const isReadOnly =
    estimate.status === "converted" || estimate.status === "rejected";

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
