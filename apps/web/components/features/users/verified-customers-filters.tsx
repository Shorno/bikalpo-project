import { Suspense } from "react";
import { getVerifiedUsers } from "@/actions/users/get-verified-users";
import { DashboardCustomersFilters } from "@/components/features/users/dashboard-customers-filters";
import { Skeleton } from "@/components/ui/skeleton";

// Server component that fetches areas for filters
async function FiltersDataContent() {
  const { data } = await getVerifiedUsers({ limit: 100 });
  const areas = data?.areas || [];

  return <DashboardCustomersFilters areas={areas} />;
}

function FiltersSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 max-w-4xl mx-auto">
      <Skeleton className="h-12 w-full mb-4" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-12 opacity-0" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}

export function VerifiedCustomersFilters() {
  return (
    <Suspense fallback={<FiltersSkeleton />}>
      <FiltersDataContent />
    </Suspense>
  );
}
