export const DELIVERY_PORTAL_BASE = "/dashboard";
export const DEFAULT_DELIVERY_SUBDOMAIN_URL =
  "http://delivery.bikalpo.localhost:3001";

export function getDeliverySubdomainUrl() {
  return (
    process.env.NEXT_PUBLIC_DELIVERY_SUBDOMAIN_URL ||
    DEFAULT_DELIVERY_SUBDOMAIN_URL
  ).replace(/\/$/, "");
}
