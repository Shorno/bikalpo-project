# ADR 0002: Retailer self-pickup uses the owner-scoped pickup handoff

**Status:** Accepted — 2026-07-20

Retailer staff select Self Pickup at Dispatch Orders, using the same owner-scoped fulfillment seam as warehouse pickup. The invoice remains outside Delivery Management and receives a four-digit Pickup OTP. Store staff verify that code only after physical handover; the transaction marks the invoice collected and delivered, marks the retailer order paid, delivered, and received, and never creates a Delivery Group.

The consumer continues to place the order through the existing checkout fields. Once the retailer selects pickup, the consumer journey shows the retailer's current shop profile location and Pickup OTP. Self-pickup is disabled when the shop has no address. This keeps retailer and warehouse operational patterns aligned while avoiding a separate pickup workflow, rider assignment model, or new database structure.
