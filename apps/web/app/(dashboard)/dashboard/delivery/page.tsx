import { Bike, LayoutDashboard, RotateCcw } from "lucide-react";
import Link from "next/link";
import { getEmployeeStats } from "@/actions/employee/get-employee-stats";
import { ActiveDeliveryGroups } from "@/components/employee/active-delivery-groups";
import { DeliveryStats } from "@/components/employee/delivery-stats";
import { Card, CardContent } from "@/components/ui/card";
import type { DeliverymanStats } from "@/db/schema/delivery";
import { DELIVERY_BASE } from "@/lib/routes";

export default async function DeliveryDashboardPage() {
  const statsResult = await getEmployeeStats();
  const stats = statsResult.success
    ? (statsResult.stats as DeliverymanStats)
    : null;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Compact Header with Icon */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <LayoutDashboard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Delivery Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage your deliveries and returns
          </p>
        </div>
      </div>

      {/* Active Delivery Groups */}
      <ActiveDeliveryGroups groups={stats?.activeGroups || []} />

      {/* Quick Actions Row */}
      <div className="grid grid-cols-2 gap-3">
        <Link href={`${DELIVERY_BASE}/deliveries`}>
          <Card className="hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer h-full p-0 rounded-xl overflow-hidden">
            <CardContent className="flex items-center justify-center gap-2 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Bike className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">All Deliveries</span>
            </CardContent>
          </Card>
        </Link>

        <Link href={`${DELIVERY_BASE}/returns`}>
          <Card className="hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer h-full p-0 rounded-xl overflow-hidden">
            <CardContent className="flex items-center justify-center gap-2 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <RotateCcw className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Returns</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide font-medium">
            Performance Overview
          </p>
          <DeliveryStats
            stats={stats.deliveries}
            successRate={stats.successRate}
          />
        </div>
      )}
    </div>
  );
}
