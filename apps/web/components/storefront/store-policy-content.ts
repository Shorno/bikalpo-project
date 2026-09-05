import type { StorePolicyId } from "@/lib/store-policy-links";

interface StorePolicyContent {
  title: string;
  intro: string;
  sections: Array<{ title: string; paragraphs: string[] }>;
}

export const storePolicyContent: Record<StorePolicyId, StorePolicyContent> = {
  "return-refund": {
    title: "Return & Refund",
    intro:
      "Guidance for items that are incorrect, damaged, defective or different from their description.",
    sections: [
      {
        title: "Report an item problem",
        paragraphs: [
          "Contact the store or use your Bikalpo support tickets to explain the problem. Keep your order number, item details and any relevant photos available so the issue can be reviewed.",
        ],
      },
      {
        title: "Before returning an item",
        paragraphs: [
          "Keep the item and its original packaging where practical. Ask the store for return instructions before sending anything back.",
          "Return eligibility can depend on the product category, item condition and reason for the request. Return windows, exclusions and any store-specific conditions will be published here when finalized.",
        ],
      },
      {
        title: "Refund information",
        paragraphs: [
          "If a refund is approved, the refundable amount and treatment of delivery charges or other fees will be confirmed during the review. Refund methods and processing times will be added when confirmed.",
        ],
      },
    ],
  },
  delivery: {
    title: "Delivery Policy",
    intro: "Information to review when arranging delivery from this store.",
    sections: [
      {
        title: "Availability and timing",
        paragraphs: [
          "Check whether delivery is available for your address before placing an order. Confirm any delivery estimate with the store; availability and timing depend on your location and the products ordered.",
          "Traffic, weather, stock availability and operating conditions can affect delivery. Same-day delivery should only be expected when the store has confirmed it for your order.",
        ],
      },
      {
        title: "Delivery charges",
        paragraphs: [
          "Review the delivery charge and order total shown at checkout before confirming your purchase. Contact the store if you need clarification about the delivery arrangement.",
        ],
      },
      {
        title: "Receiving your order",
        paragraphs: [
          "Check the item quantities and visible condition when receiving your order. If something is missing or damaged, keep the order details and relevant photos, then contact the store or Bikalpo support.",
          "You can view the latest recorded order progress from your Bikalpo account.",
        ],
      },
    ],
  },
  cancellation: {
    title: "Cancellation Policy",
    intro:
      "Guidance on requesting a cancellation and checking what happens next.",
    sections: [
      {
        title: "Before an order is invoiced",
        paragraphs: [
          "Cancellation is limited by the current order status. Bikalpo's current cancellation process allows eligible orders to be cancelled before invoicing.",
          "Check your order details and contact the store or Bikalpo support if you need to cancel. A submitted request is not confirmation that an order has been cancelled.",
        ],
      },
      {
        title: "Orders already in progress",
        paragraphs: [
          "An order that has moved beyond the eligible stage may no longer be cancellable through the normal process. Contact the store to discuss the available next steps.",
          "For an order that has already been delivered, refer to Return & Refund guidance when reporting an item problem.",
        ],
      },
      {
        title: "Payments after cancellation",
        paragraphs: [
          "If you have already paid, any applicable refund is reviewed separately from the cancellation. The amount, method and processing details must be confirmed; cancelling an order does not itself confirm a completed refund.",
        ],
      },
    ],
  },
};
