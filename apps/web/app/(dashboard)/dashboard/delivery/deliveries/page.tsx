import { Bike } from "lucide-react";
import { Suspense } from "react";
import {
  DeliveriesListContent,
  DeliveriesListSkeleton,
} from "@/components/features/delivery/deliveries-list";

export default function DeliveryListPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Header with Icon */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Bike className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            My Deliveries
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            View and manage your assigned delivery groups
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4">
        <Suspense fallback={<DeliveriesListSkeleton />}>
          <DeliveriesListContent />
        </Suspense>
      </div>
    </div>
  );
}
