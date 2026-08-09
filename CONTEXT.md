# Bikalpo Commerce

Bikalpo coordinates marketplace orders across consumer, retailer, warehouse, and delivery contexts. Products keep a shared identity while each owner controls its own configuration, pricing, and inventory. Operational fulfillment language stays distinct from the simplified journey presented to consumers.

## Business Onboarding

**Business Nature**:
An applicant's declared operating model: Retail Shop, Wholesaler, Distributor, Manufacturer, or Importer. It selects an application path but is not an authorization role or a Product Type.
_Avoid_: User role, business type, product type

**Shop Owner**:
An approved business account authorized to use the Shop portal. Retail Shop, Manufacturer, and Importer applications enter this role.
_Avoid_: Retailer when referring to portal authorization, seller role

**Warehouse Owner**:
An approved business account authorized to use the Warehouse portal. Wholesaler and Distributor applications enter this role.
_Avoid_: Wholesaler when referring to every Warehouse portal account

**Seller Capability**:
The independent ability of a Shop Owner to sell products to consumers; Shop Owner membership alone does not imply this capability.
_Avoid_: Shop Owner role, retailer role

## Marketplace Catalog and Ordering

This context describes how products keep a shared identity while each owner controls its own configuration, pricing, and inventory. It also describes how consumers buy known catalog items either from one chosen retailer or by requesting comparable offers from nearby retailers.

## Language

**Core Product Identity**:
The shared root identity for one kind of product across admin, warehouse, and retailer configurations.
_Avoid_: Admin product, master SKU

**Admin Preset**:
The admin's initial brand, Variant Option, and product-detail defaults supplied when an owner starts a configuration; it is neither an ongoing restriction nor an automatically synchronized source.
_Avoid_: Required subset, master configuration

**Owner Configuration**:
A warehouse or retailer's independently maintained selection of approved brands and compatible Variant Options for a Core Product Identity.
_Avoid_: Admin configuration copy, inherited configuration

**Brand Creation Mode**:
A Core Product Identity setting that controls whether an owner saves one Brand Product at a time (`single`) or synchronizes the full desired brand set (`batch`). It does not limit the total brands that may exist and does not control conversion, loose units, pricing, or inventory.
_Avoid_: Product type rule, unit policy, brand limit

**Brand Product**:
One owner-specific product for one Core Product Identity and one brand, containing one or more Owner Variants.
_Avoid_: Catalog Variant, brand configuration

**Variant Option**:
A compatible configured choice such as a package size, weight, or unit presentation.
_Avoid_: Variant type, owner variant

**Variant Request**:
A Warehouse Owner or Shop Owner proposal for one structured, type-scoped Variant Option. The requester uses the same definition as Admin; approval creates one canonical reusable Variant Option, while rejection creates nothing.
_Avoid_: Free-form variant, owner variant, global variant

**Operational Unit**:
The unit in which one Variant Option is ordered and stocked, derived from its definition and packaging.
_Avoid_: Product inventory unit, template unit

**Catalog Variant**:
The canonical identity of one exact Core Product Identity, brand, and Variant Option combination, shared by equivalent Owner Variants.
_Avoid_: Local SKU, trade variant, retail variant

**Owner Variant**:
An admin, warehouse, or retailer's local representation of a Catalog Variant, with its own SKU, pricing, and inventory relationships.
_Avoid_: Catalog Variant, variant type

**Open Order**:
An atomic consumer request for offers on an exact set of catalog variants and quantities, fulfilled by one consumer-selected retailer.
_Avoid_: Broadcast order, split order, parent order

**Direct Order**:
An order placed with a retailer selected before checkout through that retailer's storefront.
_Avoid_: Normal order, closed order

**Reference Price**:
The public catalog amount used to help a consumer estimate an Open Order; it is not the final payable retailer price.
_Avoid_: Selling price, guaranteed price

**Eligible Retailer**:
An active retailer in the consumer's service area and within the ten-kilometre Open Order radius that can supply every requested Catalog Variant in full.
_Avoid_: Candidate seller, partially matched retailer

**Offer**:
An Eligible Retailer's complete price proposal for an Open Order, including item subtotal, discount, delivery charge, and final total.
_Avoid_: Bid, quotation

**Offer Window**:
The shared period in which Eligible Retailers may submit, revise, or withdraw Offers.
_Avoid_: Negotiation timeout, lock window

**Selection Window**:
The period after Offer prices freeze in which the consumer may accept one Offer.
_Avoid_: Confirmation window, bidding window

**Stock Hold**:
Inventory reserved for one submitted Offer until that Offer wins, loses, is withdrawn, or expires.
_Avoid_: Allocation, soft reservation

**Empty Pack Return**:
A retailer-enabled rule available to Product Types that support returnable packaging. For LPG products, it gives consumers Exchange and New sale modes for eligible cylinders.
_Avoid_: Product return, refund

**Exchange**:
An Empty Pack Return sale mode where one empty pack is required for each filled pack sold.
_Avoid_: Replacement, product swap

**New**:
An Empty Pack Return sale mode where a filled pack is sold without receiving an empty pack and no Empty Pack Stock is created.
_Avoid_: Standard when the distinction is Exchange versus New

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
