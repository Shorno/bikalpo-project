import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function DeliveryGroupCardSkeleton() {
  return (
    <Card className="overflow-hidden p-0">
      {/* Compact Header Skeleton */}
      <CardHeader className="bg-muted/30 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 sm:h-5 w-24 sm:w-32" />
              <Skeleton className="h-5 w-16 sm:w-20" />
            </div>
            <Skeleton className="h-3 w-20 sm:w-28" />
          </div>
          <Skeleton className="h-7 w-14 sm:w-24 shrink-0" />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Mobile: Compact card list skeleton */}
        <div className="sm:hidden divide-y">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>

        {/* Desktop: Table skeleton */}
        <div className="hidden sm:block p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-8" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DeliveriesListSkeleton() {
  return (
    <div className="grid gap-3 sm:gap-6">
      <DeliveryGroupCardSkeleton />
      <DeliveryGroupCardSkeleton />
    </div>
  );
}
