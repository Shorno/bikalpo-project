"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Minus, Package, Plus, Save } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  createPartialInvoice,
  getInvoiceById,
} from "@/actions/invoice/invoice-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InvoiceWithItems } from "@/db/schema/invoice";

function formatPrice(price: string | number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(Number(price));
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-9" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CreatePartialInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const invoiceId = Number(params.id);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const { data: result, isLoading } = useQuery({
    queryKey: ["admin-invoice", invoiceId],
    queryFn: () => getInvoiceById(invoiceId),
    enabled: !!invoiceId,
  });

  const invoice = result?.invoice as InvoiceWithItems | undefined;

  // Get already delivered quantities
  const deliveredQuantities =
    invoice?.splitInvoices?.reduce(
      (acc, splitInvoice) => {
        const splitInvoiceWithItems = splitInvoice as InvoiceWithItems;
        splitInvoiceWithItems.items?.forEach((item) => {
          acc[item.productId] = (acc[item.productId] || 0) + item.quantity;
        });
        return acc;
      },
      {} as Record<number, number>,
    ) || {};

  // Calculate remaining quantities
  const remainingItems =
    invoice?.items.map((item) => {
      const delivered = deliveredQuantities[item.productId] || 0;
      const remaining = item.quantity - delivered;
      return {
        ...item,
        deliveredQty: delivered,
        remainingQty: remaining,
        canSplit: remaining > 0,
      };
    }) || [];

  const handleQuantityChange = (productId: number, value: number) => {
    const item = remainingItems.find((i) => i.productId === productId);
    if (!item) return;

    const newValue = Math.max(0, Math.min(value, item.remainingQty));
    setQuantities((prev) => ({
      ...prev,
      [productId]: newValue,
    }));
  };

  const incrementQuantity = (productId: number) => {
    const item = remainingItems.find((i) => i.productId === productId);
    if (!item) return;

    const current = quantities[productId] || 0;
    if (current < item.remainingQty) {
      setQuantities((prev) => ({
        ...prev,
        [productId]: current + 1,
      }));
    }
  };

  const decrementQuantity = (productId: number) => {
    const current = quantities[productId] || 0;
    if (current > 0) {
      setQuantities((prev) => ({
        ...prev,
        [productId]: current - 1,
      }));
    }
  };

  const calculateTotal = () => {
    return remainingItems.reduce((total, item) => {
      const qty = quantities[item.productId] || 0;
      const unitPrice = Number.parseFloat(item.unitPrice);
      return total + qty * unitPrice;
    }, 0);
  };

  const handleSubmit = async () => {
    if (!invoice) return;

    const selectedItems = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        productId: Number.parseInt(productId, 10),
        quantity,
      }));

    if (selectedItems.length === 0) {
      toast.error("Please select at least one item with quantity");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createPartialInvoice(invoice.id, selectedItems);

      if (result.success) {
        toast.success("Partial invoice created successfully");
        queryClient.invalidateQueries({
          queryKey: ["admin-invoice", invoice.id],
        });
        queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
        router.push(`/dashboard/admin/invoices/${invoice.id}`);
      } else {
        toast.error(result.error || "Failed to create partial invoice");
      }
    } catch (error) {
      toast.error("Something went wrong");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!result?.success || !invoice) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center p-12 rounded-lg border border-dashed text-center">
          <div className="bg-red-50 p-4 rounded-full mb-4">
            <Package className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold mb-2">Invoice not found</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            The invoice you are looking for does not exist or has been deleted.
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/admin/invoices">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const hasRemainingItems = remainingItems.some((item) => item.canSplit);
  const selectedCount = Object.values(quantities).filter((q) => q > 0).length;
  const total = calculateTotal();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/dashboard/admin/invoices/${invoice.id}`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Create Partial Invoice
          </h1>
          <p className="text-muted-foreground">
            Select products and quantities from {invoice.invoiceNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/dashboard/admin/invoices/${invoice.id}`)
            }
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedCount === 0}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Create Partial Invoice
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {!hasRemainingItems ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-base font-medium text-foreground">
                All items have been delivered
              </p>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                There are no remaining items to create a partial invoice
              </p>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/admin/invoices/${invoice.id}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Invoice
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5" />
                Select Items for Partial Delivery
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold w-[35%]">
                        Product
                      </TableHead>
                      <TableHead className="text-center font-semibold w-[10%]">
                        Total Ordered
                      </TableHead>
                      <TableHead className="text-center font-semibold w-[10%]">
                        Delivered
                      </TableHead>
                      <TableHead className="text-center font-semibold w-[10%]">
                        Remaining
                      </TableHead>
                      <TableHead className="text-center font-semibold w-[20%]">
                        Quantity for This Delivery
                      </TableHead>
                      <TableHead className="text-right font-semibold w-[15%]">
                        Subtotal
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {remainingItems.map((item) => {
                      const selectedQty = quantities[item.productId] || 0;
                      const lineTotal =
                        selectedQty * Number.parseFloat(item.unitPrice);

                      return (
                        <TableRow key={item.id}>
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
                              <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() =>
                                      decrementQuantity(item.productId)
                                    }
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
                                        item.productId,
                                        Number.parseInt(e.target.value, 10) ||
                                          0,
                                      )
                                    }
                                    className="h-8 w-20 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    onClick={() =>
                                      incrementQuantity(item.productId)
                                    }
                                    disabled={selectedQty >= item.remainingQty}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                {selectedQty !== item.remainingQty && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-primary hover:text-primary"
                                    onClick={() =>
                                      setQuantities((prev) => ({
                                        ...prev,
                                        [item.productId]: item.remainingQty,
                                      }))
                                    }
                                  >
                                    Send All ({item.remainingQty})
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-center block text-sm">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {selectedQty > 0 ? (
                              <span className="font-semibold text-foreground text-base">
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
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card className="bg-muted/30">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div className="text-sm">
                  {selectedCount > 0 ? (
                    <span className="text-foreground font-medium">
                      {selectedCount} item{selectedCount !== 1 ? "s" : ""}{" "}
                      selected for partial delivery
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">
                      No items selected
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Partial Invoice Total
                  </p>
                  <p className="text-3xl font-bold text-foreground tabular-nums">
                    {formatPrice(total)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
