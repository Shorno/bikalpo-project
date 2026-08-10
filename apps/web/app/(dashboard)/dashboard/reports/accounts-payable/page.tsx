import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";
import ShopAccountsPayableReportPage from "@/app/shop/(management)/dashboard/reports/accounts-payable/page";

export default function DashboardAccountsPayableReportAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopAccountsPayableReportPage />
    </ShopDashboardShell>
  );
}
