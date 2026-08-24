import ShopFinancePayablePage from "@/app/shop/(management)/dashboard/finance/payable/page";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardFinancePayableAliasPage() {
  return (
    <ShopDashboardShell>
      <ShopFinancePayablePage />
    </ShopDashboardShell>
  );
}
