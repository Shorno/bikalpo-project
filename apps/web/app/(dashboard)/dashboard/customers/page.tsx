import ShopCustomersPage from "@/app/shop/(management)/dashboard/customers/page";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardCustomersAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopCustomersPage />
    </ShopDashboardShell>
  );
}
