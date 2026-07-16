const CUSTOMER_PREVIEW_VALUE = "customer";

export function isCustomerStorefrontPreview(value: string | null | undefined) {
  return value === CUSTOMER_PREVIEW_VALUE;
}

export function withCustomerStorefrontPreview(
  href: string,
  previewMode: boolean,
) {
  if (!previewMode) return href;

  const [pathAndQuery, hash] = href.split("#", 2);
  const separator = pathAndQuery.includes("?") ? "&" : "?";
  const previewHref = `${pathAndQuery}${separator}preview=${CUSTOMER_PREVIEW_VALUE}`;

  return hash ? `${previewHref}#${hash}` : previewHref;
}

export function getPublicAppBaseUrl(currentOrigin?: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_SUBDOMAIN_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");

  if (currentOrigin) {
    const url = new URL(currentOrigin);
    if (url.hostname.startsWith("shop.")) {
      url.hostname = url.hostname.slice("shop.".length);
    }
    return url.origin;
  }

  return "http://bikalpo.localhost:3001";
}

export function getShopStorefrontUrl(
  shopSlug: string,
  options: { currentOrigin?: string; previewMode?: boolean } = {},
) {
  const url = new URL(
    `/stores/${encodeURIComponent(shopSlug)}`,
    getPublicAppBaseUrl(options.currentOrigin),
  );

  if (options.previewMode) {
    url.searchParams.set("preview", CUSTOMER_PREVIEW_VALUE);
  }

  return url.toString();
}

export function getShopStoreDashboardUrl() {
  const shopPortalUrl =
    process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL?.trim() ||
    "http://shop.bikalpo.localhost:3001";

  return `${shopPortalUrl.replace(/\/+$/, "")}/dashboard/stores`;
}
