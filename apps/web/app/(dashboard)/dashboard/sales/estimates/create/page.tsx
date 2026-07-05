"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SalesmanEstimateForm } from "@/components/features/estimates/salesman-estimate-form";
import { Button } from "@/components/ui/button";
import { SALES_BASE } from "@/lib/routes";

export default function CreateEstimatePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0" asChild>
          <Link href={`${SALES_BASE}/estimates`}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Create Estimate</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a warehouse-stock estimate for assigned customers.
          </p>
        </div>
      </div>
      <SalesmanEstimateForm mode="create" basePath={SALES_BASE} />
    </div>
  );
}
