import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";
import ShopSalesReportPage from "@/app/shop/(management)/dashboard/reports/sales/page";

export default function DashboardSalesReportAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopSalesReportPage />
    </ShopDashboardShell>
  );
}
