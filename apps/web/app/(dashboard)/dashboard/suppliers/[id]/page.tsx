import SupplierDetailPage from "@/app/shop/(management)/dashboard/suppliers/[id]/page";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";

export default function DashboardSupplierDetailAliasPage() {
  return (
    <ShopDashboardShell>
      <SupplierDetailPage />
    </ShopDashboardShell>
  );
}
