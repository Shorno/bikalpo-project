# Store item requests

Approved scope: consumers request an item from a specific retailer store, and that retailer receives it. Provide item name, integer quantity, optional brand/details, a retailer inbox and replies/status visible to the consumer. This is an availability request, not an order or inventory operation.

The shop footer links to `/stores/[slug]/requests?request=new` for the form and `/stores/[slug]/requests` for status. Authentication returns to the same store and preserves preview. A simple modal retains drafts on dismissal and errors, disables duplicate submission while pending, and clears after success. Store requests use Pending, Available and Unavailable states, with the retailer's reply.

Retailer sidebar: Support → Item Requests, at `/dashboard/support/item-requests` on the shop host. Existing `shop_support` view/update permissions govern access; owner/staff identity determines the store server-side. Consumers may only list their own requests; stores may only read/respond to their own. Validate the destination is an approved retailer on creation. Lists paginate in groups of 20, newest first.

Use a separate store request table and API to preserve existing global customer-to-admin requests and their approval/alternative-product workflow. Reuse established dialog/form controls. Migration `0076_store_item_requests.sql` is additive and idempotent; applied locally for this task. No stock, order, direct chat, external notification or admin-processing changes.

Validation: real ORPC middleware/database tests with isolated accounts, cross-store/customer protection, input validation, permissions, reply visibility and pagination. Browser checks should not submit requests to a real store. Existing unrelated React type conflicts are outside this change.
