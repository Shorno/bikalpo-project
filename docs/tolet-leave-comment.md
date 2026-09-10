# Leave and Comment — CONSUMER.pdf developer notes

## Decisions

- Scope: authenticated tenant rental details (My Bookings), not a public visitor's listing action.
- Leave immediately opens the prefilled Create To-Let Alert form and requests the Leaving transition. Saving preferences is a separate action; closing the form does not undo Leave.
- Repeat Leave requests are idempotent. A conditional update prevents concurrent requests from creating duplicate legacy alerts or resetting the deadline.
- Existing contract end date remains the rental-period cutoff, in Asia/Dhaka. No new monthly cutoff is invented.
- Completed rentals appear in history; the API rejects tenant private-detail access after completion. Owners retain their historical access.
- Comment opens the rental comments section and existing feedback submission. Comments remain scoped to the rental contract; a public cross-tenant property review feed is not introduced.
- Existing lifecycle processing persists completion and unit availability. Booking summaries also derive expired status immediately, without waiting for the scheduled lifecycle job.

## Skill fallback

The requested grill-with-docs skill references missing grilling and domain-modeling skills. This requirements/decision checklist is the fallback; unresolved period wording is handled by preserving the existing contract rule.

## Safety

No schema migration, Git push, or live booking/payment/comment mutation is required for this change. Production lifecycle scheduling still needs deployment-level verification.
