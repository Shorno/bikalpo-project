import {
  retailerColumns,
  UsersListClient,
} from "../_components/users-list-client";

export const metadata = {
  title: "Shop Owners | Admin",
  description: "All registered Shop Owner accounts",
};

export default function RetailersPage() {
  return (
    <div className="p-4 sm:p-6">
      <UsersListClient
        portalRole="shop_owner"
        title="Shop Owners"
        description="Manage accounts authorized for the Shop Owner portal"
        columns={retailerColumns}
        emptyLabel="Shop Owners matching your current filters will appear here."
      />
    </div>
  );
}
