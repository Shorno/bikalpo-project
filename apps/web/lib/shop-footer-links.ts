import { withCustomerStorefrontPreview } from "./customer-storefront-preview";

export function storeFooterAnchor(
  slug: string,
  section: "store-information" | "store-products" | "available-brands",
  previewMode: boolean,
) {
  return withCustomerStorefrontPreview(
    `/stores/${encodeURIComponent(slug)}#${section}`,
    previewMode,
  );
}

/**
 * The store's public address as people would type it, e.g.
 * "bikalpo.com/stores/rahim-store" — no protocol or "www.". Without a known
 * base it falls back to the path alone.
 */
export function storeDisplayUrl(slug: string, publicBaseUrl?: string) {
  const path = `/stores/${slug}`;
  if (!publicBaseUrl) return path;
  const host = publicBaseUrl
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
  return `${host}${path}`;
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
