import { retailerColumns } from "../_components/retailer-columns";
import { UsersListClient } from "../_components/users-list-client";

export default function RetailersPage() {
  return (
    <div className="p-4 sm:p-6">
      <UsersListClient
        role="shop_owner"
        title="Retailer Users"
        description="Manage retailer accounts and shop owners"
        columns={retailerColumns}
        emptyLabel="Retailers matching your current filters will appear here."
      />
    </div>
  );
}
