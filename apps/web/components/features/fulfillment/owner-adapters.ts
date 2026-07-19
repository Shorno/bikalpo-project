import type { LucideIcon } from "lucide-react";
import {
  Bike,
  ClipboardCheck,
  FileText,
  PackageCheck,
  Route,
  Users,
} from "lucide-react";

export type FulfillmentCapabilities = {
  adjustQuantity: boolean;
  partialInvoice: boolean;
  selfPickup: boolean;
  chooseDeliveryType: boolean;
  batchInvoices: boolean;
};

export type FulfillmentStage = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type FulfillmentOwnerAdapter = {
  kind: "warehouse" | "retailer";
  label: string;
  capabilities: FulfillmentCapabilities;
  stages: FulfillmentStage[];
};

function buildStages(
  base: string,
  orderManagementPath: "incoming-orders" | "order-management",
): FulfillmentStage[] {
  return [
    {
      label: "Order Management",
      href: `${base}/${orderManagementPath}`,
      icon: ClipboardCheck,
    },
    {
      label: "Dispatch Orders",
      href: `${base}/dispatch-orders`,
      icon: FileText,
    },
    {
      label: "Delivery Management",
      href: `${base}/delivery-management`,
      icon: PackageCheck,
    },
    { label: "Delivery Team", href: `${base}/delivery-team`, icon: Users },
    {
      label: "Assign Orders",
      href: `${base}/delivery-team/assignments`,
      icon: Route,
    },
    {
      label: "Rider Assignment",
      href: `${base}/delivery-team/assignment`,
      icon: Bike,
    },
  ];
}

export const RETAILER_FULFILLMENT_ADAPTER: FulfillmentOwnerAdapter = {
  kind: "retailer",
  label: "Retail fulfillment",
  capabilities: {
    adjustQuantity: false,
    partialInvoice: false,
    selfPickup: false,
    chooseDeliveryType: false,
    batchInvoices: true,
  },
  stages: buildStages("/dashboard", "incoming-orders"),
};

export const WAREHOUSE_FULFILLMENT_ADAPTER: FulfillmentOwnerAdapter = {
  kind: "warehouse",
  label: "Warehouse fulfillment",
  capabilities: {
    adjustQuantity: true,
    partialInvoice: true,
    selfPickup: true,
    chooseDeliveryType: true,
    batchInvoices: true,
  },
  stages: buildStages("/warehouse/dashboard", "order-management"),
};
