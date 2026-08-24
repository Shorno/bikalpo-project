import { CategoriesManager } from "@/components/dashboard/finance/categories-manager";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardCategoriesAliasPage() {
  return (
    <ShopDashboardShell>
      <CategoriesManager />
    </ShopDashboardShell>
  );
}
