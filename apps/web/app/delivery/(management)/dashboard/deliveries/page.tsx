import { Bike } from "lucide-react";
import { orpc, queryClient } from "@/utils/orpc";
import { DeliveriesClient } from "./deliveries-client";

export const dynamic = "force-dynamic";

export default async function DeliveryListPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const defaultTab = tab === "history" ? "history" : "active";

  const [activeResult, historyResult] = await Promise.all([
    queryClient.fetchQuery(orpc.deliveryman.getMyGroups.queryOptions()),
    queryClient.fetchQuery(
      orpc.deliveryman.getMyDeliveryHistory.queryOptions({
        input: { limit: 100, offset: 0 },
      }),
    ),
  ]);

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Bike className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            My Deliveries
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            View active assignments and past delivery routes
          </p>
        </div>
      </div>

      <DeliveriesClient
        activeGroups={activeResult.groups ?? []}
        historyGroups={historyResult.groups ?? []}
        defaultTab={defaultTab}
      />
    </div>
  );
}
