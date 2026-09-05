export const DEFAULT_SHOP_SUBDOMAIN_URL =
  "http://shop.bikalpo.localhost:3001";

export function getShopSubdomainUrl() {
  return (
    process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL || DEFAULT_SHOP_SUBDOMAIN_URL
  ).replace(/\/$/, "");
}
