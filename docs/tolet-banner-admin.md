# To-Let banner administration

- Admin route: `/dashboard/admin/to-let` (existing `requireAdmin` layout and `adminProcedure` API guards).
- Admin can upload images through the existing Cloudinary uploader, edit titles and optional links, reorder/remove slides, and publish 1–10 slides atomically.
- Public route: `GET /rpc/toLetBanner/getPublic`; the landing page caches the response for 60 seconds.
- Multiple slides advance every 6 seconds. Hover, focus and the Pause control suspend rotation. Reduced-motion users get manual controls without autoplay.
- With no configured slides or a backend failure, the original local banner remains visible.
- Removing a slide does not delete its Cloudinary asset; this prevents accidental destruction of a previously published image.

## Database deployment

The isolated additive migration is `docs/pending/tolet-banner.sql`. It creates only `tolet_banner`; do not run a broad schema push for this feature.

From the repository root, with the intended deployment database configured:

```powershell
bun --env-file=apps/server/.env packages/db/src/apply-tolet-banner.ts
```

Applied to the connected development database during this implementation. No sample slides or other existing records were written.

## Verification

- Banner validation tests cover valid slides, unsafe links, invalid images, and slide limits.
- Unauthenticated admin get/save requests return 401.
- Frontend and backend type checks pass.
- Authenticated upload/publish and multi-slide playback still require an admin-session end-to-end check before production deployment.
