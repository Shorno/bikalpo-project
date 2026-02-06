"use client";

import { Package, Trash2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FormEstimateItem } from "@/types/estimate";
import { formatPrice } from "@/utils/currency";

interface EstimateItemsTableProps {
  items: FormEstimateItem[];
  onUpdate: (
    index: number,
    field: keyof FormEstimateItem,
    value: number,
  ) => void;
  onRemove: (index: number) => void;
}

export function EstimateItemsTable({
  items,
  onUpdate,
  onRemove,
}: EstimateItemsTableProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
        No items added to estimate
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Card View */}
      <div className="sm:hidden space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item.productId}-${index}`}
            className="border rounded-lg p-3"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="h-10 w-10 shrink-0 rounded bg-muted overflow-hidden">
                {item.productImage ? (
                  <Image
                    width={40}
                    height={40}
                    src={item.productImage}
                    alt={item.productName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {item.productName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatPrice(item.unitPrice)} each
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Qty</Label>
                <Input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) =>
                    onUpdate(
                      index,
                      "quantity",
                      parseInt(e.target.value, 10) || 1,
                    )
                  }
                  className="h-8 text-sm text-center"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Discount
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={item.discount}
                  onChange={(e) =>
                    onUpdate(index, "discount", parseFloat(e.target.value) || 0)
                  }
                  className="h-8 text-sm text-center"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Total</Label>
                <div className="h-8 flex items-center justify-center text-sm font-semibold">
                  {formatPrice(item.totalPrice)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table View */}
      <div className="hidden sm:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-12 pl-3">Image</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="w-24 text-right">Price</TableHead>
              <TableHead className="w-20 text-center">Qty</TableHead>
              <TableHead className="w-24 text-right">Discount</TableHead>
              <TableHead className="w-24 text-right">Total</TableHead>
              <TableHead className="w-10 pr-3"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow
                key={`${item.productId}-${index}`}
                className="group hover:bg-muted/50"
              >
                <TableCell className="pl-3 py-2">
                  <div className="h-10 w-10 rounded bg-muted overflow-hidden">
                    {item.productImage ? (
                      <Image
                        width={40}
                        height={40}
                        src={item.productImage}
                        alt={item.productName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <span className="text-sm font-medium">
                    {item.productName}
                  </span>
                </TableCell>
                <TableCell className="text-right py-2 text-sm">
                  {formatPrice(item.unitPrice)}
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdate(
                        index,
                        "quantity",
                        parseInt(e.target.value, 10) || 1,
                      )
                    }
                    className="h-8 w-16 text-center text-sm mx-auto"
                  />
                </TableCell>
                <TableCell className="py-2">
                  <Input
                    type="number"
                    min="0"
                    value={item.discount}
                    onChange={(e) =>
                      onUpdate(
                        index,
                        "discount",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="h-8 w-20 text-right text-sm ml-auto"
                  />
                </TableCell>
                <TableCell className="text-right py-2 text-sm font-semibold">
                  {formatPrice(item.totalPrice)}
                </TableCell>
                <TableCell className="pr-3 py-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                    onClick={() => onRemove(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
