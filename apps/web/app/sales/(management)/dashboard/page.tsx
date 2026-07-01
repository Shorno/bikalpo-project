import { LayoutDashboard } from "lucide-react";
import { EmployeeStats } from "@/components/employee/employee-stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { client } from "@/utils/orpc";

export const dynamic = "force-dynamic";

function formatStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function SalesDashboardPage() {
  let dashboardData:
    | Awaited<ReturnType<typeof client.salesman.getStats>>
    | undefined;

  try {
    dashboardData = await client.salesman.getStats();
  } catch (error) {
    console.error("Failed to load sales dashboard:", error);
  }

  const stats = dashboardData?.stats;
  const recentEstimates = stats?.recentEstimates ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <LayoutDashboard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Sales Dashboard
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Warehouse sales workspace
          </p>
        </div>
      </div>

      {stats ? (
        <>
          <EmployeeStats stats={stats} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Estimates</CardTitle>
            </CardHeader>
            <CardContent>
              {recentEstimates.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No recent estimates.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {recentEstimates.map((estimate) => (
                    <div
                      key={estimate.id}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {estimate.estimateNumber}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {estimate.customer?.shopName ||
                            estimate.customer?.name ||
                            "Customer"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge variant="secondary" className="text-xs">
                          {formatStatus(estimate.status)}
                        </Badge>
                        <span className="text-sm font-medium">
                          ৳{Number(estimate.total).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              Failed to load sales dashboard.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
