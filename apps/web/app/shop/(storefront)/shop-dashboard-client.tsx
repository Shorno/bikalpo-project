"use client";

import { CheckCircle2 } from "lucide-react";
import { CustomerHomeProductTabs } from "@/components/features/home/customer-home-product-tabs";
import { ShopHero } from "@/components/features/home/customer-hero";
import { ShopSidebar } from "@/components/features/home/customer-sidebar";
import { DashboardVerifiedCustomersSection } from "@/components/features/home/dashboard-verified-customers-section";
import { useVerifiedUsersForHome } from "@/hooks/use-customer-api";

export function ShopDashboardClient({ shopName }: { shopName: string }) {
  const { data: verifiedUsersData } = useVerifiedUsersForHome();
  const verifiedUsers = verifiedUsersData?.users ?? [];

  return (
    <div>
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 md:text-3xl">
              Welcome, <span className="text-emerald-700">{shopName}</span>
              <CheckCircle2 className="shrink-0 text-emerald-500" size={24} />
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                Approved User
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4">
        <ShopHero />
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <CustomerHomeProductTabs />
          </div>
          <aside className="lg:col-span-1">
            <ShopSidebar />
          </aside>
        </div>
      </div>

      <DashboardVerifiedCustomersSection customers={verifiedUsers} />
    </div>
  );
}
