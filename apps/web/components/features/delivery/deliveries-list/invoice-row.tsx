import { MapPin } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./status-badge";
import type { InvoiceRowProps } from "./types";

export function InvoiceRow({
  item,
  index,
}: InvoiceRowProps & { index?: number }) {
  return (
    <TableRow
      className={`hover:bg-primary/5 transition-colors ${index !== undefined && index % 2 !== 0 ? "bg-muted/20" : ""}`}
    >
      <TableCell className="text-center font-medium">{item.sequence}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{item.invoice.invoiceNumber}</span>
          <span className="text-xs text-muted-foreground">
            {item.invoice.customer?.name} ({item.invoice.customer?.phoneNumber})
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-start gap-2 max-w-[300px]">
          <MapPin className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
          <span className="text-sm truncate">
            {item.invoice.order?.shippingAddress},{" "}
            {item.invoice.order?.shippingCity}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={item.status} type="invoice" />
      </TableCell>
    </TableRow>
  );
}
