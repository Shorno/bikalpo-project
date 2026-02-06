import type {
  DeliveryGroup,
  DeliveryGroupInvoice,
  DeliveryGroupStatus,
  DeliveryInvoiceStatus,
} from "@/db/schema/delivery";
import type { Invoice } from "@/db/schema/invoice";
import type { Order } from "@/db/schema/order";

// ============================================================================
// Customer Types
// ============================================================================

export interface InvoiceCustomer {
  name: string;
  phoneNumber: string | null;
}

// ============================================================================
// Delivery Invoice Item Types (for list view)
// ============================================================================

export interface DeliveryInvoiceItem extends DeliveryGroupInvoice {
  invoice: Pick<Invoice, "invoiceNumber" | "grandTotal" | "invoiceType"> & {
    customer: InvoiceCustomer | null;
    order: Pick<Order, "shippingAddress" | "shippingCity"> | null;
  };
}

// ============================================================================
// Delivery Group Types (for list view)
// ============================================================================

export interface DeliveryGroupListItem extends DeliveryGroup {
  invoices: DeliveryInvoiceItem[];
}

// ============================================================================
// Component Props
// ============================================================================

export interface StatusBadgeProps {
  status: DeliveryGroupStatus | DeliveryInvoiceStatus;
  type: "group" | "invoice";
}

export interface InvoiceRowProps {
  item: DeliveryInvoiceItem;
}

export interface DeliveryGroupCardProps {
  group: DeliveryGroupListItem;
}

export interface DeliveryGroupsListProps {
  groups: DeliveryGroupListItem[];
}

// Re-export for convenience
export type { DeliveryGroupStatus, DeliveryInvoiceStatus };
