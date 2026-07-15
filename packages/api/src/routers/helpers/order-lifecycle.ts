export type CanonicalOrderFlowTone = "default" | "warning" | "danger";

export type CanonicalOrderFlowStep = {
  key: string;
  label: string;
  completed: boolean;
  date: Date | string | null;
  tone?: CanonicalOrderFlowTone;
};

type FlowDate = Date | string | null | undefined;

type OrderForCanonicalFlow = {
  status: string;
  createdAt: Date | string;
  updatedAt?: FlowDate;
  confirmedAt?: FlowDate;
  modifiedByWarehouseAt?: FlowDate;
  modificationAcceptedAt?: FlowDate;
  modificationRejectedAt?: FlowDate;
  packingStartedAt?: FlowDate;
  readyAt?: FlowDate;
  deliveredAt?: FlowDate;
  receivedAt?: FlowDate;
  cancelledAt?: FlowDate;
};

type InvoiceForCanonicalFlow = {
  id: number;
  createdAt: Date | string;
  approvedAt?: FlowDate;
  deliveredAt?: FlowDate;
  receivedAt?: FlowDate;
  deliveryStatus: string;
  fulfillmentMode?: string | null;
  completionOtp?: string | null;
  completionOtpVerifiedAt?: FlowDate;
  deliverymanId?: string | null;
};

type DeliveryLinkForCanonicalFlow = {
  invoiceId: number;
  groupStatus: string;
  deliverymanId?: string | null;
  assignedAt?: FlowDate;
  startedAt?: FlowDate;
  invoiceStatus?: string | null;
  deliveredAt?: FlowDate;
};

type BuildCanonicalOrderFlowInput = {
  order: OrderForCanonicalFlow;
  invoices?: InvoiceForCanonicalFlow[];
  deliveryLinks?: DeliveryLinkForCanonicalFlow[];
};

const POST_APPROVAL_STATUSES = new Set([
  "approved",
  "confirmed",
  "ready_for_dispatch",
  "partially_invoiced",
  "invoiced",
  "processing",
  "delivered",
  "returned",
]);

const READY_STATUSES = new Set([
  "ready_for_dispatch",
  "partially_invoiced",
  "invoiced",
  "processing",
  "delivered",
  "returned",
]);

const INVOICED_STATUSES = new Set([
  "partially_invoiced",
  "invoiced",
  "processing",
  "delivered",
  "returned",
]);

function earliestDate(values: FlowDate[]): Date | string | null {
  const available = values.filter(
    (value): value is Date | string => value !== null && value !== undefined,
  );

  if (available.length === 0) return null;

  return available.reduce((earliest, value) => {
    const earliestTime = new Date(earliest).getTime();
    const valueTime = new Date(value).getTime();

    if (Number.isNaN(valueTime)) return earliest;
    if (Number.isNaN(earliestTime)) return value;
    return valueTime < earliestTime ? value : earliest;
  });
}

function getFulfillmentMode(
  invoices: InvoiceForCanonicalFlow[],
  deliveryLinks: DeliveryLinkForCanonicalFlow[],
) {
  const modes = new Set(
    invoices
      .map((invoice) => invoice.fulfillmentMode)
      .filter((mode): mode is string => !!mode),
  );

  if (modes.size === 0) {
    if (
      invoices.some(
        (invoice) =>
          !!invoice.completionOtp || !!invoice.completionOtpVerifiedAt,
      )
    ) {
      return "self_pickup";
    }

    if (
      deliveryLinks.length > 0 ||
      invoices.some(
        (invoice) =>
          invoice.deliveryStatus !== "not_assigned" || !!invoice.deliverymanId,
      )
    ) {
      return "delivery";
    }

    return null;
  }
  if (modes.size === 1 && modes.has("self_pickup")) return "self_pickup";
  return "delivery";
}

export function buildCanonicalOrderFlow({
  order,
  invoices = [],
  deliveryLinks = [],
}: BuildCanonicalOrderFlowInput): CanonicalOrderFlowStep[] {
  const placedStep: CanonicalOrderFlowStep = {
    key: "placed",
    label: "Order Placed",
    completed: true,
    date: order.createdAt,
  };

  if (order.status === "cancelled") {
    return [
      placedStep,
      {
        key: "cancelled",
        label: "Cancelled",
        completed: true,
        date: order.cancelledAt ?? order.updatedAt ?? null,
        tone: "danger",
      },
    ];
  }

  const firstInvoiceDate = earliestDate(
    invoices.map((invoice) => invoice.createdAt),
  );
  const hasInvoices = invoices.length > 0;
  const isModified = !!order.modifiedByWarehouseAt;
  const requiresBuyerApproval =
    isModified &&
    !order.modificationAcceptedAt &&
    !order.modificationRejectedAt &&
    order.status !== "returned";
  const reviewCompleted =
    order.status !== "pending" ||
    !!order.confirmedAt ||
    !!order.modifiedByWarehouseAt;
  const approvedCompleted =
    !requiresBuyerApproval &&
    (!!order.confirmedAt ||
      !!order.modificationAcceptedAt ||
      POST_APPROVAL_STATUSES.has(order.status));
  const readyCompleted =
    !!order.packingStartedAt ||
    !!order.readyAt ||
    hasInvoices ||
    READY_STATUSES.has(order.status);
  const invoicedCompleted = hasInvoices || INVOICED_STATUSES.has(order.status);

  const baseSteps: CanonicalOrderFlowStep[] = [
    placedStep,
    {
      key: "review",
      label: "Review",
      completed: reviewCompleted,
      date: order.modifiedByWarehouseAt ?? order.confirmedAt ?? null,
    },
    {
      key: "approved",
      label: requiresBuyerApproval ? "Awaiting Buyer Approval" : "Approved",
      completed: approvedCompleted,
      date: requiresBuyerApproval
        ? null
        : (order.modificationAcceptedAt ?? order.confirmedAt ?? null),
      tone: isModified ? "warning" : undefined,
    },
    {
      key: "ready",
      label: "Packing / Ready",
      completed: readyCompleted,
      date: order.readyAt ?? order.packingStartedAt ?? firstInvoiceDate ?? null,
    },
    {
      key: "invoiced",
      label: "Invoice Prepared",
      completed: invoicedCompleted,
      date: firstInvoiceDate,
    },
  ];

  const fulfillmentMode = getFulfillmentMode(invoices, deliveryLinks);
  const hasDeliveryIssue =
    invoices.some((invoice) =>
      ["failed", "returned"].includes(invoice.deliveryStatus),
    ) ||
    deliveryLinks.some((link) =>
      ["failed", "returned"].includes(link.invoiceStatus ?? ""),
    );
  const deliveredCompleted =
    !!order.deliveredAt || order.status === "delivered";
  const receivedCompleted = !!order.receivedAt;

  if (fulfillmentMode === "self_pickup") {
    const readyForPickupCompleted = invoices.some(
      (invoice) =>
        !!invoice.completionOtp ||
        !!invoice.completionOtpVerifiedAt ||
        invoice.deliveryStatus === "delivered",
    );
    const collectedCompleted =
      invoices.some(
        (invoice) =>
          !!invoice.completionOtpVerifiedAt ||
          !!invoice.deliveredAt ||
          invoice.deliveryStatus === "delivered",
      ) || deliveredCompleted;
    const pickupSteps: CanonicalOrderFlowStep[] = [
      {
        key: "ready_for_pickup",
        label: "Ready for Pickup",
        completed: readyForPickupCompleted,
        date: earliestDate(
          invoices
            .filter(
              (invoice) =>
                !!invoice.completionOtp || !!invoice.completionOtpVerifiedAt,
            )
            .map((invoice) => invoice.createdAt),
        ),
      },
      {
        key: "collected",
        label: "Collected",
        completed: collectedCompleted,
        date: earliestDate([
          ...invoices.map((invoice) => invoice.completionOtpVerifiedAt),
          ...invoices.map((invoice) => invoice.deliveredAt),
          order.deliveredAt,
        ]),
      },
    ];

    if (order.status === "returned") {
      return [
        ...baseSteps,
        ...pickupSteps.filter((step) => step.completed),
        {
          key: "returned",
          label: "Returned",
          completed: true,
          date: order.updatedAt ?? null,
          tone: "warning",
        },
      ];
    }

    if (hasDeliveryIssue && !deliveredCompleted) {
      return [
        ...baseSteps,
        ...pickupSteps.filter((step) => step.completed),
        {
          key: "delivery_issue",
          label: "Fulfillment Issue",
          completed: false,
          date: null,
          tone: "warning",
        },
      ];
    }

    return [
      ...baseSteps,
      ...pickupSteps,
      {
        key: "received",
        label: "Received",
        completed: receivedCompleted,
        date: order.receivedAt ?? null,
      },
    ];
  }

  if (fulfillmentMode === "delivery") {
    const dispatchedCompleted =
      deliveryLinks.length > 0 ||
      invoices.some(
        (invoice) =>
          invoice.deliveryStatus !== "not_assigned" ||
          !!invoice.approvedAt ||
          !!invoice.deliverymanId,
      );
    const inTransitCompleted =
      invoices.some((invoice) =>
        ["out_for_delivery", "delivered"].includes(invoice.deliveryStatus),
      ) ||
      deliveryLinks.some((link) =>
        ["out_for_delivery", "completed"].includes(link.groupStatus),
      );
    const deliverySteps: CanonicalOrderFlowStep[] = [
      {
        key: "dispatched",
        label: "Dispatched",
        completed: dispatchedCompleted,
        date: earliestDate([
          ...deliveryLinks.map((link) => link.assignedAt),
          ...invoices.map((invoice) => invoice.approvedAt),
        ]),
      },
      {
        key: "in_transit",
        label: "In Transit",
        completed: inTransitCompleted,
        date: earliestDate([...deliveryLinks.map((link) => link.startedAt)]),
      },
    ];

    if (order.status === "returned") {
      return [
        ...baseSteps,
        ...deliverySteps.filter((step) => step.completed),
        {
          key: "returned",
          label: "Returned",
          completed: true,
          date: order.updatedAt ?? null,
          tone: "warning",
        },
      ];
    }

    if (hasDeliveryIssue && !deliveredCompleted) {
      return [
        ...baseSteps,
        ...deliverySteps.filter((step) => step.completed),
        {
          key: "delivery_issue",
          label: "Delivery Issue",
          completed: false,
          date: null,
          tone: "warning",
        },
      ];
    }

    return [
      ...baseSteps,
      ...deliverySteps,
      {
        key: "delivered",
        label: "Delivered",
        completed: deliveredCompleted,
        date: order.deliveredAt ?? null,
      },
      {
        key: "received",
        label: "Received",
        completed: receivedCompleted,
        date: order.receivedAt ?? null,
      },
    ];
  }

  const fulfillmentStarted = ["processing", "delivered", "returned"].includes(
    order.status,
  );
  const genericFulfillmentStep: CanonicalOrderFlowStep = {
    key: "fulfillment",
    label: "Dispatch / Pickup",
    completed: fulfillmentStarted,
    date: null,
  };

  if (order.status === "returned") {
    return [
      ...baseSteps,
      ...(genericFulfillmentStep.completed ? [genericFulfillmentStep] : []),
      {
        key: "returned",
        label: "Returned",
        completed: true,
        date: order.updatedAt ?? null,
        tone: "warning",
      },
    ];
  }

  return [
    ...baseSteps,
    genericFulfillmentStep,
    {
      key: "delivered",
      label: "Delivered",
      completed: deliveredCompleted,
      date: order.deliveredAt ?? null,
    },
    {
      key: "received",
      label: "Received",
      completed: receivedCompleted,
      date: order.receivedAt ?? null,
    },
  ];
}
