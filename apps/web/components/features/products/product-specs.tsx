import type { ProductFeatureGroup } from "@/db/schema/product";
import type { QuantitySelectorOption } from "@/db/schema/product-variant";

type VariantRow = {
  id: number;
  unitLabel: string;
  weightKg: string | null;
  packagingType: string | null;
  origin: string | null;
  shelfLife: string | null;
  orderMin: string | null;
  orderUnit: string | null;
  quantitySelectorOptions: QuantitySelectorOption[] | null;
  sortOrder: number | null;
};

type ProductSpecsProps = {
  categoryName: string;
  brandName: string | null;
  productSize: string;
  subCategoryName?: string | null;
  features?: ProductFeatureGroup[] | null;
  variants?: VariantRow[] | null;
  theme?: "default" | "emerald";
};

function getFeatureMap(
  features: ProductFeatureGroup[] | undefined | null,
): Map<string, string> {
  const map = new Map<string, string>();
  if (!features?.length) return map;
  for (const group of features) {
    for (const item of group.items || []) {
      if (item.key?.trim()) {
        map.set(item.key.trim().toLowerCase(), item.value?.trim() ?? "");
      }
    }
  }
  return map;
}

function getFeature(
  map: Map<string, string>,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = map.get(k.toLowerCase());
    if (v) return v;
  }
  return undefined;
}

function formatBulkUnits(
  options: QuantitySelectorOption[] | null | undefined,
  unitLabel: string,
): string | undefined {
  if (!options?.length) return undefined;
  const withUnit = options
    .filter((o) => o.value != null && o.unit)
    .map((o) => `${o.value} ${o.unit}`)
    .filter(Boolean);
  if (withUnit.length === 0) return undefined;
  if (withUnit.length === 1) return withUnit[0];
  return withUnit.join(", ");
}

export function ProductSpecs({
  categoryName,
  brandName,
  productSize,
  subCategoryName,
  features,
  variants,
  theme = "default",
}: ProductSpecsProps) {
  const featureMap = getFeatureMap(features ?? []);
  const primaryVariant = variants?.length
    ? [...variants].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))[0]
    : null;

  const weight = primaryVariant?.weightKg
    ? `${Number(primaryVariant.weightKg)}kg`
    : productSize;
  const origin = primaryVariant?.origin ?? getFeature(featureMap, "origin");
  const shelfLife =
    primaryVariant?.shelfLife ??
    getFeature(featureMap, "shelf life", "shelf life");
  const packagingType = primaryVariant?.packagingType
    ? capitalize(primaryVariant.packagingType)
    : getFeature(featureMap, "packaging type", "packaging");
  const moisture = getFeature(featureMap, "moisture");
  const grainLength = getFeature(
    featureMap,
    "grain length",
    "grain size",
    "grain length",
  );

  const packagingLine =
    primaryVariant?.weightKg && primaryVariant?.unitLabel
      ? `1 ${primaryVariant.unitLabel} = ${Number(primaryVariant.weightKg)}kg`
      : productSize
        ? `1 unit = ${productSize}`
        : null;
  const minOrder =
    primaryVariant?.orderMin != null && primaryVariant?.orderUnit
      ? `${primaryVariant.orderMin} ${primaryVariant.orderUnit}`
      : "1 unit";
  const bulkUnits = primaryVariant?.quantitySelectorOptions?.length
    ? formatBulkUnits(
        primaryVariant.quantitySelectorOptions,
        primaryVariant.unitLabel,
      )
    : undefined;

  const emptyPlaceholder = "—";
  const specs: { label: string; value: string }[] = [
    { label: "Weight", value: weight || emptyPlaceholder },
    { label: "Category", value: categoryName || emptyPlaceholder },
    ...(subCategoryName
      ? [{ label: "Sub-Category", value: subCategoryName }]
      : []),
    { label: "Brand", value: brandName ?? emptyPlaceholder },
    { label: "Origin", value: origin ?? emptyPlaceholder },
    { label: "Shelf Life", value: shelfLife ?? emptyPlaceholder },
    { label: "Packaging Type", value: packagingType ?? emptyPlaceholder },
    { label: "Moisture", value: moisture ?? emptyPlaceholder },
    { label: "Grain Length", value: grainLength ?? emptyPlaceholder },
  ];

  const hasAnySpecValue = specs.some(
    (s) => s.value !== emptyPlaceholder && s.value !== "",
  );
  const hasPackaging =
    packagingLine || moisture !== undefined || grainLength !== undefined;
  const hasUnitType = minOrder || bulkUnits;

  if (!hasAnySpecValue && !hasPackaging && !hasUnitType) {
    return null;
  }

  const isEmerald = theme === "emerald";
  const borderClass = isEmerald ? "border-emerald-100" : "border-gray-200";
  const bgClass = isEmerald ? "bg-emerald-50/50" : "bg-gray-50";
  const divideClass = isEmerald ? "divide-emerald-50" : "divide-gray-100";

  return (
    <div className="space-y-6">
      {/* Two-column specs table: always show Weight, Category, Brand, Origin, Shelf Life, Packaging Type, Moisture, Grain Length */}
      <div className={`border-t border-b py-6 ${borderClass}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {specs.map((row) => (
            <div
              key={row.label}
              className="flex justify-between sm:justify-start sm:gap-4"
            >
              <span className="text-gray-600">{row.label}:</span>
              <span
                className={`font-medium ${row.value === emptyPlaceholder ? "text-gray-400" : "text-gray-900"}`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Packaging section */}
      {hasPackaging && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Packaging:</h3>
          <ul
            className={`list-disc list-inside space-y-1 text-gray-700 ${divideClass}`}
          >
            {packagingLine && <li>{packagingLine}</li>}
            {moisture != null && moisture !== "" && (
              <li>Moisture: {moisture}</li>
            )}
            {grainLength != null && grainLength !== "" && (
              <li>Grain Size: {grainLength}</li>
            )}
          </ul>
        </div>
      )}

      {/* Unit Type section */}
      {hasUnitType && (
        <div className={`rounded-lg border p-4 ${borderClass} ${bgClass}`}>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Unit Type:
          </h3>
          <ul
            className={`list-disc list-inside space-y-1 text-gray-700 ${divideClass}`}
          >
            <li>Minimum order: {minOrder}</li>
            {bulkUnits != null && bulkUnits !== "" && (
              <li>Bulk units: {bulkUnits}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
