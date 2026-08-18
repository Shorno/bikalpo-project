"use client";

import { Package } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WarehouseOrderDialog } from "./warehouse-order-dialog";
import {
  type WarehouseCylinderSaleMode,
  type WarehouseProduct,
  WarehouseProductCard,
  WarehouseProductCardSkeleton,
  type WarehouseProductVariantOption,
} from "./warehouse-product-card";

/** Map API storefront product to the card-compatible shape. */
function mapApiProduct(item: any): WarehouseProduct {
  const variantRows =
    Array.isArray(item.variants) && item.variants.length > 0
      ? item.variants
      : [item];
  const variant = item.variant || variantRows[0]?.variant;
  const product = item.product || variant?.product;
  const image =
    product?.images?.[0]?.imageUrl ||
    product?.images?.[0]?.url ||
    product?.image ||
    "";
  const brand =
    item.brand ||
    variantRows.find((row: any) => row.variant?.brand)?.variant?.brand ||
    variant?.brand ||
    product?.brand;
  const unitLabel = variant?.unitLabel || variant?.packType || "Unit";
  const variants: WarehouseProductVariantOption[] = variantRows.map(
    (row: any) => {
      const rowVariant = row.variant;
      const rowUnit = rowVariant?.unitLabel || rowVariant?.packType || "Unit";
      const rowPrice = row.retailPrice || rowVariant?.price || "0";
      const labelParts = [
        rowVariant?.unitLabel || rowVariant?.packType,
        rowVariant?.color,
        rowVariant?.size,
      ].filter(Boolean);

      return {
        inventoryId: row.inventoryId || rowVariant?.id || 0,
        variantId: rowVariant?.id || row.inventoryId || 0,
        sku: rowVariant?.sku,
        label: labelParts.length > 0 ? labelParts.join(" · ") : rowUnit,
        pricePerUnit: rowPrice,
        unit: rowUnit,
        availableQty: Number(row.availableQty) || 0,
        moq: Number(rowVariant?.orderMin) || 1,
        weightKg: Number(rowVariant?.weightKg) || 0,
        innerPackSizeKg:
          Number(rowVariant?.innerPackSizeKg || rowVariant?.pieceWeightKg) || 0,
        packType: rowVariant?.packType || rowUnit,
        fulfillmentMode: row.fulfillmentMode,
        targetVariantId: row.targetVariantId,
        canExchange: Boolean(row.canExchange),
      };
    },
  );
  const selectedVariant = variants[0];
  const qty = variants.reduce((sum, row) => sum + row.availableQty, 0);

  let stockStatus: "high" | "medium" | "low" = "high";
  if (qty <= 10) stockStatus = "low";
  else if (qty <= 50) stockStatus = "medium";

  return {
    id: item.inventoryId || variant?.id || 0,
    name: product?.name || "Unknown Product",
    slug: product?.slug || item.productSlug || null,
    categorySlug: product?.category?.slug || null,
    brand: brand?.name || "",
    sku: selectedVariant?.sku,
    image,
    pricePerUnit:
      selectedVariant?.pricePerUnit ||
      item.retailPrice ||
      variant?.price ||
      "0",
    unit: selectedVariant?.unit || unitLabel,
    moq: selectedVariant?.moq || Number(variant?.orderMin) || 1,
    moqUnit: selectedVariant?.unit || unitLabel,
    availableQty: selectedVariant?.availableQty ?? qty,
    availableUnit: `${unitLabel} Available`,
    rating: 0,
    reviewCount: 0,
    stockStatus,
    variants,
    selectedVariant,
    canExchange: variants.some((row) => row.canExchange),
  };
}

function buildProductDetailHref(
  detailBasePath: string,
  productSlug?: string | null,
) {
  if (!detailBasePath || !productSlug) return undefined;
  return `${detailBasePath.replace(/\/$/, "")}/${encodeURIComponent(productSlug)}`;
}

interface WarehouseProductGridProps {
  products?: any[];
  isLoading?: boolean;
  warehouseSlug?: string;
  detailBasePath?: string;
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  mode?: "default" | "retailer" | "w2w" | "view-only";
  cart?: any[];
  onAddToCart?: (product: WarehouseProduct) => void;
  onUpdateQuantity?: (
    variantId: number,
    delta: number,
    cylinderSaleMode?: WarehouseCylinderSaleMode,
  ) => void;
}

export function WarehouseProductGrid({
  products: rawProducts = [],
  isLoading = false,
  warehouseSlug = "",
  detailBasePath = warehouseSlug ? `/w/${warehouseSlug}/products` : "",
  pagination,
  onPageChange,
  mode = "default",
  cart = [],
  onAddToCart,
  onUpdateQuantity,
}: WarehouseProductGridProps) {
  const [orderProduct, setOrderProduct] = useState<any>(null);
  const [orderOpen, setOrderOpen] = useState(false);

  const products: WarehouseProduct[] = rawProducts.map(mapApiProduct);

  const handleBuyNow = (cardProduct: WarehouseProduct) => {
    const selectedVariant =
      cardProduct.selectedVariant || cardProduct.variants[0];
    if (!selectedVariant) return;

    setOrderProduct({
      inventoryId: selectedVariant.inventoryId,
      variantId: selectedVariant.variantId,
      productName: cardProduct.name,
      unit: selectedVariant.unit,
      pricePerUnit: selectedVariant.pricePerUnit,
      availableQty: selectedVariant.availableQty,
      moq: selectedVariant.moq,
      weightKg: selectedVariant.weightKg || 0,
      innerPackSizeKg: selectedVariant.innerPackSizeKg || 0,
      packType: selectedVariant.packType || selectedVariant.unit,
      canExchange:
        mode === "retailer" &&
        Boolean(selectedVariant.canExchange || cardProduct.canExchange),
    });
    setOrderOpen(true);
  };

  if (isLoading) {
    return (
      <section className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <WarehouseProductCardSkeleton key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="container mx-auto px-4 py-12">
        <div className="text-center">
          <Package className="mx-auto mb-3 h-16 w-16 text-gray-300" />
          <p className="text-lg font-medium text-gray-600">
            No products available
          </p>
          <p className="text-sm text-gray-400">
            This warehouse has no products in stock yet.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="container mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Products</h2>
          <span className="text-sm text-gray-500">
            {products.length} items available
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <WarehouseProductCard
              key={product.id}
              product={product}
              detailHref={buildProductDetailHref(detailBasePath, product.slug)}
              onBuyNow={handleBuyNow}
              mode={mode}
              cart={cart}
              onAddToCart={onAddToCart}
              onUpdateQuantity={onUpdateQuantity}
            />
          ))}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-zinc-200 pt-6 sm:flex-row">
            <p className="font-mono text-xs font-medium text-zinc-400">
              Showing page {pagination.page} of {pagination.totalPages} (
              {pagination.totalCount} products)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => onPageChange?.(Math.max(1, pagination.page - 1))}
                className="h-8 rounded border-zinc-200 bg-white px-3 font-mono text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  onPageChange?.(
                    Math.min(pagination.totalPages, pagination.page + 1),
                  )
                }
                className="h-8 rounded border-zinc-200 bg-white px-3 font-mono text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>

      <WarehouseOrderDialog
        product={orderProduct}
        warehouseSlug={warehouseSlug}
        open={orderOpen}
        onOpenChange={setOrderOpen}
      />
    </>
  );
}
