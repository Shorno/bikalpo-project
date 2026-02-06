"use client";

import { Eye, Package, Pencil, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import DeleteProductDialog from "@/components/features/product/components/delete-product-dialog";
import { AdjustStockDialog } from "@/components/features/stock/adjust-stock-dialog";
import {
  ProductDetailPanel,
  type ProductForDetail,
} from "@/components/features/stock/product-detail-panel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_BASE } from "@/lib/routes";

export type ProductForStockRow = {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  price: string | null;
  stockQuantity: number;
  inStock: boolean;
  reorderLevel: number;
  supplier: string | null;
  lastRestockedAt: Date | null;
  category?: { name: string } | null;
  subCategory?: { name: string } | null;
};

interface StockInventoryTableProps {
  products: ProductForStockRow[];
}

function toDetailProduct(p: ProductForStockRow): ProductForDetail {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: p.price,
    stockQuantity: p.stockQuantity,
    reorderLevel: p.reorderLevel,
    supplier: p.supplier,
    lastRestockedAt: p.lastRestockedAt,
    category: p.category,
    subCategory: p.subCategory,
  };
}

export function StockInventoryTable({ products }: StockInventoryTableProps) {
  const router = useRouter();
  const [detailProduct, setDetailProduct] = useState<ProductForDetail | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<ProductForStockRow | null>(
    null,
  );

  const refresh = () => router.refresh();

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product ID</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
              <TableHead className="text-right">Reorder Level</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-muted-foreground">
                    PRD-{p.id}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Package className="size-4 text-muted-foreground" />
                      </div>
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.sku || p.slug || "—"}
                  </TableCell>
                  <TableCell>
                    {p.category?.name ?? "—"}
                    {p.subCategory ? ` / ${p.subCategory.name}` : ""}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {p.stockQuantity}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {p.reorderLevel}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.price != null
                      ? `৳ ${Number(p.price).toLocaleString()}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDetailProduct(toDetailProduct(p));
                          setDetailOpen(true);
                        }}
                        title="View"
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" asChild title="Edit">
                        <Link href={`${ADMIN_BASE}/products/${p.id}/edit`}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                      <DeleteProductDialog
                        productId={p.id}
                        productName={p.name}
                        onSuccess={refresh}
                        compact
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAdjustProduct(p)}
                        title="Adjust Stock"
                      >
                        <SlidersHorizontal className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProductDetailPanel
        product={detailProduct}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {adjustProduct && (
        <AdjustStockDialog
          product={{
            id: adjustProduct.id,
            name: adjustProduct.name,
            stockQuantity: adjustProduct.stockQuantity,
          }}
          open={!!adjustProduct}
          onOpenChange={(o) => !o && setAdjustProduct(null)}
          onSuccess={() => {
            setAdjustProduct(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
