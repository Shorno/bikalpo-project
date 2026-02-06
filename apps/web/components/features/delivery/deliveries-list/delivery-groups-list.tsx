import { DeliveryGroupCard } from "./delivery-group-card";
import type { DeliveryGroupsListProps } from "./types";

export function DeliveryGroupsList({ groups }: DeliveryGroupsListProps) {
  return (
    <>
      {groups.map((group) => (
        <DeliveryGroupCard key={group.id} group={group} />
      ))}
    </>
  );
}
