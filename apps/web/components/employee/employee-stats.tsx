import {
  CheckCircle,
  Clock,
  FileText,
  Package,
  TrendingUp,
  Truck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EmployeeStatsProps {
  stats: any;
}

export function EmployeeStats({ stats }: EmployeeStatsProps) {
  if (!stats) return null;

  if (stats.role === "salesman") {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Estimates
            </CardTitle>
            <FileText className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.estimates.total}</div>
            <p className="text-muted-foreground text-xs">
              {stats.estimates.thisMonth} created this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Rate
            </CardTitle>
            <TrendingUp className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <p className="text-muted-foreground text-xs">
              {stats.estimates.converted} converted to orders
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
            <Clock className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.estimates.sent}</div>
            <p className="text-muted-foreground text-xs">
              Estimates waiting approval
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sales Value
            </CardTitle>
            <CheckCircle className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ৳{stats.estimates.convertedValue.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">
              From converted estimates
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stats.role === "deliveryman") {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Deliveries
            </CardTitle>
            <Truck className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveries.pending}</div>
            <p className="text-muted-foreground text-xs">
              Orders to deliver today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Today
            </CardTitle>
            <CheckCircle className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.deliveries.todayDelivered}
            </div>
            <p className="text-muted-foreground text-xs">
              Successful deliveries
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
            <p className="text-muted-foreground text-xs">
              {stats.deliveries.failed} failed deliveries total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Delivered
            </CardTitle>
            <Package className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.deliveries.delivered}
            </div>
            <p className="text-muted-foreground text-xs">
              Lifetime successful deliveries
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
