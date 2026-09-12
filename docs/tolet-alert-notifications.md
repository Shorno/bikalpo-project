# To-Let alert notifications

## Production hardening — 2026-09-12

- Saved-alert and inbox query keys are both consumer-specific. Queries are disabled while the session is pending, for guests and for non-consumers. Previous-account placeholder data is never reused; oRPC prefix invalidation still works.
- Both ordinary Create Alert and optional Leave-with-alert creation use `saveToLetAlert` inside a READ COMMITTED transaction. A per-user `pg_advisory_xact_lock` is acquired before duplicate lookup, paused-alert resume, count and insert. Concurrent same-user writes cannot independently consume the last quota slot; existing duplicates resume/reuse even at the 50-record limit.
- The Leave transaction rolls back as a unit if creating a new alert would exceed the quota. Existing saved searches are not deleted or migrated. No new schema migration is required for these fixes.
- Unit tests cover consumer cache separation, logout/pending sessions, prefix invalidation, concurrent identical requests, last-slot contention, separate users and duplicate resume at quota.
- Opt-in PostgreSQL tests passed against connection-local temporary tables (rolled back), including real cross-connection advisory-lock contention. Existing notification matching/deduplication integration test also passed. No business records were altered.
- Test commands: `pnpm exec tsx --test apps/web/lib/to-let-alert-cache.test.ts packages/api/src/services/tolet-saved-alerts.test.ts packages/api/src/routers/helpers/tolet-alert-matching.test.ts packages/api/src/routers/helpers/tolet-marketplace-visibility.test.ts`; with `TOLET_ALERT_DB_TEST=1`, `pnpm exec tsx --env-file=apps/server/.env --test packages/api/src/services/tolet-saved-alerts.integration.test.ts packages/api/src/services/tolet-alert-notifications.integration.test.ts`.
- Still required before production sign-off: confirm target migration 0080/0082, deploy API/web together, authenticated two-account browser smoke test and performance/operational monitoring. No deploy/push performed. This remains in-app polling, not background SMS/email/push.

Consumer dashboard → To-Let → My Alert now shows a persistent inbox and unread badge.

The header Create Alert button opens the inline preferences form. The inbox uses booking-style horizontal cards (stacked on mobile), with an image carousel/count, received date, top-right View Details, rent, room/size facts, facilities and availability. Booking-specific statuses/actions are not copied into alerts.

## Matching

- An active saved search matches category, preferred location and minimum size (inclusive) only.
- `any` category and `Any location`/`any` location are wildcards. Location words are case-insensitive literal matches across area, district, division and full address; all words must appear. No automatic transliteration or nearby-area expansion.
- Bedroom, bathroom, balcony and floor preferences remain saved but do not block alerts.
- Discovery includes existing available public listings, not only listings published after the search was saved. Draft, paused, QR-only, expired, blocked/inactive properties, occupied/booked units and the consumer's own properties are excluded from new matches.
- Pausing a search stops discovery from that search. Existing received alerts remain in history.
- A consumer/listing unique index prevents duplicates from overlapping searches or concurrent refreshes. A new listing identity after re-listing can create a new notification.

## Refresh and read state

The authenticated inbox endpoint reconciles matches on refresh. While the consumer dashboard is open, React Query refreshes it every 60 seconds, and on focus/re-entry. This is in-app polling, not SMS/email/web push or an offline scheduler.

Opening View Details marks that notification read; a separate action marks unread items on the displayed page read. Both server operations are scoped to the authenticated consumer. Cache keys include the user ID. Read alerts stay in All Alerts; the unread badge is hidden at zero. The feed is paginated in groups of 12. Expired/private records render an unavailable placeholder without listing details; currently public booked listings remain viewable.

## Database and rollout

`packages/db/src/migrations/0080_tolet_alert_notifications.sql` adds only the notification table and its unique/index keys. Renumbered from 0072 (then 0077) to 0080 during upstream integration. It is registered in the migration journal. The additive SQL was applied directly to the configured database for local verification on 2026-09-05; its `IF NOT EXISTS` statements make a later normal migration run safe. Other pending migrations were not executed. Deploy API and web code together after applying the migration in each target environment. No GitHub push or production deployment was performed in this task.

## Verification

- `pnpm exec tsx --test packages/api/src/routers/helpers/tolet-alert-matching.test.ts packages/api/src/routers/helpers/tolet-marketplace-visibility.test.ts`
- Opt-in integration test: set `TOLET_ALERT_DB_TEST=1`, then run `pnpm exec tsx --env-file=apps/server/.env --test packages/api/src/services/tolet-alert-notifications.integration.test.ts`. Fixtures use connection-local temporary tables and roll back; no business records are modified.
- Browser: unread badge, matched card, View Details destination, persistent read state, desktop/mobile layout.
- Full web typecheck is blocked by existing shared Calendar/Field/Skeleton React type incompatibilities, outside this change.
