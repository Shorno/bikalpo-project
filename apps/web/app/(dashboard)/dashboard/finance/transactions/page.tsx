import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";
import { TransactionsPage } from "@/components/dashboard/finance/transactions-page";

export default function DashboardTransactionsAliasPage() {
  return (
    <ShopDashboardShell>
      <TransactionsPage />
    </ShopDashboardShell>
  );
}
