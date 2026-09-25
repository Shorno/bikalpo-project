import {
  retailerColumns,
  UsersListClient,
} from "../_components/users-list-client";

export const metadata = {
  title: "Retailers | Admin",
  description: "Retailer user performance and registered accounts",
};

export default function RetailersPage() {
  return (
    <UsersListClient
      portalRole="shop_owner"
      title="Retailers"
      columns={retailerColumns}
      emptyLabel="Retailers matching your current filters will appear here."
    />
  );
}
