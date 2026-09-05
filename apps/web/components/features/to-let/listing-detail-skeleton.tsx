import { Skeleton } from "@/components/ui/skeleton";

export function ListingDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading listing details"
      aria-busy="true"
      className="min-h-screen bg-muted/20"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <Skeleton className="h-5 w-36" />
        <div className="my-6 space-y-4 border-b pb-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-full max-w-xl" />
          <Skeleton className="h-5 w-full max-w-sm" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Skeleton className="aspect-video w-full rounded-2xl" />
            <div className="flex gap-3">
              {[0, 1, 2].map((id) => (
                <Skeleton key={id} className="h-16 w-24" />
              ))}
            </div>
            <Skeleton className="h-36 w-full" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        </div>
        <span className="sr-only">
          Loading property, rent and availability details.
        </span>
      </div>
    </div>
  );
}
