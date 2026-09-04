# Retailer User Management, Role Editor, and Control Settings

**Research date:** 2026-09-04  
**Scope:** retailer/shop portal only; current repository plus official Better Auth Admin documentation; no application behavior changed.

## Executive decision

The requested information architecture is a good correction to the current screen. `/dashboard/user-roles` presently mixes staff creation, staff assignment, named-role administration, and the full page/action matrix in one route. It should become the retailer's **User Management** hub, while the existing role editor moves to a child route opened from a clear **Manage roles & permissions** link and from each applicable role name.

Recommended route split:

```text
/dashboard/user-roles
├── user directory + Add New User
├── approval controls
├── order controls
├── /permissions?role=<roleId>   named-role/page/action editor
└── /[id]                       staff profile
```

The controls must not be shipped as functioning toggles until their persistence and server-side workflows exist. At present, all six requested settings are either absent or only partially represented by a different domain feature.

The current hybrid authorization design should remain: Better Auth owns authentication, the platform role, user creation, and the typed resource/action vocabulary; the shop-scoped role and its grants are stored in Bikalpo tables. Better Auth's Admin documentation defines roles by passing a role map to the plugin at application configuration time, while Bikalpo needs retailer-defined role names per shop at runtime. The existing implementation already uses Better Auth's access-control engine to validate/authorize database-backed grants, so the Organization plugin is not required for this route split ([Better Auth Admin — Access Control](https://better-auth.com/docs/plugins/admin#access-control), [`permissions.ts:1-21`](../packages/auth/src/permissions.ts#L1), [`shop-permissions.ts:81-127`](../packages/auth/src/shop-permissions.ts#L81)).

## 1. Current staff and role behavior

### User directory and creation

The API already has enough real data for the requested directory:

- `shopStaff.list` is shop-owner-only and returns the owner followed by the owner's `shop_staff` and `deliveryman` accounts ([`shop-staff.ts:197-223`](../packages/api/src/routers/shop-staff.ts#L197)).
- Each presented member includes ID, name, email, phone, platform role, function-derived label/access level, status, creation date, and optional service area ([`shop-staff.ts:71-105`](../packages/api/src/routers/shop-staff.ts#L71)).
- Staff creation accepts either a named `roleId` or the legacy `shopFunction`, creates the account through Better Auth's Admin `createUser`, then attaches it to the owner and inserts the named-role assignment ([`shop-staff.ts:243-339`](../packages/api/src/routers/shop-staff.ts#L243)). Better Auth documents `createUser` as an Admin-plugin operation supporting name, email, password, platform role, and additional data ([official Admin documentation](https://better-auth.com/docs/plugins/admin#create-user)).
- The server already exposes owner-scoped update, password-reset, ban/unban, and removal operations ([`shop-staff.ts:417-560`](../packages/api/src/routers/shop-staff.ts#L417)). The web hook layer currently exposes only list, get, create, and legacy function assignment, so those additional server operations are not yet usable in the profile UI ([`use-shop-staff-api.ts:61-104`](../apps/web/hooks/use-shop-staff-api.ts#L61)).

The current `/dashboard/user-roles` screen does fetch users, but only renders `shop_staff` inside a role-assignment table; it filters out the owner and delivery staff and provides no **View** profile link ([`user-roles/page.tsx:415-476`](../apps/web/app/shop/(management)/dashboard/user-roles/page.tsx#L415)). The new main directory should render the entire `members` result rather than that filtered subset.

The requested `USR-001`-style identifier does not exist. The current profile derives a display ID by uppercasing the last eight characters of the Better Auth user ID ([`user-roles/[id]/page.tsx:25-27`](../apps/web/app/shop/(management)/dashboard/user-roles/[id]/page.tsx#L25)). Use that stable short ID initially, or add a persisted shop-scoped staff code if sequential `USR-001` identifiers are a real requirement; do not derive a sequence from row order.

### Named roles and granular permissions

The granular role foundation is already implemented:

- `shop_role` stores a named role per shop; `shop_role_permission` stores resource/action arrays; `shop_user_role` gives one role to each staff member; `shop_permission_audit` records changes ([`shop-role.ts:17-113`](../packages/db/src/schema/shop-role.ts#L17)).
- The role API lists roles, grants, member counts, and member IDs, and supports create, update, guarded delete, and assignment ([`shop-role.ts:67-105`](../packages/api/src/routers/shop-role.ts#L67), [`shop-role.ts:137-317`](../packages/api/src/routers/shop-role.ts#L137)).
- The catalog is developer-controlled: it declares valid actions, resources, modules, page labels, paths, and supported actions. Retailer roles can select only catalog entries, and settings/staff/system-control resources remain owner-only ([`shop-permission-catalog.ts:1-82`](../packages/auth/src/shop-permission-catalog.ts#L1), [`shop-role.ts:34-52`](../packages/api/src/routers/shop-role.ts#L34)).
- Four editable system roles are lazily created from the legacy Shop Administrator, Purchase Manager, Sales Agent, and Inventory Manager presets; Delivery remains a separate portal/platform role and is deliberately excluded ([`shop-role-store.ts:19-24`](../packages/api/src/shop-role-store.ts#L19), [`shop-role-store.ts:34-107`](../packages/api/src/shop-role-store.ts#L34)).

The current page/action matrix and role CRUD occupy the top of `/dashboard/user-roles` ([`user-roles/page.tsx:209-413`](../apps/web/app/shop/(management)/dashboard/user-roles/page.tsx#L209)), while Add Staff is another dialog on the same route ([`user-roles/page.tsx:541-548`](../apps/web/app/shop/(management)/dashboard/user-roles/page.tsx#L541)). Moving the matrix intact to `/dashboard/user-roles/permissions` separates the two jobs without changing the role API.

There is one compatibility gap to fix during the split: `/dashboard/user-roles/[id]` still assigns the old fixed `shopFunction`, not a named `shop_role` ([`user-roles/[id]/page.tsx:90-131`](../apps/web/app/shop/(management)/dashboard/user-roles/[id]/page.tsx#L90)). Its role selector should use `shopRole.assign`. The directory/profile response should also expose the assigned named role directly; today a custom role is presented only as `Custom Role` because presentation derives its label from `user.shopFunction` ([`shop-staff-access.ts:180-224`](../packages/auth/src/shop-staff-access.ts#L180)).

### Current page protection

The split can remain under the existing owner-only authorization resource:

- The permission catalog maps `/dashboard/user-roles` to `shop_staff`; path matching is prefix-based, so its child paths use the same resource ([`shop-permission-catalog.ts:495-501`](../packages/auth/src/shop-permission-catalog.ts#L495), [`shop-permissions.ts:136-167`](../packages/auth/src/shop-permissions.ts#L136)).
- `shop_staff`, `shop_settings`, and `shop_system_control` are excluded from assignable staff roles, and all role-management API procedures require the actual shop owner ([`shop-permission-catalog.ts:78-82`](../packages/auth/src/shop-permission-catalog.ts#L78), [`shop-role.ts:107-142`](../packages/api/src/routers/shop-role.ts#L107)).
- The dashboard layout wraps every page in a direct-path permission guard, while API procedures can enforce the same resource/action grants server-side ([`dashboard/layout.tsx:20-27`](../apps/web/app/shop/(management)/dashboard/layout.tsx#L20), [`shop-permission-guard.tsx:15-44`](../apps/web/components/dashboard/shop-permission-guard.tsx#L15), [`api/index.ts:173-193`](../packages/api/src/index.ts#L173)).

## 2. Approval controls: current reality

No database setting or API currently persists `expense approval`, `discount approval`, `stock adjustment approval`, or `return approval`. The existing `/dashboard/system-control` route is only a Coming Soon placeholder ([`system-control/page.tsx:3-20`](../apps/web/app/shop/(management)/dashboard/system-control/page.tsx#L3)). The permission catalog describes that page as “Approval and order controls,” confirming that it was the intended future home, but no behavior is behind it ([`shop-permission-catalog.ts:502-508`](../packages/auth/src/shop-permission-catalog.ts#L502)).

| Requested control | What exists now | What must be built before the toggle is real |
| --- | --- | --- |
| Expense approval ON + amount threshold | An expense is explicitly modeled as immediately paid with no pending state, and create immediately inserts its ledger debit ([`expense.ts:33-38`](../packages/db/src/schema/expense.ts#L33), [`expense.ts:77-91`](../packages/db/src/schema/expense.ts#L77), [`expense.ts:103-136`](../packages/api/src/routers/expense.ts#L103)). | Add draft/submitted/approved/rejected state and an approval endpoint; delay the ledger write until approval. This changes the current expense invariant and needs a product decision, not merely a settings row. |
| Discount approval ON + percent threshold | Retailer POS accepts a fixed or percentage discount, computes it immediately, and completes the sale while deducting stock; there is no pending sale status ([`owner-pos.ts:26-45`](../packages/api/src/services/owner-pos.ts#L26), [`retailer-pos.ts:704-791`](../packages/api/src/routers/retailer-pos.ts#L704), [`warehouse-pos.ts:40-43`](../packages/db/src/schema/warehouse-pos.ts#L40)). | Define whether only manual discounts are governed (recommended; automatic promotions should remain separate), add pending/manager-approval behavior or an authorized override, and enforce the threshold server-side before stock/payment mutation. The warehouse-salesman estimate's hard-coded `> 5%` pending rule is a different portal workflow, not a retailer-shop setting ([`salesman.ts:1112-1118`](../packages/api/src/routers/salesman.ts#L1112)). |
| Stock adjustment approval ON | The enum contains `draft/submitted/approved/rejected`, but shop adjustments are always inserted as `submitted` and update inventory in the same transaction ([`stock-adjustment.ts:37-42`](../packages/db/src/schema/stock-adjustment.ts#L37), [`shop-owner.ts:11600-11634`](../packages/api/src/routers/shop-owner.ts#L11600), [`shop-owner.ts:11722-11774`](../packages/api/src/routers/shop-owner.ts#L11722)). | When enabled, submission must not mutate inventory. Add an approve/reject endpoint requiring `shop_stock_adjustment:approve`; approval must revalidate the stock snapshot before applying. |
| Return approval ON | Return requests already start `pending`, but processing is restricted to the platform `admin`; approval sets `processed` and optionally restocks/refunds ([`returns.ts:368-388`](../packages/api/src/routers/returns.ts#L368), [`returns.ts:390-438`](../packages/api/src/routers/returns.ts#L390), [`returns.ts:440-543`](../packages/api/src/routers/returns.ts#L440)). | Add a shop-scoped return resource and owner/authorized-manager process endpoint. Define OFF semantics (immediate processing versus no second approver) and keep refund/restock tenant-scoped. |

The role catalog is partly ready for approval separation: expenses and stock adjustments already declare an `approve` action, but POS has no approve action and there is no retailer-return resource ([`shop-permission-catalog.ts:25-38`](../packages/auth/src/shop-permission-catalog.ts#L25), [`shop-permission-catalog.ts:31-34`](../packages/auth/src/shop-permission-catalog.ts#L31)). Before enabling discount/return controls, add explicit catalog resources/actions and bind their server mutations to them.

## 3. Order controls: current reality

The requested order controls are shop-wide, but the current minimum-quantity rule is product/variant-specific:

- A product stores `minimumOrderEnabled` and `minimumOrderQty`, and a generated variant stores the resulting `orderMin` ([`product.ts:138-149`](../packages/db/src/schema/product.ts#L138), [`product-variant.ts:94-102`](../packages/db/src/schema/product-variant.ts#L94)).
- Retailer cart validation enforces each variant's minimum, maximum, and increment ([`retailer-cart-inventory.ts:239-257`](../packages/api/src/routers/helpers/retailer-cart-inventory.ts#L239)).

There is no shop-wide minimum order amount in `checkout_setting`; that owner row currently stores delivery modes, deposit permission, shipping fee, tax, and wholesale credit days ([`checkout-setting.ts:11-35`](../packages/db/src/schema/checkout-setting.ts#L11)). `offer_template.minimumOrderAmount` belongs to offer eligibility, not general retailer checkout policy ([`offer-template.ts:60-75`](../packages/db/src/schema/offer-template.ts#L60)).

Before implementing “Minimum Order Quantity ≥ 10 Units,” product must choose one meaning:

1. **Per line:** it overlaps the existing variant `orderMin`; a shop default would need a precedence rule such as `max(shop minimum, variant minimum)`.
2. **Whole order:** it is a new total-unit rule and must define how unlike units (pieces, kilograms, cylinders, packs) can be summed. A raw sum is unsafe across mixed units.

“Minimum Order Amount ≥ ৳2,000” is unambiguous and can extend `checkout_setting`. It must be checked both while quoting and during final order submission so a caller cannot bypass the page. The existing checkout configuration loader is the natural read seam ([`customer.ts:567-578`](../packages/api/src/routers/customer.ts#L567)), and the current quote path already loads that configuration before building totals ([`customer.ts:3147-3189`](../packages/api/src/routers/customer.ts#L3147)).

## 4. Implemented versus missing

| Area | Already implemented | Still required |
| --- | --- | --- |
| User directory | Owner-scoped list, profile lookup, create, update, reset password, ban/unban, remove | New main table; expose all API mutations in hooks/profile; search/pagination if staff count warrants it |
| Named role assignment | One shop role per `shop_staff`, assignment API, member IDs in role list | Return named role in staff DTO; replace legacy profile selector; define delivery-account treatment |
| Role editor | Role CRUD, page/action catalog, matrix, audit records, default-role migration | Move UI to child route; link from header and role cells; preserve query-selected role |
| Page/API authorization | Catalog, direct-path guard, sidebar filtering, exact procedure helpers | Continue replacing coarse module-only procedures where action-level enforcement matters |
| Approval settings | Permission verbs for expense and stock only | Settings persistence, validation, audit, and four real state machines/enforcement paths |
| Order settings | Per-product/per-variant quantity minimum | Define shop-wide quantity semantics; persist and enforce minimum amount/quantity |

## 5. Recommended UI composition

### `/dashboard/user-roles` — User Management

1. Header: **User Management**, helper text, **Add New User**, and secondary **Manage roles & permissions** link.
2. Directory columns: stable display ID, user name, named role, access summary, status, and **View**.
3. Role names for `shop_staff` link to `/dashboard/user-roles/permissions?role=<id>`. Owner shows “Super Admin / Full Control.” Delivery accounts show “Delivery / Delivery portal” and should not link to the shop-role matrix because the current model routes them outside the shop dashboard.
4. **View** links to the existing `/dashboard/user-roles/[id]` profile.
5. Approval Controls and Order Controls appear below the directory, matching the client document. Until their server contracts exist, render them disabled with an honest “Not configured” state rather than persisting browser-only values.

### `/dashboard/user-roles/permissions` — Roles & Permissions

Move the existing role list, role name/description editor, page/action matrix, create-role dialog, and delete/save actions here. Move staff assignment out of this screen: assignment belongs in Add User and User Profile. A query-string role selection allows a clicked directory role to open focused without making role IDs part of the route.

### `/dashboard/user-roles/[id]` — User Profile

Retain the profile route, replace the legacy function selector with named roles, and expose the existing update/reset/ban/remove API actions. Keep owner safeguards already enforced by the API. Show the assigned role and its access summary from the server rather than reconstructing `Custom Role` in the client.

### Existing `/dashboard/system-control`

Avoid two editable copies of the same controls. If the client requires the controls on User Management, redirect `/dashboard/system-control` to `/dashboard/user-roles#operational-controls` or make it a non-editable navigation alias. The Settings page currently links separately to both routes ([`settings/page.tsx:295-306`](../apps/web/app/shop/(management)/dashboard/settings/page.tsx#L295)), so navigation must be updated with the split.

## 6. Safe implementation sequence

1. Split the current UI and preserve all existing role APIs; this is a routing/component extraction only.
2. Upgrade the directory/profile DTO to include assigned named-role metadata, and expose existing user-management mutations in web hooks.
3. Add one owner-scoped settings contract with validation and an audit trail. Defaults should preserve today's behavior: expense approval OFF, discount approval OFF, stock approval OFF, return approval ON (because returns currently pend), and order minimums OFF.
4. Implement each workflow before enabling its corresponding control. Stock and returns are the closest to existing state models; expense is the largest domain change.
5. Add checkout enforcement for order amount and the chosen quantity interpretation at both quote and submit seams.
6. Add integration tests proving that direct API calls cannot bypass an enabled control, plus permission tests proving only authorized approvers can transition pending work.

## Primary sources

- [Better Auth Admin plugin](https://better-auth.com/docs/plugins/admin)
- Repository source files linked inline above.

