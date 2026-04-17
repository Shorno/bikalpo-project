import { UserListClient } from "../users-client";

export default function WholesalersPage() {
  return (
    <UserListClient
      role="warehouse"
      title="Wholesaler Users"
      description="Manage wholesaler accounts and warehouse operators"
    />
  );
}
