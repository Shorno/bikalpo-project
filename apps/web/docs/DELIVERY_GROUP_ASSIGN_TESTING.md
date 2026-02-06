# Delivery Group Assignment — Testing Guide

Area-based deliveryman list, **vehicle type**, and **expected delivery date** are in the **delivery group** flow (Create Group and Assign / Change Deliveryman), not in invoices.

---

## Prerequisites

1. **Migrations**
   - `0004_invoice_delivery_user_area`: `user.service_area`
   - `0005_delivery_group_vehicle_expected`: `delivery_group.vehicle_type`, `delivery_group.expected_delivery_at`
   - Run `pnpm db:migrate`. If it fails, run:
     - `pnpm exec tsx scripts/ensure-user-service-area.ts`
     - `pnpm exec tsx scripts/run-0005-delivery-group-vehicle-expected.ts`

2. **Data**
   - **Deliverymen** with `user.role = 'deliveryman'`. For area-based tests, set `user.service_area` (e.g. `"Gulshan, Banani"`) for some; leave `NULL` for “all areas”.
   - **Orders** with `shipping_area` (e.g. `"Gulshan"`).

3. **App**
   - `pnpm dev`, log in as **admin**.

---

## 1. Create Delivery Group

**Path:** `/dashboard/admin/delivery` → **Create Delivery Group**.

- **Group Name**, **Select Orders**, **Assign Deliveryman** (required).
- **Vehicle type (optional):** Bike, Car, Van, Truck.
- **Expected delivery date (optional):** date picker.

**Area-based list:** After you select at least one order, the **Assign Deliveryman** list is filtered by the first selected order’s `shipping_area` (and deliverymen with `service_area` NULL). If no orders are selected, all deliverymen are shown.

**Check:** Create a group with vehicle and expected date → open the group → **Deliveryman** card shows Vehicle and Expected when set.

---

## 2. Assign / Change Deliveryman (group detail)

**Path:** `/dashboard/admin/delivery/[id]` → **Assign Deliveryman** or **Change Deliveryman**.

- **Deliveryman:** Filtered by the first order in the group’s `shipping_area` (and `service_area` NULL). Each option can show `service_area` (e.g. `· Gulshan, Banani`).
- **Vehicle type (optional)**, **Expected delivery date (optional)**.

**Check:** Assign with vehicle and date → **Deliveryman** card shows Vehicle and Expected.

---

## 3. Area-based deliverymen (script)

Same logic as in the UI:

```bash
# All deliverymen
pnpm exec tsx scripts/test-area-based-deliverymen.ts

# Filter by area (e.g. first order’s shipping_area)
pnpm exec tsx scripts/test-area-based-deliverymen.ts Gulshan
```

---

## 4. Apply 0005 if `db:migrate` fails

```bash
pnpm exec tsx scripts/run-0005-delivery-group-vehicle-expected.ts
```

---

## Quick checklist

| What | Where |
|------|-------|
| Area-based deliverymen in Create Group | Create Delivery Group → select orders → Assign Deliveryman list filters by first order’s `shipping_area`. |
| Area-based deliverymen in Assign | Group detail → Assign/Change Deliveryman → list filtered by group’s first order `shipping_area`. |
| Vehicle type | Create Group and Assign/Change Deliveryman; shown in group’s Deliveryman card. |
| Expected delivery date | Create Group and Assign/Change Deliveryman; shown in group’s Deliveryman card. |

---

## Scripts

- **`scripts/test-area-based-deliverymen.ts [area]`** — List deliverymen (optionally by area). Same logic as `getDeliverymenForAssignment`.
- **`scripts/run-0005-delivery-group-vehicle-expected.ts`** — Add `vehicle_type` and `expected_delivery_at` to `delivery_group` if migration 0005 did not run.

Both need `DATABASE_URL` in `.env`.
