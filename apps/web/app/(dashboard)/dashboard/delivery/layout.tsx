import { requireDeliveryman } from "@/utils/auth";
import { SiteHeader } from "@/components/dashboard/site-header";
import { DeliverySidebar } from "@/components/features/delivery/DeliverySidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DeliveryDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireDeliveryman();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <DeliverySidebar variant="inset" />
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
