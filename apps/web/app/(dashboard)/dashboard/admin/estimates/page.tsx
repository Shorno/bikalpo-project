import { format } from "date-fns";
import Link from "next/link";
import {
  getAdminEstimateStats,
  getAllEstimates,
} from "@/actions/estimate/admin-estimate-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminEstimatesPage() {
  const { estimates } = await getAllEstimates();
  const { stats } = await getAdminEstimateStats();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Estimates Management
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Estimates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">Across all salesmen</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats?.pendingReview || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting admin action
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Approved Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.byStatus?.approved?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Total approved items
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ৳{Number(stats?.byStatus?.approved?.value || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              From approved estimates
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estimate #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Salesman</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {estimates?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No estimates found.
                </TableCell>
              </TableRow>
            ) : (
              estimates?.map((estimate) => {
                const needsReview = estimate.status === "pending";
                return (
                  <TableRow key={estimate.id}>
                    <TableCell className="font-medium">
                      {estimate.estimateNumber}
                    </TableCell>
                    <TableCell>
                      {format(new Date(estimate.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {estimate.salesman?.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {estimate.customer?.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {estimate.customer?.shopName ||
                            estimate.customer?.phoneNumber}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          estimate.status === "approved" ||
                          estimate.status === "converted"
                            ? "default"
                            : estimate.status === "rejected"
                              ? "destructive"
                              : estimate.status === "sent"
                                ? "secondary"
                                : "outline"
                        }
                      >
                        {estimate.status.charAt(0).toUpperCase() +
                          estimate.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      ৳{Number(estimate.total).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={needsReview ? "default" : "outline"}
                        size="sm"
                        asChild
                      >
                        <Link
                          href={`/dashboard/admin/estimates/${estimate.id}`}
                        >
                          {needsReview ? "Review" : "Details"}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
