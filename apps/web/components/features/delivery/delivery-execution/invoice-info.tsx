import { MapPin, Phone, User } from "lucide-react";
import type { DeliveryInvoiceWithDetails } from "./types";

interface InvoiceInfoProps {
  item: DeliveryInvoiceWithDetails;
}

export function InvoiceInfo({ item }: InvoiceInfoProps) {
  const { invoice } = item;
  const order = invoice.order;
  const customer = invoice.customer;

  return (
    <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
      {/* Receiver Info */}
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-muted-foreground" />
        <span className="font-medium truncate">
          {order?.shippingName || customer?.name}
          {customer?.shopName && (
            <span className="text-muted-foreground font-normal">
              {" "}
              • {customer.shopName}
            </span>
          )}
        </span>
      </div>

      {/* Address */}
      {order && (
        <div className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm">
          <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 mt-0.5 text-muted-foreground" />
          <span className="line-clamp-2">
            {order.shippingAddress}, {order.shippingCity}
            {order.shippingArea && `, ${order.shippingArea}`}
          </span>
        </div>
      )}

      {/* Phone */}
      {order?.shippingPhone && (
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
          <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
          <a
            href={`tel:${order.shippingPhone}`}
            className="text-primary hover:underline font-medium"
          >
            {order.shippingPhone}
          </a>
        </div>
      )}

      {/* Amount */}
      <div className="text-xs sm:text-sm font-semibold text-primary bg-primary/10 rounded-md px-2 py-1 inline-block">
        Collect: ৳{Number(invoice.grandTotal).toLocaleString()}
      </div>
    </div>
  );
}
