import { format } from "date-fns";
import { CheckCircle, ClipboardList, Clock, Lightbulb } from "lucide-react";
import {
  getAllItemRequests,
  getItemRequestStats,
} from "@/actions/item-request/get-item-requests";
import { ProcessRequestDialog } from "@/components/features/item-request/process-request-dialog";
import { RequestStatusBadge } from "@/components/features/item-request/request-status-badge";
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

export default async function AdminItemRequestsPage() {
  const [requestsResult, statsResult] = await Promise.all([
    getAllItemRequests({ page: 1, limit: 50 }),
    getItemRequestStats(),
  ]);

  const requests = requestsResult.data?.requests || [];
  const stats = statsResult.data;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Item Requests</h1>
          <p className="text-muted-foreground">
            Manage customer requests for new products.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Requests
            </CardTitle>
            <ClipboardList className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="text-yellow-500 size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="text-green-500 size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.approved || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alternatives</CardTitle>
            <Lightbulb className="text-blue-500 size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.suggested || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
          <CardDescription>
            Review and process customer item requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No item requests found.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.requestNumber}
                    </TableCell>
                    <TableCell>
                      {format(new Date(request.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {request.customer?.name || "Unknown"}
                        </span>
                        {request.customer?.shopName && (
                          <span className="text-xs text-muted-foreground">
                            {request.customer.shopName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="max-w-50 truncate"
                      title={request.itemName}
                    >
                      {request.itemName}
                    </TableCell>
                    <TableCell>{request.brand || "-"}</TableCell>
                    <TableCell>{request.quantity}</TableCell>
                    <TableCell>
                      <RequestStatusBadge status={request.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" ? (
                        <ProcessRequestDialog request={request} />
                      ) : (
                        <Button variant="ghost" size="sm" disabled>
                          Processed
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
