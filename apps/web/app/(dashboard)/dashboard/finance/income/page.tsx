import ShopFinanceIncomePage from "@/app/shop/(management)/dashboard/finance/income/page";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardFinanceIncomeAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopFinanceIncomePage />
    </ShopDashboardShell>
  );
}
