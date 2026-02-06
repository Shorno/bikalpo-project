"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PerformanceChartsProps {
  employees: any[];
  roleFilter: "salesman" | "deliveryman";
}

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export function PerformanceCharts({
  employees,
  roleFilter,
}: PerformanceChartsProps) {
  // Top performers data
  const topPerformersData = employees
    .map((emp) => ({
      name: emp.name.split(" ")[0],
      completed: emp.convertedEstimates || emp.completedDeliveries || 0,
      total: emp.totalEstimates || emp.totalDeliveries || 0,
    }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 6);

  // Success rate data
  const successRateData = employees
    .map((emp) => ({
      name: emp.name.split(" ")[0],
      rate: emp.conversionRate || emp.successRate || 0,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 6);

  // Distribution data for pie chart
  const distributionData = employees
    .map((emp) => ({
      name: emp.name.split(" ")[0],
      value: emp.convertedEstimates || emp.completedDeliveries || 0,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (employees.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2">
      {/* Top Performers Chart */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top Performers</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topPerformersData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis fontSize={11} width={35} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar
                  dataKey="completed"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  name="Completed"
                />
                <Bar
                  dataKey="total"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  name="Total"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Success Rate Chart */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Success Rate Comparison</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={successRateData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis domain={[0, 100]} fontSize={11} width={35} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`${value}%`, "Success Rate"]}
                />
                <Bar
                  dataKey="rate"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  name="Success Rate (%)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Work Distribution Pie Chart */}
      {distributionData.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Work Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {distributionData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role-based Summary Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {roleFilter === "salesman" ? "Sales Summary" : "Delivery Summary"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-primary">
                  {employees.length}
                </div>
                <p className="text-xs text-muted-foreground">Total Staff</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-600">
                  {employees.reduce(
                    (sum, emp) =>
                      sum +
                      (emp.convertedEstimates || emp.completedDeliveries || 0),
                    0,
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-amber-600">
                  {employees.reduce((sum, emp) => {
                    const total =
                      emp.totalEstimates || emp.totalDeliveries || 0;
                    const completed =
                      emp.convertedEstimates || emp.completedDeliveries || 0;
                    return sum + (total - completed);
                  }, 0)}
                </div>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold">
                  {employees.length > 0
                    ? Math.round(
                        employees.reduce(
                          (sum, emp) =>
                            sum + (emp.conversionRate || emp.successRate || 0),
                          0,
                        ) / employees.length,
                      )
                    : 0}
                  %
                </div>
                <p className="text-xs text-muted-foreground">Avg Rate</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
