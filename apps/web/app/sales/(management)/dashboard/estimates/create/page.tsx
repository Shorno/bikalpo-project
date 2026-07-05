"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SalesmanEstimateForm } from "@/components/features/estimates/salesman-estimate-form";
import { Button } from "@/components/ui/button";
import { SALES_PORTAL_BASE } from "@/lib/sales-routing";

export default function CreateSalesmanEstimatePage() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId");

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button asChild variant="ghost" size="icon" className="shrink-0">
          <Link href={`${SALES_PORTAL_BASE}/estimates`}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Create Estimate
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select assigned customers, choose warehouse-stock products, and
            submit with the discount approval rule.
          </p>
        </div>
      </div>

      <SalesmanEstimateForm
        mode="create"
        preselectedCustomerId={customerId}
      />
    </div>
  );
}
