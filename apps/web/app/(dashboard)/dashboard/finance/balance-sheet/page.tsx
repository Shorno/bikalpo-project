import { BalanceSheetReport } from "@/components/dashboard/finance/balance-sheet-report";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardBalanceSheetAliasPage() {
  return (
    <ShopDashboardShell>
      <BalanceSheetReport />
    </ShopDashboardShell>
  );
}
