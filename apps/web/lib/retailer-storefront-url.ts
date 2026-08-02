import { withCustomerStorefrontPreview } from "./customer-storefront-preview";

export function getRetailerProductHref({
  shopSlug,
  productSlug,
  previewMode = false,
}: {
  shopSlug: string;
  productSlug: string;
  previewMode?: boolean;
}) {
  const href = `/stores/${encodeURIComponent(shopSlug)}/products/${encodeURIComponent(productSlug)}`;
  return withCustomerStorefrontPreview(href, previewMode);
}

export function getCartItemProductHref({
  shopSlug,
  productSlug,
  categorySlug,
}: {
  shopSlug?: string | null;
  productSlug: string;
  categorySlug?: string | null;
}) {
  if (shopSlug) {
    return getRetailerProductHref({ shopSlug, productSlug });
  }

  return `/products/${encodeURIComponent(categorySlug || "all")}/${encodeURIComponent(productSlug)}`;
}
