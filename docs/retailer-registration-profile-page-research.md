# Retailer registration profile page research

**Research date:** 2026-09-08  
**Scope:** current retailer General Settings, admin retailer/warehouse registration views, registration/profile data, owner edit APIs, permissions, and bank/mobile-banking handling. This is a source-code study; no product behavior was changed.

## Executive decision

The request is understood as a navigation and ownership change, not merely a larger dialog:

- `/dashboard/settings` should remain the settings hub for storefront hours, subscription, login/security, and links to other settings.
- Add a dedicated **Registration Profile** at `/dashboard/settings/profile`, using the admin retailer/warehouse registration-detail presentation as its read-only structure.
- Add `/dashboard/settings/profile/edit` as a full-page editor for all retailer-editable profile sections. Every current **Change Logo**, **Edit Business Profile**, and **Edit Contact Info** trigger should navigate to this editor instead of opening separate dialogs.
- The profile must show the complete registration record, not only the small session-backed subset currently shown in General Settings. Admin-only controls, internal notes, login activity, approval/rejection actions, suspension, and KYC verification actions must not appear in the retailer version.
- Bank/payment information needs two clearly named sections because the repository contains two different domains: the application snapshot's single optional bank record and the finance subsystem's multiple operational bank/mobile-banking accounts. They must not silently overwrite one another.

The approved-user admin view is the closest design reference: it reuses the registration sections inside Basic Information, Documents, and Social tabs, adds a profile hero and sidebar metadata, and links back to the original application ([`user-detail-client.tsx:255-331`](../apps/web/app/%28dashboard%29/dashboard/admin/user-overview/_components/user-detail-client.tsx#L255), [`user-detail-client.tsx:342-465`](../apps/web/app/%28dashboard%29/dashboard/admin/user-overview/_components/user-detail-client.tsx#L342)).

## 1. Current retailer settings flow

The retailer's entire profile and general-settings experience currently lives in one client page. It reads the Better Auth session plus the latest seller application, computes profile completion, and renders the business hero, profile cards, storefront hours, financial settings, and password/security on one route ([`settings/page.tsx:91-145`](../apps/web/app/shop/%28management%29/dashboard/settings/page.tsx#L91), [`settings/page.tsx:365-485`](../apps/web/app/shop/%28management%29/dashboard/settings/page.tsx#L365)).

Profile editing is fragmented across overlays:

1. Company logo uses a dedicated upload dialog and writes `user.shopLogo` through `updateShopProfile` ([`settings/page.tsx:202-268`](../apps/web/app/shop/%28management%29/dashboard/settings/page.tsx#L202)).
2. Business identity/location uses `BusinessInformationDialog`, which edits name, owner, platform type, product type, nature, address, thana, district, division, postcode, and coordinates ([`settings/page.tsx:566-815`](../apps/web/app/shop/%28management%29/dashboard/settings/page.tsx#L566)). The same dialog is exposed from both the hero and Business Info card ([`settings/page.tsx:309-315`](../apps/web/app/shop/%28management%29/dashboard/settings/page.tsx#L309), [`settings/page.tsx:370-390`](../apps/web/app/shop/%28management%29/dashboard/settings/page.tsx#L370)).
3. Business contacts use another dialog for phone, email, WhatsApp, Facebook, Messenger, website, and Telegram ([`settings/page.tsx:818-960`](../apps/web/app/shop/%28management%29/dashboard/settings/page.tsx#L818)).
4. Subscription viewing/upgrading uses a separate transactional dialog ([`retailer-subscription.tsx:109-349`](../apps/web/components/features/settings/retailer-subscription.tsx#L109)).
5. Each operational bank/mobile-banking account uses another add/edit dialog ([`financial-settings-section.tsx:131-177`](../apps/web/components/features/settings/financial-settings-section.tsx#L131), [`financial-settings-section.tsx:361-515`](../apps/web/components/features/settings/financial-settings-section.tsx#L361)).

The requested profile page should replace items 1-3 with one full-page edit flow. Subscription and password/security are not registration-profile data and should remain distinct settings workflows. Financial accounts may be presented on the profile because the client requested them there, but should retain their finance semantics and APIs.

## 2. Admin registration view to reproduce

The admin application route accepts both `seller` and `warehouse`, then selects the corresponding application query ([`approval/[type]/[id]/page.tsx:7-26`](../apps/web/app/%28dashboard%29/dashboard/admin/user-overview/approval/%5Btype%5D/%5Bid%5D/page.tsx#L7), [`approval-detail-client.tsx:72-93`](../apps/web/app/%28dashboard%29/dashboard/admin/user-overview/approval/_components/approval-detail-client.tsx#L72)). It normalizes `shopName/shopAddress` and `warehouseName/warehouseAddress` into one view model ([`approval-detail-client.tsx:186-211`](../apps/web/app/%28dashboard%29/dashboard/admin/user-overview/approval/_components/approval-detail-client.tsx#L186)).

Its useful owner-facing information architecture is:

- Profile hero: applicant photo, name, phone, email, date of birth, gender, personal-location hint, application ID/status/submission date, and KYC state ([`application-detail-sections.tsx:241-350`](../apps/web/components/features/admin/application-detail-sections.tsx#L241)).
- Basic Information: business identity/overview, personal location, business location, bank/tax, and referral ([`approval-detail-client.tsx:270-299`](../apps/web/app/%28dashboard%29/dashboard/admin/user-overview/approval/_components/approval-detail-client.tsx#L270)).
- Documents: trade license, NID, shop photo, storefront photo, and optional warehouse photo with view/download affordances ([`application-detail-sections.tsx:106-112`](../apps/web/components/features/admin/application-detail-sections.tsx#L106), [`application-detail-sections.tsx:496-604`](../apps/web/components/features/admin/application-detail-sections.tsx#L496)).
- Social: Facebook, WhatsApp, Instagram, website, TikTok, and X ([`application-detail-sections.tsx:659-695`](../apps/web/components/features/admin/application-detail-sections.tsx#L659)).
- Sidebar: selected plan and application timeline ([`approval-detail-client.tsx:339-416`](../apps/web/app/%28dashboard%29/dashboard/admin/user-overview/approval/_components/approval-detail-client.tsx#L339)).

The reusable read-only components are already exported: `DetailSection`, `DetailField`, `BusinessInformationSection`, `PersonalLocationSection`, `BusinessLocationSection`, `BankAndTaxSection`, `LabeledDocumentsSection`, `ReferralSection`, `SocialProfilesSection`, and `toApplicationDetail` ([`application-detail-sections.tsx:167-213`](../apps/web/components/features/admin/application-detail-sections.tsx#L167), [`application-detail-sections.tsx:392-493`](../apps/web/components/features/admin/application-detail-sections.tsx#L392), [`application-detail-sections.tsx:742-790`](../apps/web/components/features/admin/application-detail-sections.tsx#L742)). They should first be extracted/renamed from `features/admin` into a role-neutral registration-profile module. The admin hero should not be reused wholesale because its callback contract includes approve, reject, and KYC verification actions ([`application-detail-sections.tsx:241-264`](../apps/web/components/features/admin/application-detail-sections.tsx#L241)).

Admin's own **Edit User Info** modal is not the target behavior: it edits only a few `user` fields ([`user-detail-client.tsx:545-694`](../apps/web/app/%28dashboard%29/dashboard/admin/user-overview/_components/user-detail-client.tsx#L545)), and its API updates only `user`, not either registration table ([`admin-user-management.ts:750-848`](../packages/api/src/routers/admin-user-management.ts#L750)).

## 3. Complete profile content and edit policy

The seller application is the registration source of truth. It stores applicant identity and personal location; business profile/location; plan; documents; bank/referral; social channels; review state; and timestamps ([`seller-application.ts:14-96`](../packages/db/src/schema/seller-application.ts#L14)). The warehouse table has the same broad structure but uses warehouse name/address and lacks retailer-only `thana`, Messenger, and Telegram fields ([`warehouse-application.ts:7-85`](../packages/db/src/schema/warehouse-application.ts#L7)).

Recommended page sections and policies:

| Section | Fields | Edit policy |
| --- | --- | --- |
| Registration summary | application number, application status, KYC status, applied/reviewed dates, profile completion | Read-only. |
| Applicant information | profile photo, owner/full name, phone, email, DOB, gender | Full name/photo/DOB/gender may be editable. Login phone/email need a verified identity-change flow; do not reuse the current public-contact mutation as an authentication change. |
| Personal location | address, area, district, division, postcode, coordinates/map | Editable full-page location picker. Currently missing from retailer settings. |
| Business information | shop name, platform type, product type/category, nature, experience, sales volume | Editable, but category/nature changes after approval should either require re-review or be explicitly treated as non-governed profile changes. |
| Business location | address, area/thana, district, division, postcode, coordinates/map | Editable. Preserve `area` instead of clearing it during an update; the current business mutation explicitly sets it to `null` ([`shop-owner.ts:2123-2142`](../packages/api/src/routers/shop-owner.ts#L2123)). |
| Tax and license | BIN, TIN, trade-license number | Editable with validation. The current admin card reduces trade license to a submitted/not-provided status ([`application-detail-sections.tsx:606-643`](../apps/web/components/features/admin/application-detail-sections.tsx#L606)). |
| Documents | trade license, NID, shop photo, storefront photo, optional warehouse photo | View/download on profile; replace/upload in edit mode. Document replacement should intentionally reset or create a pending KYC review record. Current KYC helpers do not do this automatically ([`kyc-verification.ts:25-49`](../packages/api/src/routers/helpers/kyc-verification.ts#L25)). |
| Business contacts | public phone/email, WhatsApp, Facebook, Messenger, Instagram, website, Telegram, TikTok, X | Editable. The current contact editor covers only a subset even though the application stores more channels. |
| Referral | referral ID, name, phone | Read-only after submission because it participates in referral/reward decisions. |
| Registration plan | original selected-plan preference | Read-only historical registration value. Actual subscription state is a separate domain. |
| Banking and payment accounts | registration bank snapshot plus operational bank/mobile accounts | See the source-of-truth decision below. |

There are also display gaps in the shared admin components: seller `thana`, `messengerUrl`, and `telegramUrl` exist in the schema but are absent from `ApplicationDetailData`, its mapper, and the displayed social/location sections ([`seller-application.ts:49-75`](../packages/db/src/schema/seller-application.ts#L49), [`application-detail-sections.tsx:60-104`](../apps/web/components/features/admin/application-detail-sections.tsx#L60), [`application-detail-sections.tsx:742-790`](../apps/web/components/features/admin/application-detail-sections.tsx#L742)). Extending the role-neutral view model fixes both admin and owner views.

## 4. Bank and mobile-banking decision

Contrary to the assumption that bank details are absent from registration, the current registration form already collects a single optional bank name, account name, and account number ([`step-verification.tsx:599-701`](../apps/web/components/features/onboarding/step-verification.tsx#L599)), submits them to the shared application contract ([`register/page.tsx:521-529`](../apps/web/app/b2b/register/page.tsx#L521), [`application-fields.ts:53-56`](../packages/api/src/routers/helpers/application-fields.ts#L53)), and stores them on both seller and warehouse applications ([`seller-application.ts:62-65`](../packages/db/src/schema/seller-application.ts#L62), [`warehouse-application.ts:53-56`](../packages/db/src/schema/warehouse-application.ts#L53)). Mobile banking is not collected in registration.

Operational accounts are different. `finance_payment_account` supports multiple `cash`, `bank`, and `mobile_banking` records scoped by owner and owner type, with balances, active/default flags, and a linked ledger account ([`finance-payment-account.ts:19-67`](../packages/db/src/schema/finance-payment-account.ts#L19)). The settings APIs list, create, and update owner-scoped bank/mobile records and enforce `shop_accounts` permissions ([`finance.ts:2290-2331`](../packages/api/src/routers/finance.ts#L2290), [`finance.ts:2333-2470`](../packages/api/src/routers/finance.ts#L2333), [`finance.ts:2472-2554`](../packages/api/src/routers/finance.ts#L2472)).

Recommended behavior:

1. Show the application triple as **Bank details submitted at registration** (historical/read-only until a migration decision is made).
2. Show the finance records as **Business payment accounts**, allowing multiple bank and mobile-banking accounts to be added/edited inline on the dedicated page.
3. Do not write edits to both tables opportunistically. If product wants one canonical list, add an explicit one-time migration that creates a finance bank account from a non-empty application bank triple, records migration/idempotency, and thereafter treats finance accounts as canonical operational data.
4. Continue masking account numbers in read-only views; the admin component already masks all but the last four characters ([`application-detail-sections.tsx:139-143`](../apps/web/components/features/admin/application-detail-sections.tsx#L139)).

## 5. API and permission gaps

The owner can already read the complete latest application through `sellerApplication.getMyApplication`, including a phone-number fallback ([`seller-application.ts:186-213`](../packages/api/src/routers/seller-application.ts#L186)). The generic application update route cannot power the new page for approved retailers: it rejects approved applications and resets allowed edits to pending review ([`seller-application.ts:369-445`](../packages/api/src/routers/seller-application.ts#L369)).

The current post-approval retailer mutations are partial:

- `updateBusinessInformation` updates selected application fields and duplicates canonical shop fields to `user` in a transaction ([`shop-owner.ts:2073-2158`](../packages/api/src/routers/shop-owner.ts#L2073)).
- `updateBusinessContactInformation` updates only the latest seller application ([`shop-owner.ts:2160-2188`](../packages/api/src/routers/shop-owner.ts#L2160)).
- `updateBusinessPlanInformation` updates selected plan, experience, and revenue ([`shop-owner.ts:2190-2224`](../packages/api/src/routers/shop-owner.ts#L2190)).
- `updateShopProfile` updates only logo and operating hours on `user` ([`shop-owner.ts:2306-2335`](../packages/api/src/routers/shop-owner.ts#L2306)).

Missing owner edit coverage includes applicant photo/DOB/gender, personal location, business `area`, tax/license, documents, application bank snapshot, referral policy, and several social fields. A dedicated, owner-scoped `getMyRegistrationProfile` plus sectioned update commands is preferable to one unrestricted mega-update. It should return a normalized DTO (application + safe account fields + KYC metadata + actual subscription summary), use transactions where `user` and application fields must stay synchronized, and define whether regulated changes create a review request.

Current retailer profile mutations use `shopOwnerProcedure`, which requires the platform role exactly `shop_owner` ([`api/index.ts:113-129`](../packages/api/src/index.ts#L113)). The UI route is additionally owner-only through the `shop_settings` resource and dashboard permission guard ([`shop-permission-catalog.ts:65-82`](../packages/auth/src/shop-permission-catalog.ts#L65), [`shop-permission-catalog.ts:484-493`](../packages/auth/src/shop-permission-catalog.ts#L484), [`shop-permission-guard.tsx:15-44`](../apps/web/components/dashboard/shop-permission-guard.tsx#L15)). A child `/dashboard/settings/profile` route inherits the existing prefix-based route match ([`shop-permissions.ts:136-167`](../packages/auth/src/shop-permissions.ts#L136)).

Warehouse parity is not currently implementation-ready: its settings page reads only a few session fields and has no edit UI ([`warehouse/settings/page.tsx:6-62`](../apps/web/app/warehouse/%28management%29/dashboard/settings/page.tsx#L6)), and no warehouse equivalents of the retailer post-approval business/contact mutations were found. The role-neutral presentation should support warehouse data now, but warehouse self-editing should be a separately scoped API task unless explicitly included.

## 6. Recommended full-page UI

### `/dashboard/settings/profile` — view

- Back to General Settings, page title **Registration Profile**, application/KYC badges, `Edit profile` action.
- Owner-safe hero based on the admin profile hero.
- Tabs or anchored sections: **Basic Information**, **Documents**, **Social & Contact**, **Banking & Payment Accounts**.
- Two-column main content plus sticky metadata sidebar on desktop; single column on mobile.
- Sidebar: registration ID/status/completion, submitted/reviewed dates, historical selected plan, and actual subscription summary/link. Keep the two plan concepts labeled distinctly.

### `/dashboard/settings/profile/edit` — edit

- One full-page form initialized from the normalized owner profile query.
- Same section order as the view page so users retain context.
- Sticky footer actions: **Cancel** and **Save profile**; show field-level server errors and an unsaved-changes warning.
- Uploads and map pickers appear inline, not in nested dialogs. The existing `LocationPickerSection` can be reused; registration section/label/review primitives are already shareable ([`registration-primitives.tsx:148-252`](../apps/web/components/features/onboarding/registration-primitives.tsx#L148)).
- Operational payment accounts can use the existing query/mutations and row presentation from `FinancialSettingsSection`, but its dialog editor should be refactored into an inline editor for this page ([`financial-settings-section.tsx:60-129`](../apps/web/components/features/settings/financial-settings-section.tsx#L60), [`financial-settings-section.tsx:213-333`](../apps/web/components/features/settings/financial-settings-section.tsx#L213)).

## 7. Safe implementation sequence

1. Extract the admin registration detail view model and read-only sections into a role-neutral module; add `thana`, Messenger, Telegram, and the actual trade-license field.
2. Add the owner-safe aggregate profile query and build `/dashboard/settings/profile` from those shared sections.
3. Build the full-page edit route and replace the logo/business/contact dialog triggers with links.
4. Add narrowly scoped mutations for missing field groups, server validation, synchronization, and review/KYC-reset rules. Do not reuse the pending-application update endpoint.
5. Add the Business payment accounts section with the existing finance APIs, preserving its separate source of truth and `shop_accounts` authorization.
6. Reduce `/dashboard/settings` to a settings overview/general controls and remove duplicated profile cards/forms.
7. Test owner authorization, missing registration handling, user/application synchronization, optional/empty fields, account-number masking, document replacement/KYC state, mobile responsiveness, and direct API attempts by non-owners.

