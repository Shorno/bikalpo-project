import ShopFinanceExpensesPage from "@/app/shop/(management)/dashboard/finance/expenses/page";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardFinanceExpensesAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopFinanceExpensesPage />
    </ShopDashboardShell>
  );
}
