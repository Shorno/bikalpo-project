import { Suspense } from "react";
import { getVerifiedUsers } from "@/actions/users/get-verified-users";
import { DashboardTopBuyers } from "@/components/features/users/dashboard-top-buyers";
import { Skeleton } from "@/components/ui/skeleton";

// Server component that fetches top buyers
async function TopBuyersContent() {
  const { data } = await getVerifiedUsers({ limit: 100 });
  const allUsers = data?.users || [];
  const topBuyers = [...allUsers]
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, 3);

  return <DashboardTopBuyers buyers={topBuyers} />;
}

function TopBuyersSkeleton() {
  return (
    <div className="mb-12">
      {/* Section Title with Trophy Icon */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <Skeleton className="w-6 h-6 rounded" />
        <Skeleton className="h-7 w-32" />
      </div>

      {/* Top Buyers Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border-2 border-gray-100 rounded-xl p-5"
          >
            {/* Header: Avatar + Info */}
            <div className="flex items-start gap-4">
              <Skeleton className="w-14 h-14 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VerifiedTopBuyers() {
  return (
    <Suspense fallback={<TopBuyersSkeleton />}>
      <TopBuyersContent />
    </Suspense>
  );
}
