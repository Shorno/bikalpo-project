import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";
import ShopReportsPage from "@/app/shop/(management)/dashboard/reports/page";

export default function DashboardReportsAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopReportsPage />
    </ShopDashboardShell>
  );
}
