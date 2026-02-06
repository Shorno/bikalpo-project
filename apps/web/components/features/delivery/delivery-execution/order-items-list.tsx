import { Package } from "lucide-react";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import type { DeliveryInvoiceItem } from "./types";

interface OrderItemsListProps {
  items: DeliveryInvoiceItem[];
}

function OrderItemRow({ item }: { item: DeliveryInvoiceItem }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {item.productImage ? (
        <Image
          src={item.productImage}
          alt={item.productName}
          width={40}
          height={40}
          className="rounded object-cover shrink-0"
        />
      ) : (
        <div className="size-10 rounded bg-muted flex items-center justify-center shrink-0">
          <Package className="size-4 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.productName}</p>
        {item.productSku && (
          <p className="text-xs text-muted-foreground">{item.productSku}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm">×{item.quantity}</p>
        <p className="text-xs text-muted-foreground">
          ৳{Number(item.lineTotal).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export function OrderItemsList({ items }: OrderItemsListProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="mt-3">
      <Separator className="mb-3" />
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Products ({items.length})
      </p>
      <div className="divide-y">
        {items.map((item) => (
          <OrderItemRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
