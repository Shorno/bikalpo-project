import { format } from "date-fns";
import { Eye, RotateCcw } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { getReturns } from "@/actions/returns/return-processing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { ADMIN_BASE } from "@/lib/routes";

export default async function AdminReturnsPage() {
  const _session = await auth.api.getSession({
    headers: await headers(),
  });

  // Get all returns (without filters for now to see all)
  const { returns } = await getReturns();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Return Requests</h1>
          <p className="text-muted-foreground">
            Manage and process return requests from customers/deliverymen.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Requests
            </CardTitle>
            <RotateCcw className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {returns?.filter((r) => r.status === "pending").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Returns</CardTitle>
          <CardDescription>List of all return requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No return requests found.
                  </TableCell>
                </TableRow>
              ) : (
                returns?.map((ret) => {
                  // Calculate items count from the return items array
                  const returnItems =
                    (ret.items as Array<{ quantity: number }>) || [];
                  const returnedItemsCount = returnItems.reduce(
                    (sum, item) => sum + (item.quantity || 0),
                    0,
                  );
                  const submitter = (ret as any).submitter;

                  return (
                    <TableRow key={ret.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`${ADMIN_BASE}/returns/${ret.id}`}
                          className="hover:underline"
                        >
                          {ret.order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {format(new Date(ret.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{ret.user.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {ret.user.phoneNumber || ret.user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {submitter ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-blue-600">
                              {submitter.name}
                            </span>
                            {submitter.phoneNumber && (
                              <span className="text-xs text-muted-foreground">
                                {submitter.phoneNumber}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium text-amber-600">
                          {returnedItemsCount}
                        </span>
                        <span className="text-muted-foreground text-xs ml-1">
                          {ret.returnType === "full" ? "(Full)" : "pcs"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          ৳{Number(ret.totalAmount).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ret.status === "processed"
                              ? "default"
                              : ret.status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                          className="capitalize"
                        >
                          {ret.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`${ADMIN_BASE}/returns/${ret.id}`}>
                            <Eye className="mr-1.5 size-3.5" />
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
