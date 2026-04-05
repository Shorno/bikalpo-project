export const dynamic = "force-dynamic";

import { requireDeliveryman } from "@/utils/auth";
import { DeliverymanMobileNav } from "@/components/dashboard/deliveryman-mobile-nav";

export default async function DeliverymanDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireDeliveryman();

  return (
    <div className="min-h-screen bg-gray-50">
      <DeliverymanMobileNav />
      <main className="pb-20 pt-1">
        {children}
      </main>
    </div>
  );
}
