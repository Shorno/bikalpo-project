# Store-specific order tracking

The user approved extending the shop footer's Track order action to show only the current consumer's active orders with that store. One active order opens the existing order detail/tracking page automatically. Multiple active orders show a dated, status-labelled picker with pagination. Zero active orders show an honest empty state and a link back to that store.

Use `/stores/[slug]/track` within the independent shop layout. Guests sign in and return to this route, preserving customer preview. Validate store identity through the existing public store API. The protected query must filter on the authenticated user, shop ID, B2C type and non-open orders; delivered, cancelled and returned orders are excluded, consistent with existing active tracking. Do not change global account tracking or order-detail authorization.

Query errors must offer recovery rather than being mistaken for no orders. Cache identity includes the viewer. The shared query uses 20 rows per page and deterministic newest-first ordering. No order or delivery state is changed.

Validation includes isolated database fixtures for cross-customer/store exclusion, inactive/open/B2B exclusion, zero/one/multiple counts and pagination, plus browser checks and existing suites. Existing React typing conflicts outside the changed files are not part of this task.
