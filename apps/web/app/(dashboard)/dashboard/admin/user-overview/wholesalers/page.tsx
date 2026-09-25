import {
  UsersListClient,
  wholesalerColumns,
} from "../_components/users-list-client";

export const metadata = {
  title: "Wholesalers | Admin",
  description: "Wholesaler user performance and registered accounts",
};

export default function WholesalersPage() {
  return (
    <UsersListClient
      portalRole="warehouse"
      title="Wholesalers"
      description="Manage accounts authorized for the Warehouse Owner portal"
      columns={wholesalerColumns}
      emptyLabel="Warehouse Owners matching your current filters will appear here."
    />
  );
}
