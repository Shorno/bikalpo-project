import { Suspense } from "react";
import { getVerifiedUsers } from "@/actions/users/get-verified-users";
import { DashboardCustomersGrid } from "@/components/features/users/dashboard-customers-grid";
import { Skeleton } from "@/components/ui/skeleton";

interface VerifiedCustomersGridProps {
  searchParams: Promise<{
    search?: string;
    area?: string;
    sortBy?: string;
    page?: string;
  }>;
}

// Server component that fetches customers based on search params
async function CustomersGridContent({
  searchParams,
}: VerifiedCustomersGridProps) {
  const params = await searchParams;
  const { data } = await getVerifiedUsers({
    search: params.search,
    area: params.area,
    sortBy: params.sortBy as "top_buyers" | "most_orders" | "newest",
    page: params.page ? parseInt(params.page, 10) : 1,
    limit: 12,
  });

  return (
    <DashboardCustomersGrid
      customers={data?.users || []}
      totalPages={data?.totalPages || 1}
      currentPage={data?.currentPage || 1}
    />
  );
}

function GridSkeleton() {
  return (
    <>
      {/* Section Title */}
      <div className="mb-8">
        <Skeleton className="h-8 w-56 mx-auto" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border-2 border-gray-100 rounded-xl p-5 bg-white"
          >
            {/* Header: Avatar + Info */}
            <div className="flex items-start gap-4 mb-4">
              <Skeleton className="w-14 h-14 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>

            {/* Reviews Section */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <Skeleton className="h-3 w-28 mb-2" />
              <Skeleton className="h-4 w-20" />
            </div>

            {/* Button */}
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
    </>
  );
}

export function VerifiedCustomersGrid({
  searchParams,
}: VerifiedCustomersGridProps) {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <CustomersGridContent searchParams={searchParams} />
    </Suspense>
  );
}
