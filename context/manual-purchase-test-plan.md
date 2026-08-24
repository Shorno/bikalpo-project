# Manual Purchase Acceptance Test Plan

## Test Setup

1. Sign in as a shop owner and open `/dashboard/stock/add`.
2. Create or select an active supplier.
3. Ensure the shop has one Cash and one Bank payment account with known balances.
4. Pick an inventory variant with a known starting quantity and note its current value.
5. Keep the Purchase Report, Accounts Payable Report, Balance Sheet, Profit & Loss, and Transactions pages available for verification.

Use a different supplier invoice number for each scenario. Confirm that re-submitting the same request does not create duplicate stock, payments, journal entries, or history events.

## 1. Verification And Draft Editing

1. Enter a supplier, date, one item, quantity, unit cost, batch, note, and attachment.
2. Save the draft and record its manual purchase number.
3. Change quantity, price, batch, note, discount, or VAT and save again.
4. Confirm the purchase.

Expected:

- The same purchase number is retained.
- The latest draft values and item rows are used at confirmation.
- Invalid totals, missing items, foreign inventory, or an invalid payment account place the draft on hold or reject the unsafe reference.
- A confirmed purchase cannot be changed by replaying its original idempotency key.
- Purchase history shows draft creation, verification, acceptance, receipt, inventory recognition, and accounting posting.

## 2. Unpaid Purchase

Create a Tk10,000 purchase with Total Paid set to zero and confirm it.

Expected:

- Stock increases by the purchased quantity.
- Purchase status is Received, payment status is Unpaid, paid is Tk0, and due is Tk10,000.
- Accounting entry is Debit Inventory Tk10,000 / Credit Accounts Payable Tk10,000.
- Cash and Bank do not change.
- Accounts Payable, Purchase Report, Transactions, and Balance Sheet include the purchase.
- Profit & Loss does not change and no COGS or Sales entry is created.

## 3. Full Payment At Receipt

Create a Tk10,000 purchase, set Total Paid to Tk10,000, select a Cash or Bank account, and confirm it.

Expected:

- Stock and Inventory increase by Tk10,000.
- Paid is Tk10,000, due is Tk0, and payment status is Paid.
- Receipt posts Debit Inventory / Credit Accounts Payable.
- Settlement posts Debit Accounts Payable / Credit Cash or Bank.
- The selected account decreases by Tk10,000 and Accounts Payable finishes at zero.
- Payment history contains one completed due-settlement payment.
- Profit & Loss remains unchanged.

## 4. Partial Payment And Multiple Settlements

Create a Tk50,000 purchase with Tk9,000 paid, then open its manual purchase detail page and add a second payment of Tk41,000.

Expected after confirmation:

- Paid is Tk9,000, due is Tk41,000, and status is Partial.
- The selected payment account decreases by Tk9,000.
- Accounts Payable is Tk41,000.

Expected after the second payment:

- Paid is Tk50,000, due is Tk0, and status is Paid.
- Payment history has two separate completed records linked to one purchase ID.
- Each record retains its method, account, amount, time, reference, transaction ID, purpose, and remaining due.
- Accounting history contains separate settlement journals.

## 5. Supplier Advance

Save a verified draft, open its detail, and record a payment before stock receipt. Then confirm the purchase.

Expected before receipt:

- Debit Supplier Advance / Credit Cash or Bank.
- Inventory, Accounts Payable, COGS, and Sales do not change.

Expected at receipt:

- Debit Inventory / Credit Accounts Payable for the purchase value.
- The advance is applied with Debit Accounts Payable / Credit Supplier Advance.
- Any remainder stays in Accounts Payable; a fully covered purchase finishes with no due.

## 6. Exchange Entry

Choose Exchange, enter purchased and exchange quantities, and confirm.

Expected:

- The purchase item stores both quantities and its New/Exchange mode.
- Inventory movement and purchase history retain the purchase ID, SKU, batch, supplier, unit cost, quantity, timestamp, and actor ID.
- The connected financial records use the final purchase total once.

## 7. Cancellation

Test cancellation separately for unpaid, partial, and fully paid received purchases.

Expected:

- Received stock is reversed once and cannot fall below zero.
- Unpaid due reverses Accounts Payable against Inventory.
- Paid value becomes a Supplier Refund Receivable until cash is returned.
- Partial purchases reverse the unpaid payable and expose only the paid amount for refund.
- The purchase becomes Cancelled and the reversal remains in permanent inventory, purchase, and accounting history.

## 8. Refund Lifecycle

For a cancelled paid purchase, advance the payment through Request, Verify, Approve, Process, and Complete. Select the receiving Cash or Bank account at completion.

Expected:

- Steps cannot be skipped or performed out of order.
- Completion cannot exceed the refundable balance.
- Cash or Bank increases only when the refund is completed.
- Supplier Refund Receivable decreases by the completed amount.
- Payment status becomes Partially Refunded or Refunded.
- Every refund stage remains visible in payment and purchase histories.

## 9. Separate Histories And Reports

Open the manual purchase detail and verify these independent views:

- Purchase: products, quantities, prices, supplier, receipt state, inventory state, status events, user, and timestamps.
- Payment: payment IDs, methods, accounts, amounts, timing, advance or settlement purpose, references, transaction IDs, due, and refund status.
- Accounting: journal IDs, accounts, debits, credits, posting date, source, and posted status.
- Inventory: quantity before, movement, quantity after, SKU, batch, unit cost, purchase ID, user, and timestamp.

Then verify the Purchase and Accounts Payable reports for the selected date range and supplier. Draft or on-hold entries must not inflate confirmed purchase totals.

## Accounting Rule

A product purchase is a Balance Sheet event at receipt: Inventory increases and Cash decreases or Accounts Payable increases. It must not create Sales or COGS. COGS is recognized later when the product is sold or consumed. This resolves the conflicting COGS wording in the supplied document while preserving its final inventory-recognition rule.
