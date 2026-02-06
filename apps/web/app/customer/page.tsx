import { CheckCircle2 } from "lucide-react";
import { getVerifiedUsersForHome } from "@/actions/users/get-verified-users";
import { getSession } from "@/app/(dashboard)/dashboard/admin/_actions/auth/checkAuth";
import { CategoryTabs } from "@/components/features/home/category-tabs";
import { CustomerHero } from "@/components/features/home/customer-hero";
import { CustomerSidebar } from "@/components/features/home/customer-sidebar";
import { DashboardVerifiedCustomersSection } from "@/components/features/home/dashboard-verified-customers-section";
import CategoryListing from "@/components/features/products/category-listing";

export default async function CustomerDashboardPage() {
  // Use allSettled so page still renders when DB is unreachable (e.g. migrations not run)
  const [sessionResult, verifiedResult] = await Promise.allSettled([
    getSession(),
    getVerifiedUsersForHome(),
  ]);
  const session =
    sessionResult.status === "fulfilled" ? sessionResult.value : null;
  const verifiedUsers =
    verifiedResult.status === "fulfilled"
      ? (verifiedResult.value.data ?? [])
      : [];
  const shopName = session?.user?.shopName || "Our Valued Partner";

  return (
    <div>
      {/* Full-width header section */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
      </div>

      {/* Full-width hero */}
      <div className="container mx-auto px-4">
        <CustomerHero />
      </div>

      {/* Full-width category tabs */}
      <div className="container mx-auto px-4 mt-6">
        <CategoryTabs />
      </div>

      {/* Grid section with sidebar */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Products section */}
          <div className="lg:col-span-3">
            <CategoryListing />
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <CustomerSidebar />
          </aside>
        </div>
      </div>

      {/* Verified Customers Section */}
      <DashboardVerifiedCustomersSection customers={verifiedUsers} />
    </div>
  );
}
