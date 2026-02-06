import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminDashboardClient } from "./admin-dashboard-client";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>

      {/* Quick Actions Skeleton */}
      <Skeleton className="h-48" />

      {/* Recent Orders Skeleton */}
      <Skeleton className="h-64" />
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<LoadingSkeleton />}>
        <AdminDashboardClient />
      </Suspense>
    </div>
  );
}
