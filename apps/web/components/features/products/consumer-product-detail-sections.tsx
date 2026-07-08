"use client";

type ConsumerDetailProps = {
  detail: {
    family?: { label?: string | null } | null;
    fulfillment?: {
      defaultMode?: string | null;
      supportedModes?: Array<{ code?: string | null; label?: string | null }>;
      units?: {
        order?: { shortLabel?: string | null };
        stock?: { shortLabel?: string | null };
        conversion?: { shortLabel?: string | null };
        display?: { shortLabel?: string | null };
      } | null;
    } | null;
    productInformation?: {
      productId?: number | null;
      sku?: string | null;
      status?: string | null;
      category?: string | null;
      subCategory?: string | null;
      productName?: string | null;
      brand?: string | null;
      variantDescriptor?: string | null;
      inventoryUnit?: string | null;
      minimumOrder?: {
        quantity?: number | null;
        unit?: string | null;
      } | null;
    } | null;
    rules?: {
      trackingType?: string | null;
      expiryEnabled?: boolean;
      damageControlEnabled?: boolean;
      availableForSale?: boolean;
      visibility?: string | null;
      supportsPack?: boolean;
      supportsLoose?: boolean;
      conversionEnabled?: boolean;
      emptyPackReturn?: {
        enabled?: boolean;
        depositAmount?: number | null;
        companies?: string[];
        packSizes?: string[];
      } | null;
    } | null;
    pricing?: {
      rows?: Array<{
        brandName?: string | null;
        label?: string | null;
        color?: string | null;
        size?: string | null;
        consumerPrice?: number | null;
      }>;
    } | null;
    stock?: {
      displayUnit?: string | null;
      rows?: Array<{
        brandName?: string | null;
        color?: string | null;
        size?: string | null;
        unitLabel?: string | null;
        availableQty?: number;
        openQty?: number;
        sellerCount?: number;
      }>;
    } | null;
    history?: {
      createdAt?: string | Date | null;
      updatedAt?: string | Date | null;
      lastOrderedAt?: string | Date | null;
    } | null;
    performance?: {
      averageRating?: number;
      totalReviews?: number;
      sellerCount?: number;
      cartCount?: number;
      totalOrders?: number;
      totalUnitsSold?: number;
      totalSalesValue?: number;
    } | null;
  } | null;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString("en-BD");
}

function formatMoney(value?: number | null) {
  const amount = Number(value ?? 0);
  return `৳${amount.toLocaleString("en-BD")}`;
}

function formatLabel(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" • ") || "Default";
}

export function ConsumerProductDetailSections({
  detail,
}: ConsumerDetailProps) {
  if (!detail) return null;

  const info = detail.productInformation;
  const fulfillment = detail.fulfillment;
  const rules = detail.rules;
  const pricingRows = detail.pricing?.rows ?? [];
  const stockRows = detail.stock?.rows ?? [];
  const performance = detail.performance;
  const history = detail.history;

  return (
    <div className="space-y-6 mt-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Product Information
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Family</span>
              <p className="font-medium text-gray-900">
                {detail.family?.label ?? "Generic"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Status</span>
              <p className="font-medium text-gray-900">
                {info?.status ?? "active"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Product ID</span>
              <p className="font-medium text-gray-900">
                {info?.productId ?? "N/A"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">SKU</span>
              <p className="font-medium text-gray-900">{info?.sku ?? "N/A"}</p>
            </div>
            <div>
              <span className="text-gray-500">Category</span>
              <p className="font-medium text-gray-900">
                {info?.category ?? "N/A"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Sub Category</span>
              <p className="font-medium text-gray-900">
                {info?.subCategory ?? "N/A"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Brand</span>
              <p className="font-medium text-gray-900">
                {info?.brand ?? "Multiple / dynamic"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Inventory Unit</span>
              <p className="font-medium text-gray-900">
                {info?.inventoryUnit ?? "N/A"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-gray-500">Variant Structure</span>
              <p className="font-medium text-gray-900">
                {info?.variantDescriptor ?? "Default"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-gray-500">Minimum Order</span>
              <p className="font-medium text-gray-900">
                {info?.minimumOrder?.quantity ?? 1} {info?.minimumOrder?.unit ?? "unit"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-gray-500">Supported Modes</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {(fulfillment?.supportedModes ?? []).map((mode, index) => (
                  <span
                    key={`${mode.code}-${index}`}
                    className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                  >
                    {mode.label ?? mode.code ?? "Mode"}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Inventory & Rules
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Tracking</span>
              <p className="font-medium text-gray-900">
                {rules?.trackingType ?? "none"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Visibility</span>
              <p className="font-medium text-gray-900">
                {rules?.visibility ?? "public"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Expiry Tracking</span>
              <p className="font-medium text-gray-900">
                {rules?.expiryEnabled ? "Enabled" : "Disabled"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Damage Control</span>
              <p className="font-medium text-gray-900">
                {rules?.damageControlEnabled ? "Enabled" : "Disabled"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Pack Support</span>
              <p className="font-medium text-gray-900">
                {rules?.supportsPack ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Loose Support</span>
              <p className="font-medium text-gray-900">
                {rules?.supportsLoose ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Conversion Flow</span>
              <p className="font-medium text-gray-900">
                {rules?.conversionEnabled ? "Enabled" : "Direct"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Default Mode</span>
              <p className="font-medium text-gray-900">
                {fulfillment?.defaultMode ?? "N/A"}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Available For Sale</span>
              <p className="font-medium text-gray-900">
                {rules?.availableForSale ? "Yes" : "No"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-gray-500">Unit Flow</span>
              <p className="font-medium text-gray-900">
                {(fulfillment?.units?.order?.shortLabel ?? "N/A").toUpperCase()} →{" "}
                {(fulfillment?.units?.stock?.shortLabel ?? "N/A").toUpperCase()} →{" "}
                {(fulfillment?.units?.display?.shortLabel ?? "N/A").toUpperCase()}
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-gray-500">Empty Pack Return</span>
              <p className="font-medium text-gray-900">
                {rules?.emptyPackReturn?.enabled
                  ? `${formatMoney(rules.emptyPackReturn.depositAmount)} deposit`
                  : "Not applicable"}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing</h2>
          {pricingRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-3 font-medium">Variant</th>
                    <th className="py-2 pr-3 font-medium">Brand</th>
                    <th className="py-2 font-medium">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingRows.slice(0, 8).map((row, index) => (
                    <tr key={`${row.label}-${index}`} className="border-b last:border-0">
                      <td className="py-3 pr-3 text-gray-900">
                        {formatLabel([row.label, row.color, row.size])}
                      </td>
                      <td className="py-3 pr-3 text-gray-600">
                        {row.brandName ?? "Default"}
                      </td>
                      <td className="py-3 font-medium text-gray-900">
                        {formatMoney(row.consumerPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No pricing rows available yet.</p>
          )}
        </section>

        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Variant Stock
          </h2>
          {stockRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-3 font-medium">Variant</th>
                    <th className="py-2 pr-3 font-medium">Available</th>
                    <th className="py-2 pr-3 font-medium">Open</th>
                    <th className="py-2 font-medium">Sellers</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.slice(0, 8).map((row, index) => (
                    <tr
                      key={`${row.brandName}-${row.unitLabel}-${index}`}
                      className="border-b last:border-0"
                    >
                      <td className="py-3 pr-3 text-gray-900">
                        {formatLabel([
                          row.brandName,
                          row.color,
                          row.size,
                          row.unitLabel,
                        ])}
                      </td>
                      <td className="py-3 pr-3 text-gray-600">
                        {(row.availableQty ?? 0).toLocaleString("en-BD")}{" "}
                        {detail.stock?.displayUnit ?? ""}
                      </td>
                      <td className="py-3 pr-3 text-gray-600">
                        {(row.openQty ?? 0).toLocaleString("en-BD")}{" "}
                        {detail.stock?.displayUnit ?? ""}
                      </td>
                      <td className="py-3 font-medium text-gray-900">
                        {row.sellerCount ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No public stock rows available yet.</p>
          )}
        </section>
      </div>

      <section className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          History & Performance
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Created
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              {formatDate(history?.createdAt)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Last Updated
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              {formatDate(history?.updatedAt)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Last Ordered
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              {formatDate(history?.lastOrderedAt)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Rating
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              {(performance?.averageRating ?? 0).toFixed(1)} / 5
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Reviews
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              {performance?.totalReviews ?? 0}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Sellers
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              {performance?.sellerCount ?? 0}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Orders
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              {performance?.totalOrders ?? 0}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Sales
            </p>
            <p className="mt-1 font-semibold text-gray-900">
              {formatMoney(performance?.totalSalesValue)}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
