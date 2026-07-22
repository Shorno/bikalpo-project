# Marketplace Ordering

This context describes how consumers buy known catalog items either from one chosen retailer or by requesting comparable offers from nearby retailers.

## Language

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
An active retailer in the consumer's service area and radius that can supply every requested catalog variant in full.
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

