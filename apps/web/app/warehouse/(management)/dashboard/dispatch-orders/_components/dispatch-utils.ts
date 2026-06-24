import type { DispatchOrderRow } from "./dispatch-columns";

export type DispatchModalMode = "dispatch" | "configure" | "pickup";

export type FulfillmentMode = "self_pickup" | "delivery";

export function customerName(order: DispatchOrderRow) {
  return (
    order.customer.warehouseName ||
    order.customer.shopName ||
    order.customer.name ||
    order.shipping.name
  );
}

export function getLatestPendingInvoice(order: DispatchOrderRow) {
  const pending = order.invoices.filter((inv) => inv.needsFulfillmentConfig);
  if (pending.length === 0) return null;
  return [...pending].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

export function getPendingPickupInvoice(order: DispatchOrderRow) {
  const pickups = order.invoices.filter(
    (inv) =>
      inv.fulfillmentMode === "self_pickup" &&
      !inv.completionOtpVerifiedAt &&
      inv.deliveryStatus !== "delivered",
  );
  if (pickups.length === 0) return null;
  return [...pickups].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

export function getDispatchModalMode(order: DispatchOrderRow): DispatchModalMode {
  const pendingPickup = getPendingPickupInvoice(order);
  if (pendingPickup) return "pickup";

  const canInvoice =
    order.status !== "invoiced" && order.progress.remainingQty > 0;
  if (canInvoice) return "dispatch";

  if (getLatestPendingInvoice(order)) return "configure";

  return "dispatch";
}

export function getDispatchActionLabel(order: DispatchOrderRow): string {
  const mode = getDispatchModalMode(order);
  if (mode === "pickup") return "Complete Pickup";
  if (mode === "configure") return "Set Delivery Mode";
  return "Dispatch";
}

export function getInvoiceStatusLabel(order: DispatchOrderRow): string {
  if (order.status === "ready_for_dispatch") return "—";
  if (order.status === "partially_invoiced") return "Partial";
  if (order.status === "invoiced") return "Full";
  return "—";
}

export function getDeliveryStatusLabel(order: DispatchOrderRow): {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
} {
  const delivered = order.invoices.every(
    (inv) => inv.deliveryStatus === "delivered",
  );
  if (order.invoices.length > 0 && delivered) {
    return { label: "Done", variant: "default" };
  }

  const pendingPickup = getPendingPickupInvoice(order);
  if (pendingPickup) {
    return { label: "Pickup", variant: "secondary" };
  }

  const hasDelivery = order.invoices.some(
    (inv) =>
      inv.fulfillmentMode === "delivery" ||
      inv.fulfillmentMode === "internal_delivery",
  );
  if (hasDelivery) {
    return { label: "Delivery", variant: "secondary" };
  }

  const hasPickup = order.invoices.some(
    (inv) => inv.fulfillmentMode === "self_pickup",
  );
  if (hasPickup) {
    return { label: "Pickup", variant: "secondary" };
  }

  if (getLatestPendingInvoice(order) || order.invoices.length > 0) {
    return { label: "Pending", variant: "outline" };
  }

  return { label: "—", variant: "outline" };
}

export function buildDefaultQuantities(order: DispatchOrderRow) {
  return order.items.reduce<Record<number, number>>((quantities, item) => {
    if (item.remainingQty > 0) {
      quantities[item.orderItemId] = item.remainingQty;
    }
    return quantities;
  }, {});
}

export function canShowDispatchAction(order: DispatchOrderRow): boolean {
  const mode = getDispatchModalMode(order);
  if (mode === "pickup" || mode === "configure") return true;
  return order.status !== "invoiced" && order.progress.remainingQty > 0;
}
