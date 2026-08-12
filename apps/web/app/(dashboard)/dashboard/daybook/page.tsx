import { DaybookKpiPage } from "@/components/dashboard/daybook/daybook-kpi-page";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardDaybookAliasPage() {
  return (
    <ShopDashboardShell>
      <DaybookKpiPage variant="retailer" />
    </ShopDashboardShell>
  );
}
