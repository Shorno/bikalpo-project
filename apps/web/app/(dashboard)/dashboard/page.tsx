import { headers } from "next/headers";
import { ShopDashboardShell } from "@/app/shop/(management)/dashboard/layout";
import ShopOwnerDashboardPage from "@/app/shop/(management)/dashboard/page";
import { DashboardRedirectClient } from "./dashboard-redirect-client";

export default async function DashboardPage() {
  const host = (await headers()).get("host") || "";

  if (host.startsWith("shop.")) {
    return (
      <ShopDashboardShell>
        <ShopOwnerDashboardPage />
      </ShopDashboardShell>
    );
  }

  return <DashboardRedirectClient />;
}
