import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";
import ShopAccountsReceivableReportPage from "@/app/shop/(management)/dashboard/reports/accounts-receivable/page";

export default function DashboardAccountsReceivableReportAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopAccountsReceivableReportPage />
    </ShopDashboardShell>
  );
}
