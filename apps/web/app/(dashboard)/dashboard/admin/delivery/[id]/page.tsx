import { format } from "date-fns";
import { ArrowLeft, MapPin, Phone, Truck } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeliveryGroupById } from "@/actions/delivery/delivery-management";
import { AssignDeliverymanDialog } from "@/components/features/delivery/assign-deliveryman-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/lib/auth";

export default async function DeliveryGroupDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const _session = await auth.api.getSession({
    headers: await headers(),
  });

  const { id } = await params;
  const result = await getDeliveryGroupById(Number(id));

  if (!result.success || !result.group) {
    notFound();
  }

  const { group } = result;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild className="h-9 w-9">
            <Link href="/dashboard/admin/delivery">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/dashboard/admin/delivery"
              className="hover:text-foreground transition-colors"
            >
              Delivery Groups
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">
              {group.groupName}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {group.groupName}
              </h1>
              <Badge variant="outline" className="uppercase">
                {group.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Created on {format(new Date(group.createdAt), "PPP")}
            </p>
          </div>
          {!group.deliverymanId && (
            <AssignDeliverymanDialog
              groupId={group.id}
              orderShippingArea={
                group.invoices?.[0]?.invoice?.order?.shippingArea ?? undefined
              }
              trigger={
                <Button>
                  <Truck className="mr-2 size-4" />
                  Assign Deliveryman
                </Button>
              }
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Seq</TableHead>
                    <TableHead>Invoice Details</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.invoices?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-center">
                        <div className="flex items-center justify-center size-6 rounded-full bg-muted text-xs">
                          {item.sequence}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {item.invoice.invoiceNumber}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ৳{Number(item.invoice.grandTotal).toLocaleString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {item.invoice.customer?.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.invoice.customer?.phoneNumber}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col max-w-[200px]">
                          <span className="text-sm truncate">
                            {item.invoice.order?.shippingAddress}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="size-3" />
                            {item.invoice.order?.shippingCity}
                            {item.invoice.order?.shippingArea &&
                              `, ${item.invoice.order.shippingArea}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "delivered"
                              ? "default"
                              : item.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                          className="uppercase"
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {group.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{group.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deliveryman</CardTitle>
            </CardHeader>
            <CardContent>
              {group.deliveryman ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-muted flex items-center justify-center">
                      <Truck className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {group.deliveryman.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {group.deliveryman.email}
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="size-4 text-muted-foreground" />
                    <span>{group.deliveryman.phoneNumber}</span>
                  </div>
                  {group.assignedAt && (
                    <div className="text-xs text-muted-foreground">
                      Assigned on{" "}
                      {format(new Date(group.assignedAt), "MMM d, h:mm a")}
                    </div>
                  )}
                  {"vehicleType" in group && group.vehicleType && (
                    <div className="text-xs text-muted-foreground">
                      Vehicle: {String(group.vehicleType)}
                    </div>
                  )}
                  {"expectedDeliveryAt" in group &&
                    group.expectedDeliveryAt && (
                      <div className="text-xs text-muted-foreground">
                        Expected:{" "}
                        {format(
                          new Date(group.expectedDeliveryAt as string | Date),
                          "PPP",
                        )}
                      </div>
                    )}
                  {group.status !== "completed" && (
                    <AssignDeliverymanDialog
                      groupId={group.id}
                      orderShippingArea={
                        group.invoices?.[0]?.invoice?.order?.shippingArea ??
                        undefined
                      }
                      trigger={
                        <Button variant="outline" size="sm" className="w-full">
                          Change Deliveryman
                        </Button>
                      }
                    />
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No deliveryman assigned
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Invoices</span>
                <span className="font-medium">{group.totalInvoices}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium text-green-600">
                  {group.completedInvoices}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-medium">
                <span>Total Value</span>
                <span>
                  ৳
                  {(group.invoices || [])
                    .reduce(
                      (sum, inv) => sum + Number(inv.invoice.grandTotal),
                      0,
                    )
                    .toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
