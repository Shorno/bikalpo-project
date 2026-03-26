# Wire Up Phone Auth + Application Submission

Connect the onboarding wizard to real Better Auth phone sign-up and existing seller/warehouse application APIs, with a dev-only OTP endpoint for auto-filling.

## Proposed Changes

### Auth — Phone Number Plugin

#### [MODIFY] [index.ts](file:///c:/Users/Shorno/WebstormProjects/bikalpo-project/packages/auth/src/index.ts)
- Import `phoneNumber` from `better-auth/plugins`
- Add plugin with:
  - `sendOTP`: stores code in-memory Map + logs to console
  - `signUpOnVerification`: auto-creates user on verify with `getTempEmail: (phone) => \`${phone}@bikalpo.com\``
  - `otpLength: 6`

#### [MODIFY] [auth-client.ts](file:///c:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/lib/auth-client.ts)
- Import `phoneNumberClient` from `better-auth/client/plugins`
- Add to plugins array

---

### Backend — Dev OTP Endpoint + Schema Gap Fix

#### [NEW] [dev-otp.ts](file:///c:/Users/Shorno/WebstormProjects/bikalpo-project/packages/api/src/routers/dev-otp.ts)
- oRPC router with a `publicProcedure` to retrieve stored OTP by phone number
- Uses the same in-memory Map from auth config
- **Dev-only** — wrapped in `NODE_ENV !== 'production'` guard

#### [MODIFY] [seller-application.ts schema](file:///c:/Users/Shorno/WebstormProjects/bikalpo-project/packages/db/src/schema/seller-application.ts)
The wizard collects fields the current schema doesn't have. Add:
- `businessCategory` (text, optional) — "Grocery & FMCG", "Electronics", etc.
- `yearsInBusiness` (text, optional) — "New", "1-3 years", "3+ years"
- `monthlyRevenue` (text, optional) — "< ৳50K", "৳50K-2L", "৳2L+"
- `latitude` / `longitude` (real, optional) — map pin location
- `selectedPlan` (text, optional) — "free_trial", "starter", "growth"

> [!IMPORTANT]
> **DB migration required** after schema change. Run `pnpm drizzle-kit generate` then `pnpm drizzle-kit migrate`.

#### [MODIFY] [seller-application.ts router](file:///c:/Users/Shorno/WebstormProjects/bikalpo-project/packages/api/src/routers/seller-application.ts)
- Expand `submitApplicationSchema` zod schema to include new fields
- Update `.values()` in `submit` and `update` handlers

#### [MODIFY] [routers/index.ts](file:///c:/Users/Shorno/WebstormProjects/bikalpo-project/packages/api/src/routers/index.ts)
- Register `devOtpRouter` (conditional on dev mode)

---

### Frontend — Wire Wizard to Auth + API

#### [MODIFY] [step-account.tsx](file:///c:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/components/features/onboarding/step-account.tsx)
- Replace dummy OTP with real `authClient.phoneNumber.sendOtp({ phoneNumber })`
- After send: call `client.devOtp.get({ phoneNumber })` → get real code → auto-fill boxes
- On verify: call `authClient.phoneNumber.verify({ phoneNumber, code })` → user is created + session starts
- Password field becomes optional (phone auth creates account, password can be set later)

#### [MODIFY] [register/page.tsx](file:///c:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/app/b2b/register/page.tsx)
- [handleSubmit](file:///c:/Users/Shorno/WebstormProjects/bikalpo-project/apps/web/app/b2b/register/page.tsx#129-134): replace `setTimeout` with real API calls:
  1. Upload documents to Cloudinary via `client.cloudinary.*` (if docs exist)
  2. Submit seller application via `client.sellerApplication.submit(...)` (shop/restaurant) or `client.warehouseApplication.submit(...)` (warehouse)  
  3. On success → `router.push("/b2b/register/success")`
  4. On error → show toast

---

### Shared OTP Store (Server-Side)

#### [NEW] [otp-store.ts](file:///c:/Users/Shorno/WebstormProjects/bikalpo-project/packages/auth/src/otp-store.ts)
- Simple `Map<string, { code: string; expiresAt: number }>` 
- `storeOtp(phone, code)` + `getOtp(phone)` exports
- Used by both the auth plugin's `sendOTP` and the dev-otp router

---

## Verification Plan

### Automated Tests
- Start server + web app
- Navigate to `/b2b/register`
- Enter phone → send OTP → verify OTP auto-fills → verify succeeds
- Fill all steps → submit → check seller_application table has a new row
