# Bikalpo Commerce

Bikalpo coordinates marketplace orders across consumer, retailer, warehouse, and delivery contexts. Operational fulfillment language stays distinct from the simplified journey presented to consumers.

## Retail Fulfillment

**Retailer Order**:
An order placed by a consumer with one retailer store and fulfilled by that store.
_Avoid_: Warehouse order, purchase order

**Order Approval**:
The retailer or warehouse operational decision that accepts a pending order and moves it to `ready_for_dispatch`. Consumer tracking projects this event as **Store confirmed** for retailer orders.
_Avoid_: Consumer confirmation, invoice creation

**Retailer Delivery Team**:
Delivery staff employed by one retailer store to fulfill that store's consumer orders.
_Avoid_: Warehouse rider, global rider

**Delivery Group**:
A retailer- or warehouse-owned batch of invoiced orders assigned to one rider for a delivery trip.
_Avoid_: Order assignment, rider order

**Handoff OTP**:
A short code owned by the recipient and entered by a delivery rider only after the goods are physically handed over.
_Avoid_: Login OTP, consumer confirmation form

**Self Pickup**:
An owner-selected fulfillment mode where a consumer collects an invoiced order at the retailer shop or warehouse. It does not create a Delivery Group or involve a rider.
_Avoid_: Delivery, customer pickup request

**Pickup OTP**:
A four-digit code shown to the consumer and entered by store or warehouse staff only after the goods are physically handed over at the pickup location. For retailer self pickup, successful verification also records counter payment.
_Avoid_: Delivery OTP, login OTP

**Delivery Recipient**:
The person or organization receiving a rider handoff. A Delivery Recipient can be a consumer, retailer store, or warehouse and has a computed type and display name in the rider portal.
_Avoid_: Customer when the recipient may be a store or warehouse

## Consumer Experience

**Consumer Journey**:
The five-stage projection of a retailer order: Order placed, Store confirmed, Preparing, Out for delivery or Ready for pickup, and Delivered or Picked up. It hides raw operational statuses.
_Avoid_: Raw order status, fulfillment status

**Delivery Issue**:
A non-terminal consumer-visible exception indicating that an attempted delivery did not complete and requires retailer action.
_Avoid_: Delivered, returned

## Retailer Point of Sale

**Point of Sale**:
The shop-owned counter workspace where the retailer selects available inventory, applies sale-level adjustments, accepts one tender, and completes an immediate handover without creating a marketplace order or delivery work.
_Avoid_: Online checkout, order fulfillment

**Counter Sale**:
A completed retailer or warehouse POS transaction whose stock is handed over at the counter. It is a sales record, not a marketplace order.
_Avoid_: Retailer Order, delivery invoice

**POS Customer**:
A customer profile owned by one shop or warehouse and used for counter receipts, payment history, and Outstanding Balances. A POS Customer may be linked to a consumer who has ordered from that owner.
_Avoid_: Global customer, unrelated consumer

**Walk-in Customer**:
The default anonymous POS Customer for fully paid Counter Sales. A Walk-in Customer cannot carry an Outstanding Balance.
_Avoid_: Named customer, consumer account

**Held Cart**:
A saved POS selection that does not reserve stock or price and must be revalidated before checkout.
_Avoid_: Stock reservation, completed sale

**Outstanding Balance**:
The unpaid portion of a completed Counter Sale, attached to a named POS Customer with a phone number and reduced only by recorded collections or a Sale Void.
_Avoid_: Marketplace receivable, delivery collection

**Sale Void**:
An owner-authorized cancellation of a complete Counter Sale that restores stock once and retains compensating payment reversals for audit.
_Avoid_: Partial return, item refund, deletion
