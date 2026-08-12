import {
  UsersListClient,
  wholesalerColumns,
} from "../_components/users-list-client";

export const metadata = {
  title: "Warehouse Owners | Admin",
  description: "All registered Warehouse Owner accounts",
};

export default function WholesalersPage() {
  return (
    <div className="p-4 sm:p-6">
      <UsersListClient
        portalRole="warehouse"
        title="Warehouse Owners"
        description="Manage accounts authorized for the Warehouse Owner portal"
        columns={wholesalerColumns}
        emptyLabel="Warehouse Owners matching your current filters will appear here."
      />
    </div>
  );
}
