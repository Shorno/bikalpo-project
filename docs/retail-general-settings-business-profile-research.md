# Retail General Settings business-profile data inventory

## Scope

This note inventories first-party data that can support the proposed retail-portal **General Settings / Business Profile** page without invented values. It covers the signed-in retailer view, the related admin view, and the gap between a selected onboarding plan and a real subscription.

## Executive finding

The page can be built now as a mostly read-only profile by combining:

1. the signed-in Better Auth user/session, which already carries the canonical shop identity, logo, address, account dates, and seller state; and
2. `sellerApplication.getMyApplication`, which returns the retailer's latest full application record, including the application number, category, nature, business location, contact channels, selected onboarding plan, experience, and monthly revenue.

Before this implementation, General Settings read only the session and exposed a much smaller subset. It now follows the existing first-party application-status pattern and queries the full current-user application with `orpc.sellerApplication.getMyApplication.queryOptions()` (`apps/web/app/shop/(management)/dashboard/settings/page.tsx:76-84`; `apps/web/app/application-status/page.tsx:46-49`).

There is **no user-subscription record** in the current schema. The only persisted plan-related user value is the application-time `selectedPlan` string (`packages/db/src/schema/seller-application.ts:56-58`). Consequently, Current Plan can show that selected value, but Subscription Status, Plan Start Date, Expiry Date, Auto Renewal, Next Billing Date, and subscription Payment Status must be omitted or explicitly shown as unavailable—not synthesized from the hardcoded dashboard banner.

## Authoritative sources and access paths

### Signed-in retailer session

The `user` table stores `name`, `email`, `image`, `phoneNumber`, `sellerStatus`, `businessType`, `shopAddress`, `ownerName`, `shopName`, `shopSlug`, `shopLogo`, opening/closing time, coordinates, and `createdAt` (`packages/db/src/schema/auth-schema.ts:4-32`, `packages/db/src/schema/auth-schema.ts:39-64`). Those shop fields are registered as Better Auth additional fields, making them available on the session user (`packages/auth/src/index.ts:58-107`, `packages/auth/src/index.ts:143-150`). The current settings page demonstrates direct session access and reads those fields (`apps/web/app/shop/(management)/dashboard/settings/page.tsx:44-70`).

Before the settings edit work, the shop-profile mutation only updated `shopLogo`, `shopOpeningTime`, and `shopClosingTime`, while the separate location mutation updated latitude and longitude. The settings implementation now adds scoped shop-owner mutations for business information, business contact information, and registration plan information in `packages/api/src/routers/shop-owner.ts`. The business mutation also synchronizes the canonical shop fields on `user`; contact edits remain application contacts and deliberately do not change sign-in credentials.

### Latest seller application

The seller application contains the requested business and contact data: application number; shop/owner names; phone; platform business type; shop address; business nature and category; years in business and monthly revenue; area, district, division and postcode; selected plan; Facebook, WhatsApp and website; status; and timestamps (`packages/db/src/schema/seller-application.ts:14-86`).

The protected `GET /seller-applications/my` route returns the signed-in user's latest entire seller-application row, first by user ID and then by phone fallback (`packages/api/src/routers/seller-application.ts:183-210`). This is appropriate for the retailer-facing page. During submission, a real application number is generated in `SELLER-YYYY-######` form (`packages/api/src/routers/helpers/application-fields.ts:86-102`), the selected product type name is persisted as `businessCategory`, and a missing selected plan is persisted as `free_trial` (`packages/api/src/routers/helpers/application-fields.ts:104-150`).

On approval, only a subset of application values is copied to the user row: role/status, `businessType`, shop address/name/slug, owner name, and coordinates (`packages/api/src/routers/helpers/approve-application.ts:79-107`). Category, nature, district/division/area, social channels, experience, revenue, application number, and selected plan remain application data, which is why the General Settings page must query the application instead of relying solely on the session.

### Optional customer-profile source

There is also a separate `user_profile` table with business name, owner name, phone, VAT number, address, Facebook and WhatsApp (`packages/db/src/schema/user-profile.ts:5-27`). The customer profile endpoint exposes those values (`packages/api/src/routers/customer.ts:2905-2950`) and its update endpoint writes them (`packages/api/src/routers/customer.ts:6218-6265`). This is not currently used by the shop General Settings page and can diverge from the canonical `user`/`seller_application` records. For this first retailer profile, prefer the session plus seller application rather than silently mixing in this parallel profile store.

## Requested retailer wireframe: field-by-field map

| Requested display | Real source available now | Recommendation |
| --- | --- | --- |
| Company logo | `session.user.shopLogo`; `session.user.image` is an account image, not necessarily a company logo (`packages/db/src/schema/auth-schema.ts:9`, `packages/db/src/schema/auth-schema.ts:25-32`) | Render `shopLogo`; use a neutral placeholder when absent. Do not relabel an account portrait as a company logo. Existing upload/save is supported. |
| Business ID (`BUS-...`) | `sellerApplication.applicationNumber`, generated as `SELLER-YYYY-######` (`packages/db/src/schema/seller-application.ts:21`, `packages/api/src/routers/helpers/application-fields.ts:86-102`) | Show the stored number verbatim. Do not invent or reformat it as `BUS-000001`. |
| Business name | Application `shopName`; session `shopName` fallback (`packages/db/src/schema/seller-application.ts:23`, `packages/db/src/schema/auth-schema.ts:26`) | Available. |
| Header “Type: Grocery” | Application `businessCategory` stores the selected product-type name (`packages/api/src/routers/helpers/application-fields.ts:71-84`, `packages/api/src/routers/helpers/application-fields.ts:125-129`) | Label this **Business Category** or **Product Type**. `businessType` is instead the platform value `retail` or `restaurant`. Existing admin UI makes the same distinction (`apps/web/components/features/admin/application-detail-sections.tsx:437-453`). |
| Nature | Application `businessNature` (`packages/db/src/schema/seller-application.ts:41-46`) | Available, formatted with the existing label map. Note: the seller/retail path permits retail shop, manufacturer and importer; wholesaler/distributor route to the warehouse portal (`packages/api/src/business-registration.ts:13-36`). Do not assume “Wholesaler” for a retail account. |
| Profile completion | No persisted retailer value; an existing admin helper computes a percentage from nine real checks (`packages/api/src/routers/admin-user-management.ts:273-298`) | Do not hardcode 95%. Either omit it for this phase or reuse/share that exact computation and label it computed. |
| Plan | Application `selectedPlan`; onboarding IDs are `free_trial`, `starter`, and `growth` (`apps/web/components/features/onboarding/step-plan-selection.tsx:12-64`) | Show the selected application plan with a presentation label such as “Free Trial.” It is not proof of an active subscription. |
| Since | Application `createdAt` and user `createdAt` (`packages/db/src/schema/seller-application.ts:81-86`, `packages/db/src/schema/auth-schema.ts:60-64`) | Available, but label precisely: use application date for “Applied” or account creation for “Member since.” |
| Business Type | Application/session `businessType` (`retail` or `restaurant`) (`packages/api/src/routers/seller-application.ts:31-36`) | Available as **Platform Type**. Do not show “Grocery” here. |
| Business Category | Application `businessCategory` | Available. |
| Business Address | Application `shopAddress`; session fallback | Available. |
| District | Application `district` | Available when supplied. |
| Division | Application `division` | Available when supplied. |
| Thana | No persisted thana field on `seller_application`; only `area` is persisted (`packages/db/src/schema/seller-application.ts:49-55`) | Show **Area** from `application.area`, not “Thana.” Reverse geocoding can return thana, but the onboarding persistence contract does not store it (`apps/web/hooks/use-barikoi-reverse-geocode.ts:6-19`, `apps/web/components/features/onboarding/location-picker-section.tsx:195-215`). |
| Mobile Number | Application `phoneNumber`; session phone fallback | Available. |
| WhatsApp | Application `whatsappNumber` | Available when supplied. |
| Email Address | Application `email`; session email fallback | Available. |
| Facebook Page | Application `facebookUrl` | Available when supplied. |
| Messenger | No schema field | Omit/unavailable. Facebook URL must not be presented as a Messenger contact. |
| Website | Application `websiteUrl` | Available when supplied. |
| Telegram | No schema field | Omit/unavailable. |
| Current Plan | Application `selectedPlan` only | Available as an onboarding selection, not a subscription record. |
| Subscription Status | No user-subscription source | Omit/unavailable. Application status and seller status are different concepts. |
| Plan Start Date | No source | Omit/unavailable. |
| Expiry Date | No source | Omit/unavailable. |
| Auto Renewal | No source | Omit/unavailable. |
| Next Billing Date | No source | Omit/unavailable. |
| Payment Status | No subscription-payment source | Omit/unavailable. Order/invoice payment status must not be reused. |

The three content cards can therefore be retained structurally, but the third card should initially contain only **Selected Plan** (and perhaps an honest note that billing details are not yet available). The contact card should render only supplied channels; it should not create blank-but-plausible Messenger or Telegram values.

## Admin version

The admin user-detail API already returns the complete user, latest linked seller/warehouse application (including the product-type relation), a stable display ID, a computed profile-completion percentage, account/KYC state, and applied/reviewed dates (`packages/api/src/routers/admin-user-management.ts:549-683`). Its UI already derives:

- business name and address from the role-specific user fields (`apps/web/app/(dashboard)/dashboard/admin/user-overview/_components/user-detail-client.tsx:169-196`);
- area as the displayed territory and `selectedPlan` from the application (`apps/web/app/(dashboard)/dashboard/admin/user-overview/_components/user-detail-client.tsx:198-204`);
- application number, completion, and joined date in the profile hero (`apps/web/app/(dashboard)/dashboard/admin/user-overview/_components/user-detail-client.tsx:254-267`); and
- selected plan and registration/approval dates in the side rail (`apps/web/app/(dashboard)/dashboard/admin/user-overview/_components/user-detail-client.tsx:393-440`).

The requested admin **Business Info** card can therefore show name, product type/category, composed coverage (`area, district, division`), address, nature, experience, and sales volume. This composition already exists in first-party admin UI (`apps/web/components/features/admin/application-detail-sections.tsx:146-148`, `apps/web/components/features/admin/application-detail-sections.tsx:437-468`). The requested admin **User Plan** card has the same limitation as the retailer view: only selected plan is real; subscription lifecycle/billing fields do not exist.

## Existing placeholders and misleading sources to avoid

The retail dashboard currently displays “Trial ends in 10 days” and “Renewal date: 04 Feb 2026” as literal JSX text, not fetched data (`apps/web/app/shop/(management)/dashboard/page.tsx:101-121`). Those values must not be reused in General Settings.

The database has a `landing_pricing_plan` catalog with plan names, prices and features, but it is marketing configuration and has no user/subscription foreign key (`packages/db/src/schema/landing-page.ts:4-17`). It cannot answer which plan a user currently owns, whether it is active, or when billing occurs.

The admin dashboard does have an aggregate heuristic: it treats `free_trial` as 14 days from application approval (or creation), and treats every `starter`/`growth` application as perpetually active (`packages/api/src/routers/dashboard.ts:313-383`). This returns only aggregate counts, not a signed-in user's subscription record. It is useful evidence of intended trial semantics, but it is not authoritative individual billing data and should not be presented as renewal/payment truth on General Settings.

The original seller-application update route is restricted to pending/rejected applications (`packages/api/src/routers/seller-application.ts:366-439`). The General Settings implementation therefore uses three authenticated, section-specific shop-owner mutations instead of weakening the registration-review route. Each mutation updates only its own field group on the signed-in user's latest application.

## Safe first implementation shape

1. Keep `/shop/dashboard/settings` as the General Settings route; it is already the first child of the collapsible Settings group (`apps/web/components/dashboard/shop-owner-sidebar.tsx:301-315`).
2. Query both `authClient.useSession()` and `orpc.sellerApplication.getMyApplication` using the existing status-page pattern.
3. Render the header with real shop logo (or placeholder), stored application number, business name, category, nature, selected plan, and an accurately labeled date.
4. Render **Business Info** and **Contact Info** from the application with documented session fallbacks. Render missing optional fields as `—` or omit the row consistently.
5. Render a reduced **Selected Plan** card containing only the formatted `selectedPlan` plus other real registration metadata. Do not render subscription lifecycle rows until a subscription domain/table/API exists.
6. Reuse/share the existing nine-check profile-completion algorithm if a percentage is required; never use the example's 95% literal.
7. Keep edits section-scoped: Business Information, Contact Information, and registration Plan Information each open and save in their own modal. Continue treating the plan value as a registration preference, not an active subscription.
