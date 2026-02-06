import { format } from "date-fns";
import { Clock, Eye, MapPin, Package, Truck } from "lucide-react";
import Link from "next/link";
import { getDeliveryGroups } from "@/actions/delivery/delivery-management";
import { CreateGroupDialog } from "@/components/features/delivery/create-group-dialog";
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

export default async function AdminDeliveryPage() {
  const { groups } = await getDeliveryGroups();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "partial":
        return "warning";
      case "out_for_delivery":
        return "info";
      case "assigned":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Delivery Management
          </h1>
          <p className="text-muted-foreground">
            Manage delivery groups and assignments for deliverymen.
          </p>
        </div>
        <CreateGroupDialog />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Assigned Groups
            </CardTitle>
            <Clock className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {groups?.filter((g) => g.status === "assigned").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Deliveries
            </CardTitle>
            <Truck className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {groups?.filter((g) =>
                ["assigned", "out_for_delivery"].includes(g.status),
              ).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Today
            </CardTitle>
            <Package className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {groups?.filter(
                (g) =>
                  g.status === "completed" &&
                  g.completedAt &&
                  new Date(g.completedAt).toDateString() ===
                    new Date().toDateString(),
              ).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Delivery Groups</CardTitle>
          <CardDescription>
            Recent delivery groups and their status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Invoices</TableHead>
                <TableHead>Deliveryman</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No delivery groups found.
                  </TableCell>
                </TableRow>
              ) : (
                groups?.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{group.groupName}</span>
                        {group.invoices && group.invoices.length > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="size-3" />
                            {group.invoices[0]?.invoice?.order?.shippingCity}
                            {group.invoices.length > 1 &&
                              ` +${group.invoices.length - 1} more`}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(group.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {group.completedInvoices}/{group.totalInvoices}{" "}
                        Completed
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {group.deliveryman ? (
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {group.deliveryman.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {group.deliveryman.phoneNumber}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusColor(group.status) as any}
                        className="uppercase"
                      >
                        {group.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/admin/delivery/${group.id}`}>
                          <Eye className="size-4" />
                          <span className="sr-only">View</span>
                        </Link>
                      </Button>
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
