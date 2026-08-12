import LedgerPage from "@/app/shop/(management)/dashboard/finance/ledger/page";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardTrialBalanceAliasPage() {
  return (
    <ShopDashboardShell>
      <LedgerPage />
    </ShopDashboardShell>
  );
}
