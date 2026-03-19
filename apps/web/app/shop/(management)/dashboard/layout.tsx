import { ShopOwnerSidebar } from "@/components/dashboard/shop-owner-sidebar";
import { SiteHeader } from "@/components/dashboard/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TrialBanner } from "@/components/features/subscription/trial-banner";
import { SubscriptionGuard } from "@/components/features/subscription/subscription-guard";

export default function ShopDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <ShopOwnerSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
              <TrialBanner />
              <SubscriptionGuard>{children}</SubscriptionGuard>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
