import { RotateCcw } from "lucide-react";
import { getReturns } from "@/actions/returns/return-processing";
import { ReturnsClient } from "./returns-client";

export default async function ReturnsPage() {
  const { returns } = await getReturns();

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Header with Icon */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <RotateCcw className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Returns
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage product return requests
          </p>
        </div>
      </div>

      {/* Returns List */}
      <ReturnsClient returns={(returns as any) || []} />
    </div>
  );
}
