import { withCustomerStorefrontPreview } from "./customer-storefront-preview";

export function storeFooterAnchor(
  slug: string,
  section: "store-information" | "store-products",
  previewMode: boolean,
) {
  return withCustomerStorefrontPreview(
    `/stores/${encodeURIComponent(slug)}#${section}`,
    previewMode,
  );
}

export function publicSocialUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
