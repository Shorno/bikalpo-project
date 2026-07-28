import type {
  DeliveryGroup,
  DeliveryGroupInvoice,
  DeliveryGroupStatus,
  DeliveryInvoiceStatus,
  Invoice,
  Order,
} from "@bikalpo-project/db/schema";

// ============================================================================
// Delivery Recipient Types
// ============================================================================

export interface InvoiceCustomer {
  name: string;
  phoneNumber: string | null;
}

export interface DeliveryRecipient {
  type: "consumer" | "retailer_store" | "warehouse";
  displayName: string;
}

// ============================================================================
// Delivery Invoice Item Types (for list view)
// ============================================================================

export interface DeliveryInvoiceItem extends DeliveryGroupInvoice {
  invoice: Pick<Invoice, "invoiceNumber" | "grandTotal" | "invoiceType"> & {
    customer: InvoiceCustomer | null;
    recipient: DeliveryRecipient;
    order: Pick<
      Order,
      "orderNumber" | "shippingAddress" | "shippingCity"
    > | null;
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
