export type DeliveryKpiFilter = "all" | "pending" | "in_delivery" | "delivered";
export type DeliveryTypeFilter =
  | "all"
  | "not_selected"
  | "internal"
  | "third_party";
export type DeliveryDisplayStatus =
  | "pending"
  | "locked"
  | "in_delivery"
  | "delivered";

export type DeliveryInvoiceRow = {
  id: number;
  invoiceNumber: string;
  grandTotal: string;
  fulfillmentMode: string | null;
  deliveryStatus: string | null;
  createdAt: string | Date;
  deliveryType: DeliveryTypeFilter extends "all" ? string : DeliveryTypeFilter;
  displayStatus: DeliveryDisplayStatus;
  kpiBucket: DeliveryKpiFilter;
  isSelectable: boolean;
  group: {
    id: number;
    groupName: string;
    status: string;
    hasRider: boolean;
  } | null;
  customer: {
    id: string;
    name: string;
    phoneNumber: string | null;
    shopName: string | null;
    warehouseName: string | null;
    displayName: string;
  };
  order: {
    id: number;
    orderNumber: string;
    shippingArea: string | null;
    shippingCity: string | null;
    shippingAddress: string | null;
    shippingPhone: string | null;
  } | null;
};

export function customerLabel(row: DeliveryInvoiceRow) {
  return (
    row.customer.displayName ||
    row.customer.warehouseName ||
    row.customer.shopName ||
    row.customer.name ||
    row.order?.shippingName ||
    "—"
  );
}

export function formatMoney(value: string | number) {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getDeliveryTypeLabel(
  type: DeliveryInvoiceRow["deliveryType"],
): string {
  switch (type) {
    case "internal":
      return "Internal";
    case "third_party":
      return "Third Party";
    default:
      return "Not Selected";
  }
}

export function getDisplayStatusLabel(status: DeliveryDisplayStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "locked":
      return "Locked";
    case "in_delivery":
      return "In Delivery";
    case "delivered":
      return "Delivered";
    default:
      return status;
  }
}

export function getDisplayStatusTone(
  status: DeliveryDisplayStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "pending":
      return "secondary";
    case "locked":
      return "outline";
    case "in_delivery":
      return "default";
    case "delivered":
      return "secondary";
    default:
      return "outline";
  }
}

export function suggestGroupName(invoices: DeliveryInvoiceRow[]) {
  const areas = [
    ...new Set(
      invoices
        .map((inv) => inv.order?.shippingArea?.trim())
        .filter((area): area is string => !!area),
    ),
  ];
  const date = new Date().toLocaleDateString("en-BD", {
    day: "2-digit",
    month: "short",
  });
  if (areas.length === 1) {
    return `${areas[0]} · ${date}`;
  }
  if (areas.length > 1) {
    return `Mixed areas · ${date}`;
  }
  return `Delivery group · ${date}`;
}
