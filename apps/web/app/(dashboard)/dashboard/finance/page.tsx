import ShopFinanceOverviewPage from "@/app/shop/(management)/dashboard/finance/page";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardFinanceAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopFinanceOverviewPage />
    </ShopDashboardShell>
  );
}
