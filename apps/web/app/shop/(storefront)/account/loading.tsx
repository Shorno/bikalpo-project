import { Skeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <div className="space-y-4">
      {/* Header Skeleton */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Recent Orders Skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24 mt-1" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32 mt-1" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-20 mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200"
          >
            <Skeleton className="w-12 h-12 rounded-full" />
            <div>
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-36 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
