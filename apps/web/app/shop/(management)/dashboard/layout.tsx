import { ShopOwnerSidebar } from "@/components/dashboard/shop-owner-sidebar";
import { ShopPermissionGuard } from "@/components/dashboard/shop-permission-guard";
import { SiteHeader } from "@/components/dashboard/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function ShopDashboardShell({
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
              <ShopPermissionGuard>{children}</ShopPermissionGuard>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function ShopDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ShopDashboardShell>{children}</ShopDashboardShell>;
}
