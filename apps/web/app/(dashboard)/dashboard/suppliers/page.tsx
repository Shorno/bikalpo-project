import ShopSuppliersPage from "@/app/shop/(management)/dashboard/suppliers/page";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardSuppliersAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopSuppliersPage />
    </ShopDashboardShell>
  );
}
