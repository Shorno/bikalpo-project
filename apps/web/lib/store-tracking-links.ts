export function storeTrackingOrderHref(
  trackingHref: string,
  orderNumber: string,
) {
  const [path, query] = trackingHref.split("?", 2);
  return `${path}/${encodeURIComponent(orderNumber)}${query ? `?${query}` : ""}`;
}
