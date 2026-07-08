"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductActions } from "@/components/features/products/product-actions";

type DetailPricingRow = {
  id: number;
  productId: number;
  productName?: string | null;
  productSlug?: string | null;
  sku?: string | null;
  brandId?: number | null;
  brandName?: string | null;
  variantOptionId?: number | null;
  variantId?: number | null;
  label?: string | null;
  unitLabel?: string | null;
  color?: string | null;
  size?: string | null;
  packType?: string | null;
  consumerPrice?: number | null;
  orderMin?: number | null;
  orderMax?: number | null;
  orderIncrement?: number | null;
  orderUnit?: string | null;
  sortOrder?: number | null;
};

type DetailStockRow = {
  productId: number;
  variantId: number;
  variantOptionId?: number | null;
  brandId?: number | null;
  brandName?: string | null;
  color?: string | null;
  size?: string | null;
  unitLabel?: string | null;
  orderUnit?: string | null;
  packType?: string | null;
  availableQty?: number;
  inCartonQty?: number;
  openQty?: number;
  sellerCount?: number;
};

type ConsumerDetail = {
  family?: { code?: string | null; label?: string | null } | null;
  fulfillment?: {
    family?: string | null;
    familyLabel?: string | null;
    supportedModes?: Array<{ code?: string | null; label?: string | null }>;
  } | null;
  selection?: {
    defaultPriceRowId?: number | null;
  } | null;
  pricing?: {
    currency?: string | null;
    rows?: DetailPricingRow[];
  } | null;
  stock?: {
    displayUnit?: string | null;
    rows?: DetailStockRow[];
  } | null;
} | null;

type ProductSummary = {
  id: number;
  name: string;
  image: string;
  size: string;
  inStock: boolean;
  stockQuantity: number;
  category?: { name?: string | null } | null;
  subCategory?: { name?: string | null } | null;
};

type ConsumerProductPurchasePanelProps = {
  product: ProductSummary;
  detail: ConsumerDetail;
};

type AggregatedPurchaseRow = DetailPricingRow & {
  stockQuantity: number;
  openQuantity: number;
  insideContainerQuantity: number;
  sellerCount: number;
  inStock: boolean;
};

function formatMoney(value?: number | null) {
  return `৳${Number(value ?? 0).toLocaleString("en-BD")}`;
}

function getRowDisplayLabel(row: DetailPricingRow) {
  return row.unitLabel || row.label || "Default";
}

function matchesStockRow(row: DetailPricingRow, stockRow: DetailStockRow) {
  if (row.variantId != null) {
    return stockRow.variantId === row.variantId;
  }

  if (row.variantOptionId != null && stockRow.variantOptionId != null) {
    return (
      stockRow.productId === row.productId &&
      stockRow.variantOptionId === row.variantOptionId &&
      (row.brandId == null || stockRow.brandId === row.brandId)
    );
  }

  return false;
}

function buildAggregatedRows(
  pricingRows: DetailPricingRow[],
  stockRows: DetailStockRow[],
) {
  return pricingRows.map<AggregatedPurchaseRow>((row) => {
    const matchingStock = stockRows.filter((stockRow) =>
      matchesStockRow(row, stockRow),
    );
    const stockQuantity = matchingStock.reduce(
      (sum, stockRow) => sum + Number(stockRow.availableQty ?? 0),
      0,
    );
    const openQuantity = matchingStock.reduce(
      (sum, stockRow) => sum + Number(stockRow.openQty ?? 0),
      0,
    );
    const insideContainerQuantity = matchingStock.reduce(
      (sum, stockRow) => sum + Number(stockRow.inCartonQty ?? 0),
      0,
    );
    const sellerCount = matchingStock.reduce(
      (sum, stockRow) => sum + Number(stockRow.sellerCount ?? 0),
      0,
    );

    return {
      ...row,
      stockQuantity,
      openQuantity,
      insideContainerQuantity,
      sellerCount,
      inStock: stockQuantity > 0,
    };
  });
}

export function ConsumerProductPurchasePanel({
  product,
  detail,
}: ConsumerProductPurchasePanelProps) {
  const pricingRows = detail?.pricing?.rows ?? [];
  const stockRows = detail?.stock?.rows ?? [];
  const aggregatedRows = useMemo(
    () =>
      buildAggregatedRows(
        [...pricingRows].sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            Number(a.consumerPrice ?? 0) - Number(b.consumerPrice ?? 0) ||
            getRowDisplayLabel(a).localeCompare(getRowDisplayLabel(b)),
        ),
        stockRows,
      ),
    [pricingRows, stockRows],
  );
  const defaultRow = useMemo(() => {
    const selectedDefault =
      aggregatedRows.find(
        (row) => row.id === detail?.selection?.defaultPriceRowId,
      ) ?? null;

    if (selectedDefault) return selectedDefault;
    return aggregatedRows.find((row) => row.inStock) ?? aggregatedRows[0] ?? null;
  }, [aggregatedRows, detail?.selection?.defaultPriceRowId]);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(
    defaultRow?.id ?? null,
  );

  useEffect(() => {
    if (!defaultRow) return;
    if (selectedRowId == null) {
      setSelectedRowId(defaultRow.id);
      return;
    }

    const stillExists = aggregatedRows.some((row) => row.id === selectedRowId);
    if (!stillExists) {
      setSelectedRowId(defaultRow.id);
    }
  }, [aggregatedRows, defaultRow, selectedRowId]);

  const selectedRow =
    aggregatedRows.find((row) => row.id === selectedRowId) ?? defaultRow;

  if (!selectedRow) {
    return null;
  }

  const familyLabel =
    detail?.family?.label ?? detail?.fulfillment?.familyLabel ?? "Generic";
  const supportedModes = detail?.fulfillment?.supportedModes ?? [];
  const displayUnit = detail?.stock?.displayUnit ?? selectedRow.orderUnit ?? "unit";

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
          {familyLabel}
        </span>
        {supportedModes.map((mode, index) => (
          <span
            key={`${mode.code ?? mode.label}-${index}`}
            className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
          >
            {mode.label ?? mode.code ?? "Mode"}
          </span>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-gray-900">
            {formatMoney(selectedRow.consumerPrice)}
          </span>
          <span className="pb-1 text-sm text-gray-500">
            / {getRowDisplayLabel(selectedRow)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
          <span>SKU: {selectedRow.sku ?? "N/A"}</span>
          <span>Available: {selectedRow.stockQuantity} {displayUnit}</span>
          <span>Status: {selectedRow.inStock ? "In Stock" : "Out of Stock"}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {aggregatedRows.map((row) => {
          const isSelected = row.id === selectedRow.id;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelectedRowId(row.id)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                isSelected
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              <div className="text-sm font-semibold">{getRowDisplayLabel(row)}</div>
              <div className="text-xs opacity-80">{formatMoney(row.consumerPrice)}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <ProductActions
          key={selectedRow.id}
          product={{
            id: selectedRow.productId,
            name: selectedRow.productName || product.name,
            price: Number(selectedRow.consumerPrice ?? 0),
            image: product.image,
            size: getRowDisplayLabel(selectedRow),
            inStock: selectedRow.inStock,
            stockQuantity: selectedRow.stockQuantity,
          }}
          variantId={selectedRow.variantId ?? undefined}
          orderMin={selectedRow.orderMin ?? undefined}
          orderMax={selectedRow.orderMax ?? undefined}
          orderIncrement={selectedRow.orderIncrement ?? undefined}
          categoryName={product.category?.name ?? undefined}
          brandName={selectedRow.brandName ?? undefined}
        />
      </div>
    </section>
  );
}
