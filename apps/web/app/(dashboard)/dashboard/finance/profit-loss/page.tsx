import { ProfitLossReport } from "@/components/dashboard/finance/profit-loss-report";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardProfitLossAliasPage() {
  return (
    <ShopDashboardShell>
      <ProfitLossReport />
    </ShopDashboardShell>
  );
}
