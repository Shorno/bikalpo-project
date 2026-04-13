import { UserListClient } from "../users-client";

export default function RetailersPage() {
  return (
    <UserListClient
      role="shop_owner"
      title="Retailer Users"
      description="Manage retailer accounts and shop owners"
    />
  );
}
