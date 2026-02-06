import { getCustomerItemRequests } from "@/actions/item-request/get-item-requests";
import { RequestItemsList } from "@/components/features/item-request/request-items-list";

export default async function AccountRequestsPage() {
  const result = await getCustomerItemRequests();

  return (
    <div>
      <RequestItemsList requests={result.data?.requests || []} />
    </div>
  );
}
