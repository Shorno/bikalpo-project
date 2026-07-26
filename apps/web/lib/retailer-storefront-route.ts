import { withCustomerStorefrontPreview } from "./customer-storefront-preview";

interface RetailerProductHrefInput {
  storeSlug: string;
  categorySlug?: string | null;
  productSlug: string;
  previewMode: boolean;
}

export function buildRetailerProductHref({
  storeSlug,
  productSlug,
  previewMode,
}: RetailerProductHrefInput) {
  return withCustomerStorefrontPreview(
    `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(productSlug)}`,
    previewMode,
  );
}
