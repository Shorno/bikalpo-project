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
    <div className="flex items-center gap-3 py-3 sm:grid sm:grid-cols-[48px_1fr_auto] sm:gap-4">
      {item.productImage ? (
        <Image
          src={item.productImage}
          alt={item.productName}
          width={48}
          height={48}
          className="size-12 rounded-lg border object-cover shrink-0 bg-muted"
        />
      ) : (
        <div className="size-12 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
          <Package className="size-5 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">
          {item.productName}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{item.productSku ? `SKU: ${item.productSku}` : "No SKU"}</span>
          <span>•</span>
          <span>Qty {item.quantity}</span>
          <span className="sm:hidden">•</span>
          <span className="sm:hidden">৳{unitPrice.toLocaleString()}</span>
        </div>
      </div>

      <div className="shrink-0 text-right sm:grid sm:grid-cols-[100px_60px_100px] sm:items-center sm:gap-4">
        {/* On desktop: Unit Price */}
        <div className="hidden sm:block text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Unit</p>
          <p className="mt-0.5 text-xs text-foreground">৳{unitPrice.toLocaleString()}</p>
        </div>
        {/* On desktop: Qty */}
        <div className="hidden sm:block text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Qty</p>
          <p className="mt-0.5 text-xs text-foreground">x{item.quantity}</p>
        </div>
        {/* On desktop & mobile: Total */}
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold hidden sm:block">Total</p>
          <p className="mt-0.5 text-sm font-bold text-primary">
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
    <div className="mt-4 border-t pt-3">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left transition-colors hover:text-primary py-1"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Package className="size-4 text-muted-foreground" />
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">Products</span>
                <span className="text-xs text-muted-foreground">
                  ({items.length} item{items.length === 1 ? "" : "s"} ·{" "}
                  {totalQuantity} unit{totalQuantity === 1 ? "" : "s"})
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-bold text-primary">
                ৳{totalAmount.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5 bg-muted/20">
                {isOpen ? "Hide" : "Show"}
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-2">
          <div className="divide-y divide-border/40">
            {items.map((item) => (
              <InvoiceItemRow key={item.id} item={item} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
