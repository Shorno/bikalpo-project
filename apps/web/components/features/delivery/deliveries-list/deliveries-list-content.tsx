import { orpc, queryClient } from "@/utils/orpc";
import { DeliveryGroupsList, EmptyState } from "./index";

export async function DeliveriesListContent() {
  const { groups } = await queryClient.fetchQuery(
    orpc.deliveryman.getMyGroups.queryOptions(),
  );

  const hasGroups = groups && groups.length > 0;

  return hasGroups ? <DeliveryGroupsList groups={groups} /> : <EmptyState />;
}
