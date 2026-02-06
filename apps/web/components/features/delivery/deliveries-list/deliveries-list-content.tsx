import { getAssignedGroups } from "@/actions/delivery/deliveryman-actions";
import { DeliveryGroupsList, EmptyState } from "./index";

export async function DeliveriesListContent() {
  const { groups } = await getAssignedGroups();

  const hasGroups = groups && groups.length > 0;

  return hasGroups ? <DeliveryGroupsList groups={groups} /> : <EmptyState />;
}
