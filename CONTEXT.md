# Marketplace Catalog and Ordering

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

**Brand Product**:
One owner-specific product for one Core Product Identity and one brand, containing one or more Owner Variants.
_Avoid_: Catalog Variant, brand configuration

**Variant Option**:
A compatible configured choice such as a package size, weight, or unit presentation.
_Avoid_: Variant type, owner variant

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
