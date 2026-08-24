import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";
import ShopProfitLossReportPage from "@/app/shop/(management)/dashboard/reports/profit-loss/page";

export default function DashboardProfitLossReportAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopProfitLossReportPage />
    </ShopDashboardShell>
  );
}
