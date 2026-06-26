export const DELIVERY_PORTAL_BASE = "/dashboard";
export const DELIVERY_SUBDOMAIN_HOST_PREFIX = "delivery.";
export const DEFAULT_DELIVERY_SUBDOMAIN_URL =
  "http://delivery.bikalpo.localhost:3001";

export function isDeliverySubdomainHost(hostname?: string | null) {
  const host = (hostname ?? "").split(":")[0]?.toLowerCase();
  return host.startsWith(DELIVERY_SUBDOMAIN_HOST_PREFIX);
}

export function getDeliverySubdomainUrl() {
  return (
    process.env.NEXT_PUBLIC_DELIVERY_SUBDOMAIN_URL ||
    DEFAULT_DELIVERY_SUBDOMAIN_URL
  ).replace(/\/$/, "");
}
