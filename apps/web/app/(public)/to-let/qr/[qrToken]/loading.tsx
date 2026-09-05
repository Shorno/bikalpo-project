import { Skeleton } from "@/components/ui/skeleton";

export default function PropertyLoading() {
  return (
    <div
      role="status"
      aria-label="Loading property listings"
      className="mx-auto max-w-7xl px-4 py-10"
    >
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="aspect-video" />
        <div className="space-y-4 md:col-span-2">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((id) => (
          <Skeleton key={id} className="h-80" />
        ))}
      </div>
    </div>
  );
}
