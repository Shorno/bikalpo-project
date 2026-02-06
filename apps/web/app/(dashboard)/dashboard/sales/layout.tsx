import { requireSalesman } from "@/app/(dashboard)/dashboard/admin/_actions/auth/checkAuth";
import { SalesSidebar } from "@/components/dashboard/sales-sidebar";
import { SiteHeader } from "@/components/dashboard/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function SalesDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireSalesman();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <SalesSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
              {children}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
