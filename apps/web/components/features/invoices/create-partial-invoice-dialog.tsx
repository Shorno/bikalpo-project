"use client";

import type { InvoiceWithItems } from "@bikalpo-project/db/schema";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Package, Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { client } from "@/utils/orpc";

interface CreatePartialInvoiceDialogProps {
  invoice: InvoiceWithItems;
  children?: React.ReactNode;
}

function formatPrice(price: string | number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(Number(price));
}

export function CreatePartialInvoiceDialog({
  invoice,
  children,
}: CreatePartialInvoiceDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const deliveredQuantities = invoice.items.reduce<Record<number, number>>(
    (acc, originalItem) => {
      const sameVariantItems = originalItem.variantId
        ? invoice.items.filter(
            (item) => item.variantId === originalItem.variantId,
          )
        : [];
      const sameProductItems = invoice.items.filter(
        (item) => item.productId === originalItem.productId,
      );

      acc[originalItem.id] =
        invoice.splitInvoices?.reduce((total, splitInvoice) => {
          const splitItems = (splitInvoice as InvoiceWithItems).items ?? [];
          return (
            total +
            splitItems.reduce((splitTotal, splitItem) => {
              const exactOrderItem =
                originalItem.orderItemId !== null &&
                splitItem.orderItemId === originalItem.orderItemId;
              const unambiguousLegacyVariant =
                originalItem.orderItemId === null &&
                originalItem.variantId !== null &&
                sameVariantItems.length === 1 &&
                splitItem.variantId === originalItem.variantId;
              const unambiguousLegacyProduct =
                originalItem.orderItemId === null &&
                originalItem.variantId === null &&
                sameProductItems.length === 1 &&
                splitItem.productId === originalItem.productId;

              return exactOrderItem ||
                unambiguousLegacyVariant ||
                unambiguousLegacyProduct
                ? splitTotal + splitItem.quantity
                : splitTotal;
            }, 0)
          );
        }, 0) ?? 0;
      return acc;
    },
    {},
  );

  // Calculate remaining quantities
  const remainingItems = invoice.items.map((item) => {
    const delivered = deliveredQuantities[item.id] || 0;
    const remaining = item.quantity - delivered;
    return {
      ...item,
      deliveredQty: delivered,
      remainingQty: remaining,
      canSplit: remaining > 0,
    };
  });

  const handleQuantityChange = (invoiceItemId: number, value: number) => {
    const item = remainingItems.find((i) => i.id === invoiceItemId);
    if (!item) return;

    // Ensure quantity is between 0 and remaining quantity
    const newValue = Math.max(0, Math.min(value, item.remainingQty));
    setQuantities((prev) => ({
      ...prev,
      [invoiceItemId]: newValue,
    }));
  };

  const incrementQuantity = (invoiceItemId: number) => {
    const item = remainingItems.find((i) => i.id === invoiceItemId);
    if (!item) return;

    const current = quantities[invoiceItemId] || 0;
    if (current < item.remainingQty) {
      setQuantities((prev) => ({
        ...prev,
        [invoiceItemId]: current + 1,
      }));
    }
  };

  const decrementQuantity = (invoiceItemId: number) => {
    const current = quantities[invoiceItemId] || 0;
    if (current > 0) {
      setQuantities((prev) => ({
        ...prev,
        [invoiceItemId]: current - 1,
      }));
    }
  };

  const calculateTotal = () => {
    return remainingItems.reduce((total, item) => {
      const qty = quantities[item.id] || 0;
      const unitPrice = Number.parseFloat(item.unitPrice);
      return total + qty * unitPrice;
    }, 0);
  };

  const handleSubmit = async () => {
    // Filter items with quantity > 0
    const selectedItems = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([invoiceItemId, quantity]) => ({
        invoiceItemId: Number.parseInt(invoiceItemId, 10),
        quantity,
      }));

    if (selectedItems.length === 0) {
      toast.error("Please select at least one item with quantity");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await client.adminInvoice.createPartialInvoice({
        parentInvoiceId: invoice.id,
        items: selectedItems,
      });

      if (result.success) {
        toast.success("Partial invoice created successfully");
        setOpen(false);
        setQuantities({});
        queryClient.invalidateQueries({
          queryKey: ["admin-invoice", invoice.id],
        });
        queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      } else {
        toast.error("Failed to create partial invoice");
      }
    } catch (error) {
      toast.error("Something went wrong");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasRemainingItems = remainingItems.some((item) => item.canSplit);
  const selectedCount = Object.values(quantities).filter((q) => q > 0).length;
  const total = calculateTotal();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" disabled={!hasRemainingItems}>
            <Package className="h-4 w-4 mr-2" />
            Create Partial Invoice
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh] w-[95vw]">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-lg font-semibold">
            Create Partial Invoice
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select products and quantities to create a partial delivery invoice
            for {invoice.invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="max-h-[450px]">
            <div className="space-y-4 pr-4">
              {!hasRemainingItems ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-base font-medium text-foreground">
                    All items have been delivered
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    There are no remaining items to create a partial invoice
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
                        <TableHead className="font-semibold w-[35%]">
                          Product
                        </TableHead>
                        <TableHead className="text-center font-semibold w-[10%]">
                          Total Qty
                        </TableHead>
                        <TableHead className="text-center font-semibold w-[10%]">
                          Delivered
                        </TableHead>
                        <TableHead className="text-center font-semibold w-[10%]">
                          Remaining
                        </TableHead>
                        <TableHead className="text-center font-semibold w-[20%]">
                          Partial Qty
                        </TableHead>
                        <TableHead className="text-right font-semibold w-[15%]">
                          Subtotal
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {remainingItems.map((item) => {
                        const selectedQty = quantities[item.id] || 0;
                        const lineTotal =
                          selectedQty * Number.parseFloat(item.unitPrice);

                        return (
                          <TableRow
                            key={item.id}
                            className="border-b last:border-b-0"
                          >
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                {item.productImage && (
                                  <Image
                                    height={200}
                                    width={200}
                                    src={item.productImage}
                                    alt={item.productName}
                                    className="w-12 h-12 rounded-md object-cover border border-border"
                                  />
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium text-sm text-foreground truncate">
                                    {item.productName}
                                  </p>
                                  {item.productSku && (
                                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                      SKU: {item.productSku}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {formatPrice(item.unitPrice)} each
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md bg-muted text-sm font-medium">
                                {item.quantity}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md bg-muted text-sm font-medium text-muted-foreground">
                                {item.deliveredQty}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md text-sm font-semibold ${
                                  item.remainingQty > 0
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {item.remainingQty}
                              </span>
                            </TableCell>
                            <TableCell>
                              {item.canSplit ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => decrementQuantity(item.id)}
                                    disabled={selectedQty === 0}
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={item.remainingQty}
                                    value={selectedQty}
                                    onChange={(e) =>
                                      handleQuantityChange(
                                        item.id,
                                        Number.parseInt(e.target.value, 10) ||
                                          0,
                                      )
                                    }
                                    className="h-8 w-16 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() => incrementQuantity(item.id)}
                                    disabled={selectedQty >= item.remainingQty}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-center block text-sm">
                                  —
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {selectedQty > 0 ? (
                                <span className="font-semibold text-foreground">
                                  {formatPrice(lineTotal)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {hasRemainingItems && (
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm">
                {selectedCount > 0 ? (
                  <span className="text-foreground font-medium">
                    {selectedCount} item{selectedCount !== 1 ? "s" : ""}{" "}
                    selected
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">
                    No items selected
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                  Total Amount
                </p>
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {formatPrice(total)}
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
                className="min-w-24"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || selectedCount === 0}
                className="min-w-44"
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Partial Invoice
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
