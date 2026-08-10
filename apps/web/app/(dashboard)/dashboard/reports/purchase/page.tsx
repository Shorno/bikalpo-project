import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";
import ShopPurchaseReportPage from "@/app/shop/(management)/dashboard/reports/purchase/page";

export default function DashboardPurchaseReportAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopPurchaseReportPage />
    </ShopDashboardShell>
  );
}
