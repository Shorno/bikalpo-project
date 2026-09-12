# Property contact verification — implementation and rollout boundary

## Requirement and decision

`SERIES CREATION SYSTEM (4).pdf`, registration Step 3, requires phone OTP verification before review/register. A six-digit format check is not verification. The prior component accepted any six digits and property create/update trusted `phoneVerified: true`; that path has been removed.

Property contact can differ from the signed-in account's number. This flow reuses the existing Bangladesh phone normalization and auth verification storage table, but uses its own namespace and does not sign in, register another user, or change the account phone. Login and rental-payment OTP flows are separate.

## Server proof

- Authenticated consumer requests a code for the normalized property phone.
- Server generates six random digits, persists only an HMAC hash, and enforces a five-minute lifetime.
- Request limits: one per 60 seconds and five per hour per user, including across changed phone numbers.
- At most five failed verification attempts; failures commit to the counter before the API throws.
- A correct code is consumed and returns a random one-use proof, bound to the current user and normalized phone, expiring after 15 minutes.
- Registration and edit require that proof; the verification is consumed inside the property-write transaction so failed writes are safe to retry.
- Old client-asserted `phoneVerifiedAt` timestamps are not grandfathered. Every property edit currently requires fresh verification, including an unchanged number.
- Registration drafts never persist a usable proof or restore verified status. A changed number clears client verification.

## Production blocker — SMS is not configured

The incumbent auth `sendOTP` callback only logs and stores codes. There is no real SMS provider integration in this repository. Treating this as delivery would misrepresent phone ownership.

The property flow therefore returns `SERVICE_UNAVAILABLE` outside explicit `NODE_ENV=development`, including request, verification, and proof consumption. Production registration/edit requiring verification cannot proceed until an SMS delivery adapter is integrated and tested. This is intentional fail-closed behavior, not a completed production SMS feature.

Development shows a clearly labelled test code to the requesting authenticated user, stating no SMS was sent. It does not auto-verify. The shared `devOtp.get` endpoint now returns `NOT_FOUND` outside development, so it cannot leak login OTPs in production. Normal login handlers were not changed.

## Verification

- `tolet-property-phone-policy.test.ts`: random code, wrong/expired code, account and phone binding, attempts, resends/quota, proof forgery, expiry, reuse.
- `tolet-property-phone.integration.test.ts`: PostgreSQL connection-local TEMP table only; persistent failed attempts, single-use proof and transaction rollback. Opt in with `TOLET_PROPERTY_PHONE_DB_TEST=1`, `NODE_ENV=development` and server environment loaded.
- `tolet-property-phone-production.test.ts`: production code requests, verification and consumption fail closed; development OTP retrieval returns 404. Run with `NODE_ENV=production` and server environment loaded; no database business writes.
- SMS delivery and real-device OTP autofill remain untested until a provider exists. No migration is required or applied by this change.

## Isolated visual QA

The actual `PropertyPhoneVerification` and shared Input/Button components were mounted with mocked OTP responses and the locally served shared CSS, in fresh isolated headless browser contexts at 1440px and 390px. Initial, incorrect-code, verified and SMS-unavailable states were captured and visually inspected. All eight states had no horizontal overflow or browser runtime errors; the mobile OTP input is 16px. Screenshots and machine checks are in `.impeccable/review/otp-ui-qa/`.

This checks the component layout and its mocked interaction states, not a real SMS or complete account/property registration flow. No private browser profile, real account session, SMS send or business record was used.
