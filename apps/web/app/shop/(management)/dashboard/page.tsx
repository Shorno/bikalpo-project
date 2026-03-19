"use client";

import {
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  ShoppingBag,
  Store,
  TrendingUp,
  Truck,
  User,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/use-shop-owner-api";
import { authClient } from "@/lib/auth-client";

export default function ShopOwnerDashboardPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  const user = session?.user as any;
  const loading = sessionLoading || statsLoading;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Shop Info Card */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
            <Store className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            {sessionLoading ? (
              <Skeleton className="h-6 w-48" />
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  {user?.shopName || user?.name || "My Shop"}
                  {user?.sellerStatus === "approved" && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  )}
                </h2>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span>{user?.ownerName || user?.name || "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-gray-400" />
                    <span className="capitalize">
                      {user?.businessType || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <span>{user?.shopAddress || "Not set"}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<ShoppingBag className="w-5 h-5 text-blue-600" />}
          label="Total Orders"
          value={loading ? null : String(stats?.totalOrders || 0)}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          label="Pending"
          value={loading ? null : String(stats?.pendingOrders || 0)}
          bg="bg-amber-50"
        />
        <StatCard
          icon={<Truck className="w-5 h-5 text-emerald-600" />}
          label="Delivered"
          value={loading ? null : String(stats?.deliveredOrders || 0)}
          bg="bg-emerald-50"
        />
        <StatCard
          icon={<Package className="w-5 h-5 text-purple-600" />}
          label="Retail Products"
          value={loading ? null : String(stats?.retailProducts || 0)}
          bg="bg-purple-50"
        />
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">
              Total Spent (B2B)
            </span>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-32 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">
              ৳{(stats?.totalSpent || 0).toLocaleString("en-BD")}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">
              Total Retail Stock
            </span>
          </div>
          {loading ? (
            <Skeleton className="h-7 w-32 mt-1" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">
              {(stats?.totalStock || 0).toLocaleString("en-BD")} units
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          {value === null ? (
            <Skeleton className="h-6 w-12 mt-0.5" />
          ) : (
            <p className="text-xl font-bold text-gray-900">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}
