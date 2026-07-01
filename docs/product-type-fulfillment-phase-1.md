# Product Type Fulfillment Phase 1

## Goal

Phase 1 establishes the shared product-type fulfillment domain that later phases will use from admin setup all the way to retailer ordering and stock conversion.

This phase does not replace the retailer B2B order engine yet. Instead, it creates the normalized source of truth that those later phases can adopt without re-inventing the rules in each layer.

## Lifecycle Covered

The intended end-to-end path is:

`Admin Type Setup -> Product Rules -> Warehouse Representation -> Retailer Product View -> Retailer Selection -> Cart/Checkout -> Order Validation -> Delivery -> Inventory Conversion`

Phase 1 covers the first two parts of that lifecycle by making product types describe:

- inventory behaviour
- fulfillment family
- supported fulfillment modes
- core unit model
- variant dimensions
- tracked/returnable capabilities

## Shared Domain

The shared module lives in `packages/db/src/fulfillment.ts`.

It defines:

- inventory behaviours: `auto_break`, `loose_convert`, `fixed_pack`
- fulfillment modes: `loose`, `pack`, `carton`, `unit`, `box`, `pair`, `cylinder`, `drum`, `bundle`
- product type families: `grocery`, `fashion`, `footwear`, `electronics`, `lpg`, `bulk_liquid`, `generic`
- unit descriptors and dimension keys
- `buildProductTypeFulfillmentProfile()` for deriving a normalized profile from product-type data

## Admin Integration

Admin product-type create and edit flows now store `inventoryBehaviour` directly instead of leaving it as an unused database field.

Admin product-type list and detail pages now expose the derived fulfillment profile so the business logic is visible at setup time.

## What This Enables Next

Phase 2 can use the shared fulfillment profile to upgrade:

- order API input contracts
- stock validation rules
- supply mode resolution
- product-card rendering strategy
- cart labeling and checkout summaries
- delivery-time inventory conversion

## Current Limitation

The current retailer warehouse-order flow still operates mainly on `loose` and `pack`.

That is expected at this stage.

Phase 1 only provides the domain model and admin entry point needed to migrate the ordering engine safely in later phases.
