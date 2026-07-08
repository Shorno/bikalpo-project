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

function getSelectionValueLabel(value?: string | number | null) {
  if (value == null) return "Default";
  const text = String(value).trim();
  return text.length > 0 ? text : "Default";
}

function getConsumerFamilyCode(detail: ConsumerDetail) {
  return detail?.family?.code ?? detail?.fulfillment?.family ?? "generic";
}

function getVariantSectionTitle(familyCode: string) {
  switch (familyCode) {
    case "grocery":
      return "Select Pack";
    case "bulk_liquid":
      return "Select Supply";
    case "fashion":
      return "Select Style";
    case "footwear":
      return "Select Pair / Pack";
    case "electronics":
      return "Select Model";
    case "lpg":
      return "Select Capacity";
    default:
      return "Select Variant";
  }
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

  const familyCode = getConsumerFamilyCode(detail);
  const familyLabel =
    detail?.family?.label ?? detail?.fulfillment?.familyLabel ?? "Generic";
  const supportedModes = detail?.fulfillment?.supportedModes ?? [];
  const displayUnit = detail?.stock?.displayUnit ?? selectedRow.orderUnit ?? "unit";
  const stockUnitLabel =
    selectedRow.orderUnit || selectedRow.unitLabel || displayUnit;
  const useBrandSelector = !["fashion", "footwear"].includes(familyCode);
  const scopedBrandId = useBrandSelector ? selectedRow.brandId ?? null : null;
  const brandScopedRows =
    scopedBrandId != null
      ? aggregatedRows.filter((row) => row.brandId === scopedBrandId)
      : aggregatedRows;
  const colorScopedRows = selectedRow.color
    ? brandScopedRows.filter((row) => row.color === selectedRow.color)
    : brandScopedRows;
  const sizeScopedRows = selectedRow.size
    ? colorScopedRows.filter((row) => row.size === selectedRow.size)
    : colorScopedRows;
  const brandOptions = useMemo(
    () =>
      Array.from(
        new Map(
          aggregatedRows
            .filter((row) => row.brandId != null)
            .map((row) => [
              row.brandId!,
              {
                id: row.brandId!,
                name: row.brandName ?? "Brand",
                rowId: row.id,
              },
            ]),
        ).values(),
      ),
    [aggregatedRows],
  );
  const colorOptions = useMemo(
    () =>
      Array.from(
        new Map(
          brandScopedRows
            .filter((row) => row.color)
            .map((row) => [
              row.color!,
              {
                value: row.color!,
                rowId: row.id,
              },
            ]),
        ).values(),
      ),
    [brandScopedRows],
  );
  const sizeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          colorScopedRows
            .filter((row) => row.size)
            .map((row) => [
              row.size!,
              {
                value: row.size!,
                rowId: row.id,
              },
            ]),
        ).values(),
      ),
    [colorScopedRows],
  );
  const variantRows = (() => {
    if (familyCode === "fashion" || familyCode === "footwear") {
      return sizeScopedRows.length > 0 ? sizeScopedRows : colorScopedRows;
    }

    if (familyCode === "electronics") {
      return colorScopedRows.length > 0 ? colorScopedRows : brandScopedRows;
    }

    return brandScopedRows;
  })();
  const showVariantSelector =
    variantRows.length > 1 ||
    (variantRows.length === 1 &&
      (familyCode === "grocery" ||
        familyCode === "bulk_liquid" ||
        familyCode === "lpg"));
  const ruleLabel = [
    selectedRow.orderMin != null
      ? `Min ${selectedRow.orderMin} ${selectedRow.orderUnit ?? displayUnit}`
      : null,
    selectedRow.orderIncrement != null && selectedRow.orderIncrement > 1
      ? `Step ${selectedRow.orderIncrement}`
      : null,
    selectedRow.orderMax != null
      ? `Max ${selectedRow.orderMax}`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const stockBreakdown = [
    selectedRow.openQuantity > 0
      ? `${selectedRow.openQuantity} open ${stockUnitLabel}`
      : null,
    selectedRow.insideContainerQuantity > 0
      ? `${selectedRow.insideContainerQuantity} inside container`
      : null,
    selectedRow.sellerCount > 0
      ? `${selectedRow.sellerCount} seller${selectedRow.sellerCount > 1 ? "s" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const hasVisiblePrice = Number(selectedRow.consumerPrice ?? 0) > 0;
  const selectedAttributes = [
    selectedRow.brandName
      ? { label: "Brand", value: selectedRow.brandName }
      : null,
    selectedRow.color
      ? { label: "Color", value: selectedRow.color }
      : null,
    selectedRow.size
      ? {
          label: familyCode === "lpg" ? "Capacity" : "Size",
          value: selectedRow.size,
        }
      : null,
    selectedRow.packType
      ? { label: "Pack", value: selectedRow.packType }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

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
          <span>Available: {selectedRow.stockQuantity} {stockUnitLabel}</span>
          <span>Status: {selectedRow.inStock ? "In Stock" : "Out of Stock"}</span>
        </div>
        {stockBreakdown && (
          <div className="mt-2 text-sm text-gray-500">{stockBreakdown}</div>
        )}
        {ruleLabel && <div className="mt-1 text-sm text-gray-500">{ruleLabel}</div>}
        {selectedAttributes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedAttributes.map((attribute) => (
              <span
                key={`${attribute.label}-${attribute.value}`}
                className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
              >
                {attribute.label}: {attribute.value}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 space-y-5">
        {brandOptions.length > 1 && useBrandSelector && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Select Brand</p>
            <div className="flex flex-wrap gap-2">
              {brandOptions.map((brandOption) => {
                const isSelected = brandOption.id === selectedRow.brandId;
                return (
                  <button
                    key={brandOption.id}
                    type="button"
                    onClick={() => setSelectedRowId(brandOption.rowId)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {brandOption.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {colorOptions.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Select Color</p>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((colorOption) => {
                const isSelected = colorOption.value === selectedRow.color;
                return (
                  <button
                    key={colorOption.value}
                    type="button"
                    onClick={() => setSelectedRowId(colorOption.rowId)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {getSelectionValueLabel(colorOption.value)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {sizeOptions.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">
              {familyCode === "lpg" ? "Select Capacity" : "Select Size"}
            </p>
            <div className="flex flex-wrap gap-2">
              {sizeOptions.map((sizeOption) => {
                const isSelected = sizeOption.value === selectedRow.size;
                return (
                  <button
                    key={sizeOption.value}
                    type="button"
                    onClick={() => setSelectedRowId(sizeOption.rowId)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {getSelectionValueLabel(sizeOption.value)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {showVariantSelector && (
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">
              {getVariantSectionTitle(familyCode)}
            </p>
            <div className="flex flex-wrap gap-2">
              {variantRows.map((row) => {
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
                    <div className="text-sm font-semibold">
                      {getRowDisplayLabel(row)}
                    </div>
                    <div className="text-xs opacity-80">
                      {formatMoney(row.consumerPrice)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        {hasVisiblePrice ? (
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
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Price is not available for the selected option yet.
          </div>
        )}
      </div>
    </section>
  );
}
