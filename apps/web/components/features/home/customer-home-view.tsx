import { CheckCircle2 } from "lucide-react";
import { CategoryTabs } from "@/components/features/home/category-tabs";
import { CustomerHero } from "@/components/features/home/customer-hero";
import { CustomerSidebar } from "@/components/features/home/customer-sidebar";
import CategoryListing from "@/components/features/products/category-listing";
import type { Session } from "@/lib/auth";

interface CustomerHomeViewProps {
  session: Session | null;
}

export async function CustomerHomeView({ session }: CustomerHomeViewProps) {
  const shopName = session?.user?.shopName || "Our Valued Partner";

  return (
    <div className="bg-[#f8f9fa] min-h-screen">
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              Welcome, <span className="text-emerald-700">{shopName}</span>
              <CheckCircle2 className="text-emerald-500 shrink-0" size={24} />
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                Approved User
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8">
            <CustomerHero />

            <CategoryTabs />

            <CategoryListing className="-mx-4 md:mx-0" />
          </div>

          <div className="lg:col-span-1">
            <CustomerSidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
