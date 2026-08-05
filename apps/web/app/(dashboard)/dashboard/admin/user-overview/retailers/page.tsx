import {
  retailerColumns,
  UsersListClient,
} from "../_components/users-list-client";

export const metadata = {
  title: "Retailer Users | Admin",
  description: "All registered retailer accounts",
};

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
