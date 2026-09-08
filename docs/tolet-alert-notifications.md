# To-Let alert notifications

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

`packages/db/src/migrations/0077_tolet_alert_notifications.sql` adds only the notification table and its unique/index keys. Renumbered from 0072 during upstream integration. It is registered in the migration journal. The additive SQL was applied directly to the configured database for local verification on 2026-09-05; its `IF NOT EXISTS` statements make a later normal migration run safe. Other pending migrations were not executed. Deploy API and web code together after applying the migration in each target environment. No GitHub push or production deployment was performed in this task.

## Verification

- `pnpm exec tsx --test packages/api/src/routers/helpers/tolet-alert-matching.test.ts packages/api/src/routers/helpers/tolet-marketplace-visibility.test.ts`
- Opt-in integration test: set `TOLET_ALERT_DB_TEST=1`, then run `pnpm exec tsx --env-file=apps/server/.env --test packages/api/src/services/tolet-alert-notifications.integration.test.ts`. Fixtures use connection-local temporary tables and roll back; no business records are modified.
- Browser: unread badge, matched card, View Details destination, persistent read state, desktop/mobile layout.
- Full web typecheck is blocked by existing shared Calendar/Field/Skeleton React type incompatibilities, outside this change.
