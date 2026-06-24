export type AssignmentKpiFilter =
  | "all"
  | "pending_assignment"
  | "assigned"
  | "completed";

export type AssignmentGroupRow = {
  id: number;
  groupName: string;
  status: string;
  kpiBucket: AssignmentKpiFilter | "pending_assignment" | "assigned" | "completed";
  totalInvoices: number;
  completedInvoices: number;
  totalAmount: string;
  areaLabel: string;
  createdAt: string | Date;
  rider: {
    id: string;
    name: string;
    phoneNumber: string | null;
  } | null;
  hasRider: boolean;
};

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

export function getGroupStatusLabel(status: string): string {
  switch (status) {
    case "pending_assignment":
      return "Pending";
    case "assigned":
      return "Assigned";
    case "out_for_delivery":
      return "On route";
    case "completed":
      return "Completed";
    case "partial":
      return "Partial";
    default:
      return status;
  }
}

export function getGroupStatusTone(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "pending_assignment":
      return "secondary";
    case "assigned":
      return "default";
    case "out_for_delivery":
      return "default";
    case "completed":
      return "outline";
    case "partial":
      return "destructive";
    default:
      return "outline";
  }
}

export function canAssignRider(status: string) {
  return status === "pending_assignment" || status === "assigned";
}

export function resolveCustomerDisplayName(input: {
  warehouseName?: string | null;
  shopName?: string | null;
  name?: string | null;
  shippingName?: string | null;
}) {
  return (
    input.warehouseName ||
    input.shopName ||
    input.name ||
    input.shippingName ||
    "—"
  );
}

export function rollUpAreaLabel(areas: Array<string | null | undefined>) {
  const unique = [
    ...new Set(
      areas.map((area) => area?.trim()).filter((area): area is string => !!area),
    ),
  ];
  if (unique.length === 0) return "—";
  if (unique.length === 1) return unique[0];
  return "Mixed";
}

export function getInvoiceStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Assigned";
    case "delivered":
      return "Delivered";
    case "failed":
      return "Failed";
    case "returned":
      return "Returned";
    default:
      return status;
  }
}

export function getAssignmentKpiBucketFromStatus(
  status: string,
): AssignmentKpiFilter {
  switch (status) {
    case "pending_assignment":
      return "pending_assignment";
    case "assigned":
    case "out_for_delivery":
      return "assigned";
    case "completed":
    case "partial":
      return "completed";
    default:
      return "all";
  }
}

type GroupDetailForAssignmentRow = {
  id: number;
  groupName: string;
  status: string;
  totalInvoices: number;
  completedInvoices: number;
  createdAt: string | Date;
  deliveryman: {
    id: string;
    name: string;
    phoneNumber: string | null;
  } | null;
  invoices: Array<{
    invoice?: {
      grandTotal?: string | null;
      order?: { shippingArea?: string | null } | null;
    } | null;
  }>;
};

export function buildAssignmentGroupRowFromDetail(
  group: GroupDetailForAssignmentRow,
): AssignmentGroupRow {
  const totalAmount = group.invoices.reduce((sum, link) => {
    const value = Number.parseFloat(link.invoice?.grandTotal ?? "0");
    return sum + (Number.isNaN(value) ? 0 : value);
  }, 0);

  return {
    id: group.id,
    groupName: group.groupName,
    status: group.status,
    kpiBucket: getAssignmentKpiBucketFromStatus(group.status),
    totalInvoices: group.totalInvoices,
    completedInvoices: group.completedInvoices,
    totalAmount: totalAmount.toFixed(2),
    areaLabel: rollUpAreaLabel(
      group.invoices.map((link) => link.invoice?.order?.shippingArea),
    ),
    createdAt: group.createdAt,
    rider: group.deliveryman,
    hasRider: !!group.deliveryman,
  };
}

export function getAssignOrdersGroupHref(groupId: number) {
  return `/warehouse/dashboard/delivery-team/assignments?group=${groupId}`;
}
