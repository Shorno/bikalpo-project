export const DELIVERY_START_ORDER_STATUSES = [
  "pending",
  "approved",
  "confirmed",
  "ready_for_dispatch",
  "partially_invoiced",
  "invoiced",
  "processing",
] as const;

type HandoffInvoice = {
  id: number;
  invoiceNumber: string;
  fulfillmentMode?: string | null;
  completionOtp?: string | null;
  completionOtpVerifiedAt?: Date | string | null;
};

type HandoffDeliveryLink = {
  invoiceId: number;
  groupStatus: string;
  invoiceStatus?: string | null;
  deliveryOtp?: string | null;
};

export type RetailerHandoffOtp = {
  invoiceId: number;
  invoiceNumber: string;
  label: "Delivery OTP" | "Pickup OTP";
  mode: "internal_delivery" | "self_pickup";
  otp: string;
};

export function getRetailerOrderDisplayStatus(
  orderStatus: string,
  deliveryLinks: HandoffDeliveryLink[],
) {
  if (["cancelled", "returned"].includes(orderStatus)) return orderStatus;

  const hasActiveDelivery = deliveryLinks.some(
    (link) =>
      link.groupStatus === "out_for_delivery" &&
      link.invoiceStatus === "pending" &&
      !!link.deliveryOtp,
  );

  return hasActiveDelivery ? "processing" : orderStatus;
}

export function getRetailerHandoffOtps(
  invoices: HandoffInvoice[],
  deliveryLinks: HandoffDeliveryLink[],
): RetailerHandoffOtp[] {
  const invoiceById = new Map(invoices.map((item) => [item.id, item]));
  const seenInvoiceIds = new Set<number>();
  const handoffOtps: RetailerHandoffOtp[] = [];

  for (const link of deliveryLinks) {
    const linkedInvoice = invoiceById.get(link.invoiceId);
    if (
      !linkedInvoice ||
      seenInvoiceIds.has(link.invoiceId) ||
      link.groupStatus !== "out_for_delivery" ||
      link.invoiceStatus !== "pending" ||
      !link.deliveryOtp
    ) {
      continue;
    }

    seenInvoiceIds.add(link.invoiceId);
    handoffOtps.push({
      invoiceId: link.invoiceId,
      invoiceNumber: linkedInvoice.invoiceNumber,
      label: "Delivery OTP",
      mode: "internal_delivery",
      otp: link.deliveryOtp,
    });
  }

  for (const item of invoices) {
    if (
      seenInvoiceIds.has(item.id) ||
      item.fulfillmentMode !== "self_pickup" ||
      !item.completionOtp ||
      item.completionOtpVerifiedAt
    ) {
      continue;
    }

    handoffOtps.push({
      invoiceId: item.id,
      invoiceNumber: item.invoiceNumber,
      label: "Pickup OTP",
      mode: "self_pickup",
      otp: item.completionOtp,
    });
  }

  return handoffOtps;
}
