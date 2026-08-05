import {
  UsersListClient,
  wholesalerColumns,
} from "../_components/users-list-client";

export const metadata = {
  title: "Wholesaler Users | Admin",
  description: "All registered wholesaler accounts",
};

export default function WholesalersPage() {
  return (
    <div className="p-4 sm:p-6">
      <UsersListClient
        role="warehouse"
        title="Wholesaler Users"
        description="Manage wholesaler accounts and warehouse operators"
        columns={wholesalerColumns}
        emptyLabel="Wholesalers matching your current filters will appear here."
      />
    </div>
  );
}
