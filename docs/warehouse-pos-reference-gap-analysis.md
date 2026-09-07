# Warehouse POS — Confirmed Requirements

**Status:** requirements updated from client decisions on 2026-09-07.  
**Target route:** `/warehouse/dashboard/pos`  
**Reference:** `C:/Users/Shorno/.codex/attachments/3dca466b-cbde-46b7-a09e-3924f4dd2774/pasted-text.txt`

## Scope decisions

1. The supplied ASCII document is the approved structural reference. No additional screenshot or Figma source is required. Use the application's existing design system for color, typography, spacing, dialogs, tables, and controls while matching the reference structure closely.
2. Existing POS controls or behaviors that are not present in the reference do not need to remain on this page. In particular, the current Retail/Wholesale switch, Connected Store selector, editable line price, and visible Held Cart restore strip are not requirements.
3. `Add More` means split payment. Payment accounts must come from the existing Finance/Accounting module.
4. Delivery Method is invoice metadata only. It must not create an order, dispatch record, delivery group, rider task, or other fulfillment work.
5. Coupon, reward, VAT/tax, delivery-charge, shipping-charge, and commission calculation features are excluded from this implementation. Do not add new pricing engines or accounting rules for them.
6. Barcode generation is excluded.
7. Share means sharing the generated invoice PDF.
8. Names, dates, products, and amounts in the reference are illustrative data, not defaults or fixtures.

## Required user flow

The page must use three stages:

1. **POS workspace** — find items, build the item-entry table, select a customer, review the total, reset, hold, or continue.
2. **Complete Order** — review the selected customer, enter one or more received-payment rows, choose the account for each row, select invoice delivery metadata, confirm status/person/date/terms, and submit.
3. **Invoice Preview** — display the completed invoice and offer Print Only, Share PDF, and Print & Share.

`Place Order` must only open the Complete Order review. It must not create a sale or deduct stock. Inventory and financial mutations occur once, atomically, only after a successful `Submit`.

## Stage 1 — POS workspace

### Header and catalog

- Show `Welcome, {user name}` and the current date.
- Provide one `Search / Scan Product` input. In this scope, “scan” means that a scanner can type an existing SKU into the focused input and submit it; no separate barcode format or barcode-generation system is required.
- Use a persistent left navigation tree with `All` and product types (for example, LPG). Clicking a type selects it and expands every distinct variant/pack available under that type (for example, 12 KG and 35 KG), across its categories and brands. Clicking a child filters by both its parent type and exact variant/pack, showing matching products across brands. Do not substitute subcategories for the variant children. `All` clears both filters. The tree stays available while searching and works on desktop and smaller screens. (Clarified by the screenshot on 2026-09-08.)
- Show product/brand cards with current stock and add-to-order interaction.
- Do not show the current Retail/Wholesale toggle or six-dropdown filter row.

### Item-entry table

Use the central table shown in the reference:

| Column | Behavior |
|---|---|
| SKU | Stored variant SKU |
| Product | Product/core-product display name |
| Variant | Brand/pack/variant display label |
| Qty | Editable positive quantity, respecting whole/decimal stock semantics |
| Total | Quantity multiplied by the authoritative catalog price |
| Remove | Removes the row after an accessible action |

- Adding the same variant again increments its quantity.
- Unit price is not editable on the POS page.
- Quantity cannot exceed current warehouse stock.
- Empty, loading, error, and insufficient-stock states must remain usable and clear.

### Order Details

- Show the selected customer in a compact card.
- `+` opens customer search/selection/creation.
- Display the selected customer's current warehouse POS outstanding due.
- Default to Walk-In Customer when no named customer is selected.
- Do not show Connected Store as a separate POS customer mode.

### Payment Summary

The approved calculation scope is:

- Subtotal
- Existing manual Discount
- Grand Total / Payable Total

Coupon, reward, VAT/tax, delivery charge, shipping charge, and commission rows/actions are excluded even though they appear in parts of the sample reference. Delivery Method does not affect the total.

### Workspace actions

- **Reset** clears the draft after confirmation when it contains data.
- **Place Order** opens the Complete Order dialog without saving or deducting stock.
- **Hold Order** saves the current draft using the existing held-order persistence. A held-order retrieval surface is not required on this POS workspace because it is not shown in the reference.
- Show Payable Total as the prominent footer total.

## Stage 2 — Complete Order

### Customer

- Display the selected customer.
- Provide an edit action that returns to customer selection without losing the draft.
- A named customer with contact information is required when the submitted order leaves a due balance.

### Split payments

- Render at least one payment row.
- Each row contains:
  - `Received Amount *`
  - `Select Account *`
  - `Delivery Method *`
- `Add More` appends another payment row.
- Rows can be removed when more than one exists.
- Each positive received amount is posted to the selected account.
- Duplicate selections of the same account should be combined or rejected rather than creating indistinguishable duplicate rows.

### Finance/Accounting integration

Use the existing owner-scoped Finance/Accounting payment accounts:

- Query `finance.getPaymentAccounts` (`packages/api/src/routers/finance.ts:2225-2287`).
- The endpoint scopes records to the authenticated warehouse owner and returns only active cash/bank payment accounts, default-first.
- The underlying source is `financePaymentAccount`, linked to its Finance account through `financeAccountId` (`packages/db/src/schema/finance-payment-account.ts`).
- Do not introduce a separate POS account table or a hard-coded `Cash Account` option.
- Store `paymentAccountId` on every POS payment row and validate that the account belongs to the warehouse, is active, and matches its payment type.
- In the sale transaction, increase each selected payment account balance by its applied amount and create the corresponding financial ledger/journal entries. Any due portion must be posted to Accounts Receivable.
- Sale, stock deduction, POS payments, finance-account balances, receivable, and ledger/journal entries must succeed or roll back together.

### Received, applied payment, change, and due

- `Received` is the sum of payment-row amounts tendered by the customer.
- `Applied payment` cannot exceed Payable Total.
- `Change = max(0, Received - Payable Total)`.
- `Due = max(0, Payable Total - Applied payment)`.
- An overage is change, not revenue and not an account over-credit.
- Persist tendered, applied, change, and due separately so the invoice and accounting remain reconcilable.

### Payment status

Expose `Paid`, `Partial`, and `Due`, while enforcing consistency with the totals:

- Paid: Due is zero.
- Partial: Applied payment is greater than zero and Due is greater than zero.
- Due: Applied payment is zero and Due equals Payable Total.

The UI may present the reference dropdown, but Submit must reject a status that contradicts the calculated amounts.

### Delivery Method

- Save the selected label as an immutable invoice snapshot, for example `Self Pickup`.
- Delivery Method is shared across the order even if it is visually repeated alongside payment inputs; all payment rows must resolve to the same selected value.
- Do not invoke delivery or fulfillment APIs.

### Other fields

- Responsible Person defaults to the authenticated warehouse user and is stored as an ID plus display-name snapshot.
- Date defaults to the current local business date and is stored with the sale.
- Notes/Terms & Conditions are stored on the sale and displayed on the invoice.
- Show live summary cards for Payable Total, Received, Change, and Due.
- Cancel closes the dialog without mutation and preserves the workspace draft.
- Submit is idempotent, prevents double-click duplicates, revalidates stock, and completes the transaction once.

## Stage 3 — Invoice Preview and PDF

### Invoice contents

- `BIKALPO INVOICE` heading and Bikalpo/warehouse logo when configured.
- Warehouse name, available warehouse identity/code, address, and phone.
- Invoice number and sale date/time.
- No barcode.
- Customer name, address, and mobile number.
- Payment status and Delivery Method.
- Item table with SKU, Product Name / Variant, Qty, and Price.
- Items count, Subtotal, Discount, Grand Total, Paid Amount, Due Amount, and Return/Change Amount.
- Saved Notes/Terms & Conditions.
- `Powered by Bikalpo.com` and thank-you footer.

Excluded invoice rows: coupon discount, reward discount, VAT/tax, delivery charge, shipping charge, and commission.

### Actions

- **Print Only:** print the invoice layout.
- **Share:** generate the invoice as a PDF and share that file. Prefer the browser's file-sharing capability when available; fall back to downloading the PDF with a clear message when direct file sharing is unsupported.
- **Print & Share:** make the same PDF available for sharing and open the print flow without generating a second, different invoice representation.
- Remove the current placeholder SMS success action.
- The preview, print output, downloaded PDF, and shared PDF must use the same invoice data and totals.

## Data and API changes

1. Extend POS payment persistence with `paymentAccountId` and explicit tendered/applied amounts. Keep one persisted row per split payment/account.
2. Extend the sale with delivery-method snapshot, payment status, responsible-person ID/name, effective sale date, terms, tendered total, change, and the approved discount snapshot.
3. Add customer outstanding due to the POS customer projection.
4. Change completion input from one payment method/amount to a validated payment-row array plus one invoice-only delivery method.
5. Make completion idempotent and replace warehouse `count + 1` invoice numbering with a concurrency-safe sequence/identifier.
6. Extend invoice output with SKU, customer address, warehouse identity, delivery method, terms, responsible person, and reconciled payment totals.
7. Generate one deterministic invoice PDF from the completed sale snapshot.

## Removed or explicitly out of scope

- Pixel matching against an unavailable image/Figma source
- Retail/Wholesale toggle on this page
- Editable unit prices
- Connected Store customer mode
- Visible held-order restore strip on this page
- Coupon and reward engines
- VAT/tax calculation
- Delivery and shipping charges
- Commission calculation
- Operational fulfillment or delivery creation
- Barcode generation/scanning formats beyond submitting an SKU through the search field
- SMS invoice action

## Verification requirements

- Stage transitions do not mutate data until Submit.
- Duplicate Submit creates one sale, one stock deduction, and one finance posting set.
- Split payment rows post to the correct owner-scoped accounts and reconcile exactly.
- Cash over-tender produces change without overstating paid revenue or account balance.
- Partial and due sales update customer due and Accounts Receivable correctly.
- Delivery Method appears on the invoice but creates no fulfillment records.
- Hold Order persists the approved draft fields.
- Invoice preview, print, downloaded PDF, and shared PDF match.
- Invoice contains no barcode or excluded calculation rows.
- Warehouse POS integration tests cover stock conflicts, invalid accounts, cross-owner account attempts, split payments, due, change, rollback, idempotency, and PDF data generation.
