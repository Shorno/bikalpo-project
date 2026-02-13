export type Address = any;
export type Announcement = any;
export type Brand = any;
export type BrandUpdate = any;
export type Category = any;
export type DeliveryGroup = any;
export type DeliveryGroupInvoice = any;
export type DeliveryRule = any;
export type DeliveryStatsCount = any;
export type Invoice = any;
export type InvoiceItem = any;
export type InvoiceWithItems = any;
export type ItemRequestWithRelations = any;
export type Order = any;
export type OrderWithItems = any;
export type Product = any;
export type ProductFeatureGroup = any;
export type ProductImage = any;
export type ProductVariant = any;
export type ProductWithRelations = any;
export type QuantitySelectorOption = any;
export type ReviewWithUser = any;
export type SubCategory = any;
export type SupportTicket = any;
export type TicketStatus = any;
export type User = any;
export type CustomerListItem = any;

export type PaymentMethod = "cash_on_delivery" | "bkash" | "nagad";

export type InvoicePaymentStatus = "unpaid" | "collected" | "settled";
export type InvoiceDeliveryStatus =
  | "not_assigned"
  | "pending"
  | "out_for_delivery"
  | "delivered"
  | "failed";

export type DeliveryGroupStatus =
  | "pending"
  | "assigned"
  | "in_transit"
  | "completed"
  | "cancelled"
  | (string & {});

export type DeliveryInvoiceStatus =
  | "pending"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned"
  | (string & {});

export type ItemRequestStatus =
  | "pending"
  | "reviewed"
  | "approved"
  | "rejected"
  | "fulfilled"
  | (string & {});
