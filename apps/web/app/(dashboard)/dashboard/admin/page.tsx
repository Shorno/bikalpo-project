import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminDashboardClient } from "./admin-dashboard-client";

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>

      {/* Operations */}
      <Skeleton className="h-24 rounded-xl" />

      {/* Two-column */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>

      {/* Subscription */}
      <Skeleton className="h-24 rounded-xl" />

      {/* Performance */}
      <Skeleton className="h-24 rounded-xl" />

      {/* Quick Actions */}
      <Skeleton className="h-32 rounded-xl" />
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <Suspense fallback={<LoadingSkeleton />}>
        <AdminDashboardClient />
      </Suspense>
    </div>
  );
}
