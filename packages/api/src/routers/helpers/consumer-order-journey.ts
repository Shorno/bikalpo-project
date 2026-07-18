export const consumerJourneyStepKeys = [
  "placed",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
] as const;

export type ConsumerJourneyStepKey =
  (typeof consumerJourneyStepKeys)[number];
export type ConsumerJourneyPhase =
  | ConsumerJourneyStepKey
  | "cancelled"
  | "delivery_issue"
  | "returned";
export type ConsumerJourneyStepState = "complete" | "current" | "upcoming";

type JourneyOrder = {
  status: string;
  createdAt: Date;
  confirmedAt?: Date | null;
  readyAt?: Date | null;
  shippedAt?: Date | null;
  deliveredAt?: Date | null;
  receivedAt?: Date | null;
  cancelledAt?: Date | null;
  riderName?: string | null;
  riderPhone?: string | null;
};

type JourneyInvoice = {
  id: number;
  invoiceNumber: string;
  createdAt: Date;
  deliveryStatus?: string | null;
};

type JourneyDeliveryLink = {
  invoiceId: number;
  groupStatus: string;
  invoiceStatus?: string | null;
  assignedAt?: Date | null;
  startedAt?: Date | null;
  deliveredAt?: Date | null;
  deliveryOtp?: string | null;
};

export type ConsumerOrderJourney = {
  phase: ConsumerJourneyPhase;
  steps: Array<{
    key: ConsumerJourneyStepKey;
    state: ConsumerJourneyStepState;
    completedAt: Date | null;
  }>;
  invoice: {
    id: number;
    invoiceNumber: string;
    createdAt: Date;
  } | null;
  delivery: {
    status: string | null;
    riderName: string | null;
    riderPhone: string | null;
    otp: string | null;
    assignedAt: Date | null;
    startedAt: Date | null;
    deliveredAt: Date | null;
  };
};

export function buildConsumerOrderJourney(input: {
  order: JourneyOrder;
  invoices?: JourneyInvoice[];
  deliveryLinks?: JourneyDeliveryLink[];
}): ConsumerOrderJourney {
  const invoices = input.invoices ?? [];
  const deliveryLinks = input.deliveryLinks ?? [];
  const primaryInvoice = invoices[0] ?? null;
  const activeLink = deliveryLinks.find(
    (link) =>
      link.invoiceStatus === "pending" &&
      ["out_for_delivery", "assigned", "pending_assignment"].includes(
        link.groupStatus,
      ),
  );
  const historicalLink =
    deliveryLinks.find((link) => link.invoiceStatus === "delivered") ??
    deliveryLinks.find((link) => link.invoiceStatus === "returned") ??
    deliveryLinks.find((link) => link.invoiceStatus === "failed") ??
    deliveryLinks[0] ??
    null;
  const currentLink =
    activeLink ??
    (primaryInvoice?.deliveryStatus === "not_assigned"
      ? null
      : historicalLink);

  let stepPhase: ConsumerJourneyStepKey = "placed";
  if (
    input.order.status === "delivered" ||
    !!input.order.receivedAt ||
    (invoices.length > 0 &&
      invoices.every((entry) => entry.deliveryStatus === "delivered"))
  ) {
    stepPhase = "delivered";
  } else if (input.order.status === "returned") {
    stepPhase = "out_for_delivery";
  } else if (
    currentLink?.groupStatus === "out_for_delivery" ||
    (input.order.status === "processing" && !!input.order.shippedAt)
  ) {
    stepPhase = "out_for_delivery";
  } else if (
    invoices.length > 0 ||
    ["partially_invoiced", "invoiced", "processing"].includes(
      input.order.status,
    )
  ) {
    stepPhase = "preparing";
  } else if (
    input.order.confirmedAt ||
    input.order.readyAt ||
    ["confirmed", "approved", "ready_for_dispatch"].includes(input.order.status)
  ) {
    stepPhase = "confirmed";
  }
  const hasDeliveryIssue =
    invoices.length > 0
      ? invoices.some((entry) => entry.deliveryStatus === "failed")
      : deliveryLinks.some((link) => link.invoiceStatus === "failed");
  const phase: ConsumerJourneyPhase =
    input.order.status === "cancelled"
      ? "cancelled"
      : input.order.status === "returned"
        ? "returned"
        : hasDeliveryIssue
          ? "delivery_issue"
          : stepPhase;
  const currentIndex = consumerJourneyStepKeys.indexOf(stepPhase);

  return {
    phase,
    steps: consumerJourneyStepKeys.map((key, index) => ({
      key,
      state:
        phase === "cancelled"
          ? index <= currentIndex
            ? "complete"
            : "upcoming"
          : phase === "returned"
            ? index <= consumerJourneyStepKeys.indexOf("out_for_delivery")
              ? "complete"
              : "upcoming"
            : index < currentIndex
              ? "complete"
              : index === currentIndex
                ? "current"
                : "upcoming",
      completedAt:
        index === 0
          ? input.order.createdAt
          : index === 1 && currentIndex >= 1
            ? (input.order.confirmedAt ?? input.order.readyAt ?? null)
            : index === 2 && currentIndex >= 2
              ? (primaryInvoice?.createdAt ?? input.order.readyAt ?? null)
              : index === 3 && currentIndex >= 3
                ? (currentLink?.startedAt ?? input.order.shippedAt ?? null)
                : index === 4 && currentIndex >= 4
                  ? (currentLink?.deliveredAt ??
                    input.order.receivedAt ??
                    input.order.deliveredAt ??
                    null)
                  : null,
    })),
    invoice: primaryInvoice
      ? {
          id: primaryInvoice.id,
          invoiceNumber: primaryInvoice.invoiceNumber,
          createdAt: primaryInvoice.createdAt,
        }
      : null,
    delivery: {
      status: currentLink?.groupStatus ?? null,
      riderName: input.order.riderName ?? null,
      riderPhone: input.order.riderPhone ?? null,
      otp:
        currentLink?.groupStatus === "out_for_delivery" &&
        currentLink.invoiceStatus === "pending"
          ? (currentLink.deliveryOtp ?? null)
          : null,
      assignedAt: currentLink?.assignedAt ?? null,
      startedAt: currentLink?.startedAt ?? null,
      deliveredAt: currentLink?.deliveredAt ?? null,
    },
  };
}
