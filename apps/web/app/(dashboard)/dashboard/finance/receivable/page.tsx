import ShopFinanceReceivablePage from "@/app/shop/(management)/dashboard/finance/receivable/page";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardFinanceReceivableAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopFinanceReceivablePage />
    </ShopDashboardShell>
  );
}
