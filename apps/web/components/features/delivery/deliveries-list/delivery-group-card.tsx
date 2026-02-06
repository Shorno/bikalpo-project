import { format } from "date-fns";
import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DELIVERY_BASE } from "@/lib/routes";
import { InvoiceRow } from "./invoice-row";
import { StatusBadge } from "./status-badge";
import type { DeliveryGroupCardProps } from "./types";

export function DeliveryGroupCard({ group }: DeliveryGroupCardProps) {
  return (
    <Card className="overflow-hidden p-0 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
      {/* Compact Header */}
      <CardHeader className="bg-muted/50 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-semibold truncate">
                {group.groupName}
              </h3>
              <StatusBadge status={group.status} type="group" />
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              {format(new Date(group.assignedAt!), "MMM d, yyyy")}
            </p>
          </div>
          <Button
            size="sm"
            className="h-8 text-xs px-3 shrink-0 shadow-sm"
            asChild
          >
            <Link href={`${DELIVERY_BASE}/deliveries/${group.id}`}>
              <span className="hidden sm:inline">View Details</span>
              <span className="sm:hidden">View</span>
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Mobile: Compact card list */}
        <div className="sm:hidden divide-y">
          {group.invoices.map((item) => (
            <div
              key={item.id}
              className="p-3 space-y-1.5 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant="outline"
                    className="h-6 w-6 p-0 justify-center text-xs shrink-0 rounded-full"
                  >
                    {item.sequence}
                  </Badge>
                  <span className="text-sm font-medium truncate">
                    {item.invoice.invoiceNumber}
                  </span>
                </div>
                <StatusBadge status={item.status} type="invoice" />
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate font-medium text-foreground">
                  {item.invoice.customer?.name}
                </span>
                <span>•</span>
                <span>{item.invoice.customer?.phoneNumber}</span>
              </div>
              {item.invoice.order && (
                <div className="flex items-start gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                  <span className="line-clamp-1">
                    {item.invoice.order.shippingAddress},{" "}
                    {item.invoice.order.shippingCity}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop: Table view */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[50px] text-center font-semibold">
                  #
                </TableHead>
                <TableHead className="font-semibold">Invoice</TableHead>
                <TableHead className="font-semibold">Address</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.invoices.map((item, index) => (
                <InvoiceRow key={item.id} item={item} index={index} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
