const DEFAULT_PUBLIC_APP_URL = "http://bikalpo.localhost:3001";

const PORTAL_SUBDOMAINS = new Set([
  "shop",
  "warehouse",
  "b2b",
  "delivery",
  "sales",
]);

export function getPublicAppBaseUrl(currentOrigin?: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_SUBDOMAIN_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const origin =
    currentOrigin ??
    (typeof window !== "undefined" ? window.location.origin : undefined);

  if (!origin) return DEFAULT_PUBLIC_APP_URL;

  try {
    const url = new URL(origin);
    const hostnameParts = url.hostname.split(".");

    if (hostnameParts.length > 2 && PORTAL_SUBDOMAINS.has(hostnameParts[0]!)) {
      url.hostname = hostnameParts.slice(1).join(".");
    }

    return url.origin;
  } catch {
    return DEFAULT_PUBLIC_APP_URL;
  }
}

export function getWarehouseStorefrontUrl(
  warehouseSlug: string,
  currentOrigin?: string,
) {
  return `${getPublicAppBaseUrl(currentOrigin)}/w/${encodeURIComponent(warehouseSlug)}`;
}
