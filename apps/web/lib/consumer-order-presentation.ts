export const consumerJourneySteps = [
  {
    key: "placed",
    label: "Order placed",
    description: "We received your order.",
  },
  {
    key: "confirmed",
    label: "Store confirmed",
    description: "The store accepted your order.",
  },
  {
    key: "preparing",
    label: "Preparing",
    description: "Your invoice and delivery are being prepared.",
  },
  {
    key: "out_for_delivery",
    label: "Out for delivery",
    description: "Your rider is bringing the order to you.",
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Delivery was verified and completed.",
  },
] as const;

export type ConsumerFulfillmentMode = "internal_delivery" | "self_pickup";

export function getConsumerJourneySteps(
  mode: ConsumerFulfillmentMode | null | undefined,
) {
  if (mode !== "self_pickup") return consumerJourneySteps;
  return consumerJourneySteps.map((step) => {
    if (step.key === "out_for_delivery") {
      return {
        ...step,
        label: "Ready for pickup",
        description: "Your order is ready at the retailer's shop.",
      };
    }
    if (step.key === "delivered") {
      return {
        ...step,
        label: "Picked up",
        description: "Your pickup was verified at the shop.",
      };
    }
    return step;
  });
}

export type ConsumerPhase =
  | (typeof consumerJourneySteps)[number]["key"]
  | "cancelled"
  | "delivery_issue"
  | "returned";

export const consumerPhasePresentation: Record<
  ConsumerPhase,
  {
    label: string;
    description: string;
    badgeClassName: string;
  }
> = {
  placed: {
    label: "Order placed",
    description: "Your order is waiting for the store to confirm it.",
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-800",
  },
  confirmed: {
    label: "Store confirmed",
    description: "The store has accepted your order and will prepare it next.",
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-800",
  },
  preparing: {
    label: "Preparing",
    description: "Your order is being invoiced and prepared for a rider.",
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-800",
  },
  out_for_delivery: {
    label: "Out for delivery",
    description: "Your rider is on the way. Keep your delivery OTP ready.",
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-800",
  },
  delivered: {
    label: "Delivered",
    description: "Your order was received and delivery was verified.",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  cancelled: {
    label: "Cancelled",
    description: "This order was cancelled before delivery preparation began.",
    badgeClassName: "border-red-200 bg-red-50 text-red-800",
  },
  delivery_issue: {
    label: "Delivery issue",
    description:
      "The delivery could not be completed. The store can arrange another attempt.",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-900",
  },
  returned: {
    label: "Returned",
    description:
      "This order was returned to the store and will not be delivered.",
    badgeClassName: "border-slate-300 bg-slate-100 text-slate-800",
  },
};

export function getConsumerPhasePresentation(phase: string) {
  return getConsumerPhasePresentationForMode(phase, null);
}

export function getConsumerPhasePresentationForMode(
  phase: string,
  mode: ConsumerFulfillmentMode | null | undefined,
) {
  const base =
    consumerPhasePresentation[phase as ConsumerPhase] ??
    consumerPhasePresentation.placed;
  if (mode !== "self_pickup") return base;
  if (phase === "out_for_delivery") {
    return {
      ...base,
      label: "Ready for pickup",
      description: "Your order is ready at the retailer's shop.",
    };
  }
  if (phase === "delivered") {
    return {
      ...base,
      label: "Picked up",
      description: "Your pickup was verified at the shop.",
    };
  }
  return base;
}

export function isTerminalConsumerPhase(phase: string) {
  return ["delivered", "cancelled", "returned"].includes(phase);
}
