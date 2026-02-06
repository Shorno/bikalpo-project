"use client";

import { useQuery } from "@tanstack/react-query";
import { getEmployeeDetailedReport } from "@/actions/reports/employee-reports";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface BaseEmployee {
  id: string;
  name: string;
  email: string;
  role: "salesman" | "deliveryman";
}

interface SalesmanEmployee extends BaseEmployee {
  role: "salesman";
  totalEstimates: number;
  convertedEstimates: number;
  approvedEstimates: number;
  conversionRate: number;
  totalSalesValue: number;
  avgOrderValue: number;
}

interface DeliverymanEmployee extends BaseEmployee {
  role: "deliveryman";
  totalDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  avgDeliveriesPerDay: number;
}

type Employee = SalesmanEmployee | DeliverymanEmployee;

interface TopCustomer {
  shopName?: string;
  name?: string;
  count: number;
  value: number;
}

interface TopArea {
  area: string;
  count: number;
}

interface EmployeeDetailModalProps {
  employee: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeDetailModal({
  employee,
  open,
  onOpenChange,
}: EmployeeDetailModalProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: detailedReport, isLoading } = useQuery<any>({
    queryKey: ["employee-detailed-report", employee?.id],
    queryFn: async () => {
      const result = await getEmployeeDetailedReport(employee.id);
      return result.success && "report" in result ? result.report : null;
    },
    enabled: open && !!employee?.id,
  });

  const successRate =
    employee.role === "salesman"
      ? employee.conversionRate
      : employee.successRate;
  const rating =
    successRate >= 90
      ? 5
      : successRate >= 80
        ? 4
        : successRate >= 70
          ? 3
          : successRate >= 60
            ? 2
            : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Employee Performance Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{employee.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{employee.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Employee Type</p>
                  <Badge
                    variant={
                      employee.role === "salesman" ? "default" : "secondary"
                    }
                  >
                    {employee.role === "salesman" ? "Salesman" : "Deliveryman"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="default">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Work Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Work Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {employee.role === "salesman" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Estimates
                    </p>
                    <p className="text-2xl font-bold">
                      {employee.totalEstimates || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Converted</p>
                    <p className="text-2xl font-bold text-green-600">
                      {employee.convertedEstimates || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {employee.approvedEstimates || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Conversion Rate
                    </p>
                    <p className="text-2xl font-bold">
                      {employee.conversionRate || 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Sales Value
                    </p>
                    <p className="text-2xl font-bold">
                      ৳{(employee.totalSalesValue || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Avg Order Value
                    </p>
                    <p className="text-2xl font-bold">
                      ৳{(employee.avgOrderValue || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Deliveries
                    </p>
                    <p className="text-2xl font-bold">
                      {employee.totalDeliveries || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-2xl font-bold text-green-600">
                      {employee.completedDeliveries || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold text-red-600">
                      {employee.failedDeliveries || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Success Rate
                    </p>
                    <p className="text-2xl font-bold">
                      {employee.successRate || 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Avg Deliveries/Day
                    </p>
                    <p className="text-2xl font-bold">
                      {employee.avgDeliveriesPerDay || 0}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Rating */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`text-2xl ${
                        i < rating ? "text-yellow-400" : "text-gray-300"
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-lg font-medium">
                  {rating.toFixed(1)} / 5.0
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Based on {successRate}% success rate
              </p>
            </CardContent>
          </Card>

          {/* Detailed Report Data */}
          {!isLoading && detailedReport && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Insights</CardTitle>
              </CardHeader>
              <CardContent>
                {employee.role === "salesman" &&
                  "topCustomers" in detailedReport && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Pending Estimates
                          </p>
                          <p className="text-xl font-bold">
                            {(detailedReport.summary as { pending?: number })
                              .pending || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Rejected Estimates
                          </p>
                          <p className="text-xl font-bold text-red-600">
                            {(detailedReport.summary as { rejected?: number })
                              .rejected || 0}
                          </p>
                        </div>
                      </div>

                      {"topCustomers" in detailedReport &&
                        (detailedReport.topCustomers as TopCustomer[])?.length >
                          0 && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-sm font-medium mb-2">
                                Top Customers
                              </p>
                              <div className="space-y-2">
                                {(detailedReport.topCustomers as TopCustomer[])
                                  .slice(0, 3)
                                  .map((customer, i) => (
                                    <div
                                      key={i}
                                      className="flex justify-between items-center"
                                    >
                                      <span className="text-sm">
                                        {customer.shopName || customer.name}
                                      </span>
                                      <Badge variant="secondary">
                                        {customer.count} orders - ৳
                                        {customer.value.toLocaleString()}
                                      </Badge>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </>
                        )}
                    </div>
                  )}

                {employee.role === "deliveryman" &&
                  "topAreas" in detailedReport && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Total Groups
                          </p>
                          <p className="text-xl font-bold">
                            {(
                              detailedReport.summary as { totalGroups?: number }
                            ).totalGroups || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Completed Groups
                          </p>
                          <p className="text-xl font-bold text-green-600">
                            {(
                              detailedReport.summary as {
                                completedGroups?: number;
                              }
                            ).completedGroups || 0}
                          </p>
                        </div>
                      </div>

                      {"topAreas" in detailedReport &&
                        (detailedReport.topAreas as TopArea[])?.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-sm font-medium mb-2">
                                Top Delivery Areas
                              </p>
                              <div className="space-y-2">
                                {(detailedReport.topAreas as TopArea[])
                                  .slice(0, 3)
                                  .map((area, i) => (
                                    <div
                                      key={i}
                                      className="flex justify-between items-center"
                                    >
                                      <span className="text-sm">
                                        {area.area}
                                      </span>
                                      <Badge variant="secondary">
                                        {area.count} deliveries
                                      </Badge>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </>
                        )}
                    </div>
                  )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
