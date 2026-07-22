# Use atomic, consumer-selected Open Orders

- Status: Accepted
- Date: 2026-07-22

## Context

The public catalog shows admin-managed products and reference prices, while direct retailer storefront purchases already select a retailer before checkout. Public-catalog purchases need a separate flow that discovers nearby retailer availability and produces comparable complete prices without weakening the direct-order path.

Earlier drafts allowed partial matches, multiple sellers, retailer confirmation after selection, and automatic winner selection. Those rules make stock ownership, totals, cancellation, and the consumer experience substantially harder to reason about.

## Decision

An Open Order is one order with one item set. A retailer is eligible only when one of its exact inventory rows can cover the full requested quantity of every catalog variant, it serves the consumer's area, and it is within ten kilometres.

Eligible retailers may submit, revise, or withdraw complete Offers during one shared Offer Window. Submitting reserves all required inventory atomically. Retailer inventory prices are the source of line prices; an Offer only controls its discount and delivery charge. When the window ends, prices freeze and the consumer receives a separate Selection Window. The consumer explicitly accepts one Offer, which immediately confirms the order, consumes the winning Stock Hold, and releases every losing hold.

Open Orders use cash on delivery. Direct Orders keep their existing retailer selection, checkout, payment, and fulfillment behaviour.

## Consequences

- A request is rejected before order creation when no single retailer can fulfill it; the cart remains intact.
- No substitutions, category splits, partial fulfillment, multiple retailers, or automatic winners are allowed in V1.
- Submitted Offers temporarily reserve inventory, so all terminal paths must release or consume holds idempotently.
- Offer and selection deadlines must be reconciled by the server even when no browser is connected.
- The public catalog price is explicitly a Reference Price and not a promised payable total.
