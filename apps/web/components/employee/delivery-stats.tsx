"use client";

import {
  Banknote,
  CheckCircle2,
  Clock,
  Package,
  RotateCcw,
  TrendingUp,
  Truck,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeliveryStatsCount } from "@/db/schema/delivery";

interface DeliveryStatsProps {
  stats: DeliveryStatsCount;
  successRate: number;
}

export function DeliveryStats({ stats, successRate }: DeliveryStatsProps) {
  return (
    <div className="space-y-3">
      {/* Main Stats Row - 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {/* Today's Deliveries */}
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-4 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Today's
            </CardTitle>
            <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">
              {stats.todayDelivered}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
              {stats.todayFailed > 0 ? (
                <span className="text-red-600">{stats.todayFailed} failed</span>
              ) : (
                "No failures"
              )}
            </p>
          </CardContent>
        </Card>

        {/* Pending Deliveries */}
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-4 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Pending
            </CardTitle>
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-yellow-600">
              {stats.pending}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Awaiting
            </p>
          </CardContent>
        </Card>

        {/* Active Groups */}
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-4 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Active
            </CardTitle>
            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-blue-600">
              {stats.activeGroups}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Groups
            </p>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1 sm:p-4 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Success
            </CardTitle>
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-green-600">
              {successRate}%
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats - 4 column grid for delivery/return stats */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-3 sm:grid-cols-4">
        {/* Total Delivered */}
        <Card className="bg-green-50/80 p-0">
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col items-center text-center gap-0.5">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              <p className="text-base sm:text-xl font-bold text-green-700">
                {stats.delivered}
              </p>
              <p className="text-[9px] sm:text-xs text-green-600/80">
                Delivered
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Failed */}
        <Card className="bg-red-50/80 p-0">
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col items-center text-center gap-0.5">
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
              <p className="text-base sm:text-xl font-bold text-red-700">
                {stats.failed}
              </p>
              <p className="text-[9px] sm:text-xs text-red-600/80">Failed</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Returns - As per requirements lines 4560-4666 */}
        <Card className="bg-amber-50/80 p-0">
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col items-center text-center gap-0.5">
              <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
              <p className="text-base sm:text-xl font-bold text-amber-700">
                {stats.totalReturns}
              </p>
              <p className="text-[9px] sm:text-xs text-amber-600/80">Returns</p>
            </div>
          </CardContent>
        </Card>

        {/* Return Amount Processed - As per requirements lines 4560-4666 */}
        <Card className="bg-purple-50/80 p-0">
          <CardContent className="p-2 sm:p-3">
            <div className="flex flex-col items-center text-center gap-0.5">
              <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
              <p className="text-base sm:text-xl font-bold text-purple-700">
                ৳{stats.returnAmountProcessed.toLocaleString()}
              </p>
              <p className="text-[9px] sm:text-xs text-purple-600/80">
                Returned
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
