"use client";

import { ChevronDown, Package } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import type { DeliveryInvoiceItem } from "./types";

interface InvoiceItemsListProps {
  items: DeliveryInvoiceItem[];
}

function InvoiceItemRow({ item }: { item: DeliveryInvoiceItem }) {
  const unitPrice = Number(item.unitPrice || 0);
  const lineTotal = Number(item.lineTotal || 0);

  return (
    <div className="grid gap-3 px-3 py-3 sm:grid-cols-[56px_minmax(0,1fr)_180px] sm:items-center">
      <div className="flex items-start gap-3 sm:contents">
        {item.productImage ? (
          <Image
            src={item.productImage}
            alt={item.productName}
            width={56}
            height={56}
            className="size-14 rounded-lg border object-cover shrink-0 bg-muted"
          />
        ) : (
          <div className="size-14 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
            <Package className="size-5 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">
                {item.productName}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {item.productSku ? `SKU: ${item.productSku}` : "No SKU"}
              </p>
            </div>
            <Badge
              variant="outline"
              className="shrink-0 rounded-full bg-background text-xs sm:hidden"
            >
              Qty {item.quantity}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 rounded-lg bg-muted/35 p-1 text-xs ring-1 ring-border/60">
        <div className="rounded-md px-2.5 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Unit
          </p>
          <p className="mt-0.5 font-semibold">৳{unitPrice.toLocaleString()}</p>
        </div>
        <div className="rounded-md border-x border-border/60 px-2.5 py-1.5 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Qty
          </p>
          <p className="mt-0.5 font-semibold">x{item.quantity}</p>
        </div>
        <div className="rounded-md px-2.5 py-1.5 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total
          </p>
          <p className="mt-0.5 font-bold text-primary">
            ৳{lineTotal.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export function InvoiceItemsList({ items }: InvoiceItemsListProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!items || items.length === 0) {
    return null;
  }

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + Number(item.lineTotal || 0),
    0,
  );

  return (
    <div className="mt-3">
      <Separator className="mb-3" />
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="overflow-hidden rounded-xl border bg-background">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 bg-muted/30 px-3 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Products</p>
                  <p className="text-xs text-muted-foreground">
                    {items.length} item{items.length === 1 ? "" : "s"} ·{" "}
                    {totalQuantity} unit{totalQuantity === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">
                    ৳{totalAmount.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {isOpen ? "Hide" : "View"} details
                  </p>
                </div>
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="divide-y">
              {items.map((item) => (
                <InvoiceItemRow key={item.id} item={item} />
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
