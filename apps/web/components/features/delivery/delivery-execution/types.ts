import type {
  DeliveryGroup,
  DeliveryGroupInvoice,
  DeliveryInvoiceStatus,
} from "@/types/api/common";
import type { Invoice, InvoiceItem } from "@/types/api/common";
import type { Order } from "@/types/api/common";

// ============================================================================
// Customer Types
// ============================================================================

export interface InvoiceCustomer {
  id: string;
  name: string;
  phoneNumber: string | null;
  shopName?: string | null;
}

// ============================================================================
// Invoice Item Types
// ============================================================================

export interface DeliveryInvoiceItem
  extends Pick<
    InvoiceItem,
    | "id"
    | "productName"
    | "productImage"
    | "productSku"
    | "quantity"
    | "unitPrice"
    | "lineTotal"
  > {}

// ============================================================================
// Delivery Invoice Types
// ============================================================================

export interface DeliveryInvoiceWithDetails extends DeliveryGroupInvoice {
  invoice: Pick<
    Invoice,
    "id" | "invoiceNumber" | "grandTotal" | "invoiceType" | "splitSequence"
  > & {
    customer: InvoiceCustomer | null;
    items: DeliveryInvoiceItem[];
    order: Pick<
      Order,
      | "id"
      | "orderNumber"
      | "shippingAddress"
      | "shippingCity"
      | "shippingArea"
      | "shippingPhone"
      | "shippingName"
    > | null;
  };
}

// ============================================================================
// Delivery Group Types
// ============================================================================

export interface DeliveryGroupWithDetails extends DeliveryGroup {
  invoices: DeliveryInvoiceWithDetails[];
  deliveryman?: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
  };
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface DeliveryExecutionProps {
  group: DeliveryGroupWithDetails;
}

export type ActionType = "delivered" | "failed" | "return";

// Re-export schema types for convenience
export type { DeliveryInvoiceStatus };

// Backward compatibility alias (deprecated - use DeliveryInvoiceWithDetails instead)
export type DeliveryOrderWithDetails = DeliveryInvoiceWithDetails;

