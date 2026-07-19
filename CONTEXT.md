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
A short code owned by the recipient and entered by the rider only after the goods are physically handed over.
_Avoid_: Login OTP, consumer confirmation form

**Delivery Recipient**:
The person or organization receiving a rider handoff. A Delivery Recipient can be a consumer, retailer store, or warehouse and has a computed type and display name in the rider portal.
_Avoid_: Customer when the recipient may be a store or warehouse

## Consumer Experience

**Consumer Journey**:
The five-stage projection of a retailer order: Order placed, Store confirmed, Preparing, Out for delivery, and Delivered.
_Avoid_: Raw order status, fulfillment status

**Delivery Issue**:
A non-terminal consumer-visible exception indicating that an attempted delivery did not complete and requires retailer action.
_Avoid_: Delivered, returned
