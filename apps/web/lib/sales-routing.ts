export const SALES_PORTAL_BASE = "/dashboard";
export const DEFAULT_SALES_SUBDOMAIN_URL =
  "http://sales.bikalpo.localhost:3001";

export function getSalesSubdomainUrl() {
  return (
    process.env.NEXT_PUBLIC_SALES_SUBDOMAIN_URL ||
    DEFAULT_SALES_SUBDOMAIN_URL
  ).replace(/\/$/, "");
}

