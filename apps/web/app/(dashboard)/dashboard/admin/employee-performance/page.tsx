import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeePerformanceClient } from "./employee-performance-client";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Filters Skeleton */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>

      {/* Table Skeleton */}
      <Skeleton className="h-96" />
    </div>
  );
}

export default function EmployeePerformancePage() {
  return (
    <div className="container mx-auto  space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Employee Performance
          </h1>
          <p className="text-muted-foreground">
            Monitor and analyze employee work summaries and performance metrics
          </p>
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <EmployeePerformanceClient />
      </Suspense>
    </div>
  );
}
