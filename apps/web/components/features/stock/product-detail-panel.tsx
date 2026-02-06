"use client";

import { History } from "lucide-react";
import { useState } from "react";
import { StockChangeLogsSheet } from "@/components/features/stock/stock-change-logs-sheet";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type ProductForDetail = {
  id: number;
  name: string;
  sku: string | null;
  price: string | null;
  stockQuantity: number;
  reorderLevel: number;
  supplier: string | null;
  lastRestockedAt: Date | null;
  category?: { name: string } | null;
  subCategory?: { name: string } | null;
};

interface ProductDetailPanelProps {
  product: ProductForDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailPanel({
  product,
  open,
  onOpenChange,
}: ProductDetailPanelProps) {
  const [logsOpen, setLogsOpen] = useState(false);

  if (!product) return null;

  const lastRestocked = product.lastRestockedAt
    ? new Date(product.lastRestockedAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
  const batchInfo = product.lastRestockedAt
    ? `Batch# ${new Date(product.lastRestockedAt).toISOString().slice(0, 10)}`
    : "—";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>{product.name}</SheetTitle>
          </SheetHeader>
          <dl className="mt-6 space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">SKU</dt>
              <dd className="font-medium">{product.sku || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Category</dt>
              <dd className="font-medium">
                {product.category?.name ?? "—"}
                {product.subCategory ? ` / ${product.subCategory.name}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current Stock</dt>
              <dd className="font-medium">{product.stockQuantity}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reorder Level</dt>
              <dd className="font-medium">{product.reorderLevel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Unit Price</dt>
              <dd className="font-medium">
                {product.price != null
                  ? `৳ ${Number(product.price).toLocaleString()}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Supplier</dt>
              <dd className="font-medium">{product.supplier || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last Restocked</dt>
              <dd className="font-medium">{lastRestocked}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Batch Info</dt>
              <dd className="font-medium">{batchInfo}</dd>
            </div>
          </dl>
          <div className="mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={() => setLogsOpen(true)}
              className="text-sm text-primary hover:underline flex items-center gap-2"
            >
              <History className="size-4" />
              Stock Change Logs
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <StockChangeLogsSheet
        productId={product.id}
        productName={product.name}
        open={logsOpen}
        onOpenChange={setLogsOpen}
      />
    </>
  );
}
