import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminDashboardClient } from "./admin-dashboard-client";

function LoadingSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
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
