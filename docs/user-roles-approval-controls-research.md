# Shop/Warehouse User Roles, Permissions, and Approval Controls

## Scope

This note inventories first-party sources for the proposed shop and warehouse **User Roles** page (`/dashboard/user-roles`). It covers:

1. **User management** — a staff table (User ID, User Name, Role, Access Level, View) plus Add New User, using Better Auth Admin plugin APIs and access control.
2. **Approval control settings** — on/off (and threshold) switches for expense, discount, stock-adjustment, and sales-return approval.
3. **Order control settings** — shop-wide minimum order quantity and minimum order amount.

It compares the wireframe to this repo’s existing Better Auth role model, staff-creation APIs, expense/discount/stock/return flows, and product-level minimum-order fields. Industry usage is taken from official Odoo 19 and ERPNext/Frappe docs, not secondary blogs. It does **not** implement application code.

## Executive finding

The page cannot be built as a thin Better Auth Admin UI over `user.role`. This platform already uses Better Auth `user.role` as **account type and portal routing** (`consumer` / `shop_owner` / `warehouse` / `salesman` / `deliveryman` / `admin`). The wireframe’s Super Admin / Purchase Mgr / Sales Agent labels are **shop-internal job titles**. Putting those strings onto `user.role` would collide with middleware, ORPC procedures, and subdomain routing.

**Recommendation (not a Better Auth requirement):** keep platform `user.role` as account type. Use Admin plugin `createUser` as the existing user factory, scoped by `shopId` / `warehouseId`. Do **not** add `shop_owner` or `warehouse` to `adminRoles`. Do **not** call unscoped `listUsers`. Put shop-module permissions in a separate statement set (or, later, Organization `member.role`). Approval and shop-wide order-control switches have **no settings table today**; expense is paid-on-create with no pending state; salesman estimates already hardcode `discountPercent > 5` → pending (not a store setting); stock adjustment has a status enum but submit already applies inventory; returns already have pending/approve/reject but only platform `admin` can process them; minimum order is **per product/variant**, not shop-wide.

## Requested page vs current UI

| Surface | Current state | Source |
| --- | --- | --- |
| Shop `/dashboard/user-roles` | Coming Soon placeholder | `apps/web/app/shop/(management)/dashboard/user-roles/page.tsx:1-21` |
| Warehouse twin | Coming Soon placeholder | `apps/web/app/warehouse/(management)/dashboard/user-roles/page.tsx:1-21` |
| Shop settings nav | Link labeled **Roles and permissions** already points at `/dashboard/user-roles` | `apps/web/app/shop/(management)/dashboard/settings/page.tsx:295-300` |
| Shop sidebar | User Roles child of Settings | `apps/web/components/dashboard/shop-owner-sidebar.tsx:312` |
| Warehouse sidebar | User Roles item | `apps/web/components/dashboard/warehouse-sidebar.tsx:337` |
| Shop System Control | Separate Coming Soon page; not an approval-settings store | `apps/web/app/shop/(management)/dashboard/system-control/page.tsx:1-23` |
| Staff profile / View | No shop/warehouse staff profile route exists for this page | — |

Staff already exist on other pages, not on User Roles:

- Warehouse lists salesmen and deliverymen by `user.warehouseId` (`packages/api/src/routers/warehouse-employee.ts:249-295`).
- Shop lists only retailer deliverymen by `user.shopId` (`packages/api/src/routers/shop-owner.ts:7281-7334`).
- Platform admin lists global salesman/deliveryman employees with **no** shop/warehouse link on create (`packages/api/src/routers/employee.ts:47-133`).

## Better Auth: Admin plugin capabilities (official docs)

Catalog pin is `better-auth: ^1.4.18` (`pnpm-workspace.yaml:19`). The lockfile resolves the installed package to **1.5.5** (`pnpm-lock.yaml` `better-auth@1.5.5`). Docs cited below were fetched from the current public Better Auth site on 2026-09-03.

### Documented admin APIs

All of the following exist in the official Admin plugin docs ([https://www.better-auth.com/docs/plugins/admin](https://www.better-auth.com/docs/plugins/admin)):

| API | Endpoint | Client | Server |
| --- | --- | --- | --- |
| Create user | `POST /admin/create-user` | `authClient.admin.createUser` | `auth.api.createUser` |
| List users | `GET /admin/list-users` | `authClient.admin.listUsers` | `auth.api.listUsers` |
| Get user | `GET /admin/get-user` | `authClient.admin.getUser` | `auth.api.getUser` |
| Set role | `POST /admin/set-role` | `authClient.admin.setRole` | `auth.api.setRole` |
| Set password | `POST /admin/set-user-password` | `authClient.admin.setUserPassword` | `auth.api.setUserPassword` |
| Update user | `POST /admin/update-user` | `authClient.admin.updateUser` | `auth.api.adminUpdateUser` |
| Ban / unban | `POST /admin/ban-user`, `/admin/unban-user` | `banUser` / `unbanUser` | same |
| Impersonate / stop | `POST /admin/impersonate-user`, `/admin/stop-impersonating` | `impersonateUser` / `stopImpersonating` | same |
| Remove user | `POST /admin/remove-user` | `authClient.admin.removeUser` | `auth.api.removeUser` |
| Sessions | list / revoke / revoke-all | documented | documented |
| Has permission | `POST /admin/has-permission` | `authClient.admin.hasPermission` | `auth.api.userHasPermission` |

`createUser.role` accepts `string | string[]`. `setRole.role` also accepts `string | string[]`. `listUsers` is a **global** user listing (search, filter, pagination over the user table). It is not shop-scoped.

**Invitation:** the Admin plugin docs do not define an invite/accept flow. Organization plugin does (`inviteMember` / `createInvitation`, [https://www.better-auth.com/docs/plugins/organization#invitations](https://www.better-auth.com/docs/plugins/organization#invitations)).

### Access control (documented facts)

- Default admin-plugin roles are `admin` (full user control) and `user` (none) ([Admin — Roles](https://www.better-auth.com/docs/plugins/admin#roles)).
- **Multiple roles per user are supported.** They are stored as a comma-separated string ([Admin — Roles](https://www.better-auth.com/docs/plugins/admin#roles): “A user can have multiple roles. Multiple roles are stored as string separated by comma (",").”).
- Default statements: resource `user` with actions `create`, `list`, `set-role`, `ban`, `impersonate`, `impersonate-admins`, `delete`, `set-password`, `set-email`, `get`, `update`; resource `session` with `list`, `revoke`, `delete` ([Admin — Permissions](https://www.better-auth.com/docs/plugins/admin#permissions)).
- Custom statements use `createAccessControl` + `ac.newRole`. Custom roles that should keep admin user-management rights must merge `defaultStatements` and `adminAc.statements` from `better-auth/plugins/admin/access` ([Admin — Custom Permissions](https://www.better-auth.com/docs/plugins/admin#custom-permissions)).
- Client plugin must receive the same `ac` and `roles` for `checkRolePermission` ([Admin — Pass Roles to the Plugin](https://www.better-auth.com/docs/plugins/admin#pass-roles-to-the-plugin)). This repo’s client does **not** pass them (`apps/web/lib/auth-client.ts:13`).
- Permission checks: client `hasPermission`; server `userHasPermission` (optional `userId` or `role`) ([Admin — Access Control Usage](https://www.better-auth.com/docs/plugins/admin#access-control-usage)).

### `adminRoles` vs custom access control

Documented default: `adminRoles: ["admin"]` ([Admin — Admin Roles](https://www.better-auth.com/docs/plugins/admin#admin-roles)).

The same section states: when custom access control (`ac` + `roles`) is used, `adminRoles` is **not required**; each custom role has exactly the permissions granted through statements. Warning: without custom AC, any role not in `adminRoles` cannot perform admin operations.

This repo **does** use custom AC (`packages/auth/src/index.ts:65-76`, `packages/auth/src/permissions.ts:8-19`). Only the `admin` role spreads `...adminAc.statements` (`packages/auth/src/permissions.ts:80-89`). `shop_owner`, `warehouse`, `salesman`, and `deliveryman` get **no** `user`/`session` admin statements. Therefore a shop owner calling Admin APIs with their session should not have `user:create` / `user:list` / `user:set-role` unless those statements are added.

**Recommendation:** do not add `shop_owner` or `warehouse` to `adminRoles`. That would treat them as platform admins for Admin plugin operations. `listUsers` has no built-in shop filter; granting it would expose every consumer, warehouse, and other shop on the platform.

### Server-side `createUser` without a session

Official usage docs say admin operations require an admin account or `adminUserIds` ([Admin — Usage](https://www.better-auth.com/docs/plugins/admin#usage)). This repo already calls `auth.api.createUser` **without headers** from warehouse, shop-owner, and platform-admin employee routers (`packages/api/src/routers/warehouse-employee.ts:889-899`, `packages/api/src/routers/shop-owner.ts:7551-7559`, `packages/api/src/routers/employee.ts:101-111`). Warehouse `removeUser` **does** pass the caller’s bearer token (`packages/api/src/routers/warehouse-employee.ts:993-998`).

Better Auth GitHub issue [#3717](https://github.com/better-auth/better-auth/issues/3717) (v1.3.4 era) stated that `createUser` was the main admin API callable without a session. PR [#4385](https://github.com/better-auth/better-auth/pull/4385) later bypasses session/permission checks for in-server calls (`ctx.request === undefined`) while still enforcing them on HTTP. **I did not fetch the 1.5.5 `admin.ts` source from this machine’s `node_modules`** (package not present at the workspace root glob). Treat the current no-header `createUser` pattern as an existing repo fact, not as a documented shop-owner privilege. If a future Better Auth version requires a session for `createUser`, those routers will break unless `shop_owner`/`warehouse` are given `user:create` **and** list/ban/delete remain withheld.

## Better Auth vs this repo's current role model (collision analysis)

### What `user.role` actually is here

Schema: `role` defaults to `"consumer"`; Admin plugin also stores `banned`, `banReason`, `banExpires`; session has `impersonatedBy` (`packages/db/src/schema/auth-schema.ts:21-25`, `packages/db/src/schema/auth-schema.ts:93-94`). Staff parent links: `warehouseId` for warehouse employees, `shopId` for retailer delivery staff (`packages/db/src/schema/auth-schema.ts:64-67`).

Registered Admin roles (`packages/auth/src/index.ts:65-76`, `packages/auth/src/permissions.ts`):

| Role | Meaning in this repo | Portal / procedure |
| --- | --- | --- |
| `consumer` | Default signup; B2C customer | Public store; `consumerProcedure` (`packages/api/src/index.ts:24-39`) |
| `shop_owner` | Approved retail/restaurant business account | Shop subdomain; `shopOwnerProcedure` exact equality (`packages/api/src/index.ts:97-113`) |
| `warehouse` | Wholesale supply account | Warehouse subdomain; `warehouseProcedure` (`packages/api/src/index.ts:115-131`) |
| `salesman` | Field sales employee | Sales subdomain (`apps/web/proxy.ts:411-417`); `salesmanProcedure` |
| `deliveryman` | Delivery rider | Delivery/dashboard routes; `deliverymanProcedure` |
| `admin` | Platform Super Seller | Admin dashboard; `adminProcedure`; only role with `adminAc.statements` |

Proxy routing uses **exact string match** on the `user-role` cookie (`apps/web/proxy.ts:397-503`). Login redirects the same way (`apps/web/app/(auth)/login/client.tsx` and `apps/web/components/features/auth/phone-auth-flow.tsx`). After sign-in the cookie is set from `user.role` (`packages/auth/src/index.ts:301-316`).

Current permission statements are marketplace resources, not shop departments: `order`, `product`, `delivery`, `estimate`, `shop`, `inventory`, `seller_application` (`packages/auth/src/permissions.ts:8-17`). Nothing named purchase-manager, expense, discount, stock-adjustment, or return-approval exists.

### Collision if the wireframe roles are written onto `user.role`

| Wireframe label | If stored as `user.role` | What breaks |
| --- | --- | --- |
| Super Admin | Would be a new string, or overloaded `admin` | Platform `admin` is Super Seller. Shop “super admin” is not a platform operator. `adminProcedure` and admin dashboards would open for a shop clerk if the string is `admin`. |
| Admin | Collides with platform `admin` | Same. |
| Purchase Mgr | New string | `shopOwnerProcedure` / warehouse procedures would 403; proxy would not send them to shop/warehouse portals. |
| Sales Agent | Tempting to reuse `salesman` | `salesman` is already a **platform employee type** routed to the sales subdomain (`apps/web/proxy.ts:411-417`). A shop-internal sales clerk is not a warehouse field salesman. |
| Delivery | Closest existing: `deliveryman` | Reuse is valid **as account type**, not as a shop-module access-level label. |
| Warehouse | Collides with portal account `warehouse` | A shop inventory clerk must not become a warehouse-portal account. |

**Documented multiple-role storage does not save this.** If Better Auth stored `"shop_owner,purchase_mgr"`, this repo’s `context.session.user.role !== "shop_owner"` checks would fail (`packages/api/src/index.ts:102`), and `staffRoles.includes(role)` would fail (`apps/web/proxy.ts:477-484`).

**Recommendation:** do not overload platform `user.role` with Purchase Mgr / Super Admin / Sales Agent.

### Does Organization plugin fit shop-scoped staff better?

Official Organization plugin ([https://www.better-auth.com/docs/plugins/organization](https://www.better-auth.com/docs/plugins/organization)):

- Adds tables `organization`, `member`, `invitation`, plus `session.activeOrganizationId` (and team tables if enabled) ([Organization — Schema](https://www.better-auth.com/docs/plugins/organization#schema)).
- Default org roles: `owner`, `admin`, `member`. Org **admin** is not the platform Admin plugin `admin`.
- **Member role is on the membership, not `user.role`.** `updateMemberRole` / `inviteMember` take org roles (`admin` / `member` / `owner` or custom). Multiple org roles are also comma-separated ([Organization — Roles](https://www.better-auth.com/docs/plugins/organization#roles)).
- Custom org statements are a **separate** access-control instance, imported from `better-auth/plugins/organization/access`, not from `better-auth/plugins/admin/access`.
- Invitations: `sendInvitationEmail` + `inviteMember` / `acceptInvitation`.
- `listMembers` is organization-scoped, unlike Admin `listUsers`.

**Facts about this repo:** Organization plugin is **not** installed. `packages/auth/src/index.ts` plugins are expo, bearer, openAPI, admin, phoneNumber only. No `organization(` usage under `packages/`. Shop identity is the **shop_owner user row** (`shopName`, `shopSlug`, `shopId` FK to `user.id`), not an `organization` row.

**Recommendation:** Organization is the Better Auth feature that actually separates “account type” from “role inside this shop.” It is the clean long-term fit **if** each shop_owner/warehouse account is mapped to an organization and staff become members. That is a schema + session (`activeOrganizationId`) + migration project, not a drop-in for the Coming Soon page. Until then, `shopId`/`warehouseId` already provide tenancy; adding Organization without that mapping would create a second source of truth.

### Can Admin plugin still do user CRUD while shop permissions are a separate statement set?

**Yes, with constraints (recommendation grounded in docs + this schema):**

1. **Create account:** keep using `auth.api.createUser` as a factory (already done), then set `shopId` or `warehouseId`. Platform `role` should remain an account type (`deliveryman`, and only `salesman` when the person is truly a sales-portal employee).
2. **List / View:** do **not** use Admin `listUsers` for the shop table. Filter `user` by `shopId` or `warehouseId`, as `warehouseEmployee.getAll` and `getRetailDeliverymen` already do.
3. **Set shop job title / module access:** do **not** use Admin `setRole` for Purchase Mgr. That API writes `user.role`. Use a separate field or Organization `member.role`.
4. **Ban / password / delete:** existing shop/warehouse employee routers already wrap these with owner-scoped WHERE clauses. Keep that wrapper. Do not expose raw Admin client calls from the shop UI.
5. **Impersonate:** documented Admin-only; shop owners should not receive `user:impersonate`.
6. **Shop module permissions:** add statements (`expense`, `stock_adjustment`, `returns`, `discount`, `purchase`, …) on a **staff-role** controller. That can be (a) a second `createAccessControl` used only in ORPC, (b) Organization plugin AC after orgs exist, or (c) extra statements on the Admin AC **without** assigning those role names as `user.role`. Option (c) still collides if the role name is stored in `user.role`.

## Recommended permission model for shop-internal staff

**Recommendation**, not a Better Auth mandate:

1. Keep `user.role` ∈ `{consumer, shop_owner, admin, salesman, deliveryman, warehouse}`.
2. Treat the shop_owner / warehouse user as the tenant owner (Full Control). Do not create a second “Super Admin” platform role for them.
3. Staff rows remain `user` records with `shopId` or `warehouseId`.
4. Add an explicit staff-function field (e.g. `staffRole` or Organization `member.role`) with values such as `shop_admin`, `purchase_manager`, `sales_agent`, `delivery`, `inventory` — **strings that are not** `admin`, `warehouse`, or `salesman` unless the person is actually that platform account.
5. Map wireframe **Access Level** to permission bundles on that staff role (Full Control, Purchase, Sales, Delivery, Inventory), not to `user.role`.
6. Pass custom `ac`/`roles` into `adminClient()` only for platform Admin UI. Shop User Roles UI should call **owner-scoped ORPC**, not `authClient.admin.listUsers`.
7. Defer Organization plugin until there is a decision to model each shop/warehouse as an `organization`. If adopted, keep Admin plugin for platform operators and Organization AC for shop members.

## User management: option-by-option map

| Requested UI | Real source available now | Recommendation |
| --- | --- | --- |
| Table of shop staff | Shop: only `role = deliveryman` AND `shopId = owner` (`packages/api/src/routers/shop-owner.ts:7281-7303`). No shop salesmen, purchase managers, or shop admins. | Render real riders only. Do not invent Super Admin / Purchase Mgr rows. Warehouse twin can list salesman + deliveryman (`packages/api/src/routers/warehouse-employee.ts:261-277`). |
| User ID | `user.id` (Better Auth text id) (`packages/db/src/schema/auth-schema.ts:5`) | Show stored id. Do not invent `USR-0001`. |
| User Name | `user.name` | Available. |
| Role (Super Admin / Admin / Purchase Mgr / Sales Agent / Delivery / Warehouse) | Platform roles only. Delivery ≈ `deliveryman`. Sales Agent ≠ shop clerk (`salesman` is a portal). Warehouse ≠ shop department. Super Admin/Admin/Purchase Mgr **do not exist**. | Label existing `deliveryman` as Delivery. Do not map shop owner to “Super Admin” as a second user row; the signed-in owner is the tenant. New job titles need a new field. |
| Access Level (Full Control / All Modules / Purchase / Sales / Delivery / Inventory) | No schema field. Permission statements are marketplace resources (`packages/auth/src/permissions.ts:8-17`). | Omit or derive from the new staff-role bundle. Do not hardcode “Full Control” for every row. |
| View → User Profile | No staff profile page under shop/warehouse user-roles. Shop delivery has `getRetailDeliverymanById` (`packages/api/src/routers/shop-owner.ts:7336+`). | View can open existing delivery-team detail for riders; other roles have no profile until built. |
| + Add New User | Shop: `createRetailDeliveryman` via `auth.api.createUser` + `shopId` (`packages/api/src/routers/shop-owner.ts:7532-7583`). Warehouse: salesman or deliveryman (`packages/api/src/routers/warehouse-employee.ts:876-927`). | Reuse those factories. Do not call client `admin.createUser` from the shop browser. Adding Purchase Mgr requires a new role/field and must not set `user.role = "admin"`. |
| Better Auth Admin `listUsers` | Exists globally ([docs](https://www.better-auth.com/docs/plugins/admin#list-users)) | **Do not use** for this table. |
| Better Auth `setRole` | Writes `user.role` ([docs](https://www.better-auth.com/docs/plugins/admin#set-user-role)) | Do not use for shop job titles. Platform admin already has a separate, limited `customers/set-role` enum that does not include `shop_owner`/`warehouse` (`packages/api/src/routers/customer-management.ts:29`, `packages/api/src/routers/customer-management.ts:416-436`). |
| `impersonateUser` | Documented; needs `user:impersonate`; impersonating admins needs `impersonate-admins` ([docs](https://www.better-auth.com/docs/plugins/admin#impersonate-user)) | Not a shop User Roles action. |
| Invitations | Admin plugin: none. Organization: `inviteMember`. Repo `invite` / `admin_invite` tables are **referral** codes for retailer/wholesaler signup (`packages/db/src/schema/invite.ts:1-27`, `packages/db/src/schema/admin-invite.ts:1-32`), not staff. | Current create flow is immediate email+password. Staff invite would be new (Organization or custom). |
| Client `adminClient({ ac, roles })` | Not passed (`apps/web/lib/auth-client.ts:13`) | Required only if the shop UI uses `checkRolePermission`. Owner-scoped ORPC does not need it. |

## Approval controls: industry usage + this-repo map

No repo fields named `expenseApproval`, `discountApproval`, `stockAdjustmentApproval`, or `returnApproval` exist (workspace search: zero matches). There is no shop/warehouse settings row for these toggles. `checkout_setting` stores pickup/courier/tax/shipping, not approvals (`packages/db/src/schema/checkout-setting.ts:11-35`).

### Why retailers/warehouses use these controls

These reasons are the operational purpose of the primary-product workflows below, not invented policy:

- **Expense approval** — employees spend company cash; managers must see receipts before cash/ledger moves (fraud, duplicate claims).
- **Discount approval** — unguarded salesman discounts destroy margin; ERPs gate submit by discount % or grand total.
- **Stock-adjustment approval** — counted qty vs book qty is how theft, damage, and shrinkage enter the ledger; applying a count writes inventory and usually an adjustment account.
- **Return approval** — returns reverse revenue and put stock back; unreviewed returns are a refund-fraud and shrinkage path.

Thresholds in first-party ERPs are typically **document-level**: “if amount/discount exceeds X, a higher role must submit.” They are not always a simple on/off on a settings page.

### Expense approval

**Industry (primary docs)**

- **Odoo 19 Expenses:** log → **Submit** → authorized user with at least Team Approver rights **Approve** or **Refuse** (reason required) → then **Post** journal entries → reimburse. Most users cannot process expenses. Official pages: [Log expenses](https://www.odoo.com/documentation/19.0/applications/finance/expenses/log_expenses.html), [Submit expenses](https://www.odoo.com/documentation/19.0/applications/finance/expenses/submit_expenses.html), [Process/approve expenses](https://www.odoo.com/documentation/19.0/applications/finance/expenses/approve_expenses.html), [Post expenses](https://www.odoo.com/documentation/19.0/applications/finance/expenses/post_expenses.html). Odoo’s native flow is status workflow, not an “ON + ≥ 2000” settings flag. Studio [Approval rules](https://www.odoo.com/documentation/19.0/applications/studio/approval_rules.html) can add conditional button approvals.
- **ERPNext Expense Claim:** employee selects an Expense Approver; approver sets Approval Status Approved/Rejected and sanctioned amounts; **submission books expense and employee payable**; payment is a later Payment Entry ([Expense Claim](https://docs.frappe.io/hr/expense-claim)). Again: claim-then-approve-then-pay, not pay-immediately.

**This repo**

| Requested control | Reality |
| --- | --- |
| ON/OFF + threshold ≥ 2000 → approval required | **Unavailable.** Schema comment: “Every expense is immediately paid. No pending, no unpaid. Status is always paid.” (`packages/db/src/schema/expense.ts:33-37`). No approval/status column; only `isVoided` / `voidReason` (`packages/db/src/schema/expense.ts:85-89`). |
| Create flow | `createExpense` inserts the row and immediately writes a financial-ledger debit (`packages/api/src/routers/expense.ts:37-106`). No pending state, no threshold check. |

Enabling the wireframe control would **change the domain principle** of expenses (paid-on-save) to Odoo/ERPNext-style draft/submit/approve, including withholding the ledger post until approval. That is new schema + new API, not a settings flag on the current table.

### Discount approval

**Industry (primary docs)**

- **ERPNext Authorization Rule** can require a higher role when **Average Discount**, **Item-wise Discount**, **Customer-wise Discount**, or Grand Total exceeds an Authorized Value. Example: Sales User may submit Sales Orders only below 10,000; above that only Sales Manager. Applies to a limited document list (Sales Order, Quotation, Sales Invoice, …) — **not** a generic POS settings toggle ([Authorization Rule](https://docs.frappe.io/erpnext/authorization-rule)).
- **ERPNext Applying Discount / Pricing Rule:** manual item or additional discount vs automatic Pricing Rule. Docs warn that automatic + manual discounts can stack and should be reviewed against approval policy ([Pricing Rule](https://docs.frappe.io/erpnext/pricing-rule)). The applying-discount page fetch **timed out** on 2026-09-03; Authorization Rule and Pricing Rule pages succeeded.
- **Odoo:** no first-party “discount % above X needs manager” setting was found in the Sales/Inventory docs fetched for this note. Studio approval rules can be attached to buttons generally ([Approval rules](https://www.odoo.com/documentation/19.0/applications/studio/approval_rules.html)).

**This repo**

| Surface | Discount fields | Approval? |
| --- | --- | --- |
| Warehouse estimates | `discount`, `discountPercent` (`packages/db/src/schema/estimate.ts:45-50`) | Salesman create/update already gates on a **hardcoded 5%**: `discountPercent > 5` → `pending` (owner must review); otherwise `sent` (`packages/api/src/routers/salesman.ts:1116-1118`, `packages/api/src/routers/salesman.ts:1518`). Warehouse owner reviews pending estimates (`reviewEstimate`) and may set `discountPercent` on approve (`packages/api/src/routers/warehouse-estimate.ts:675-734`). `getRisk` bands ≤5 / &lt;10 / ≥10% are **display-only** (`packages/api/src/routers/warehouse-estimate.ts:87-90`). There is **no** shop/warehouse setting for the 5%; the wireframe ON/OFF + ≥ N% should replace that constant. |
| POS | `discount` / `discountMode` / `discountValue` (`packages/db/src/schema/warehouse-pos.ts:180-184`). Calculator applies percentage or fixed discount immediately (`packages/api/src/services/owner-pos.ts:47-71`). | **No approval.** Any authorized POS checkout can discount 0–100%. |
| Checkout promotions | Coupon/product/reward discounts (`packages/api/src/services/checkout-domain.ts`) | Promotional, not salesman-threshold approval. |
| Wireframe ON/OFF + ≥ 0% | **No settings field.** OFF = “salesman can give discount freely” would match current POS behavior. ON + threshold would be new enforcement on POS and/or estimate create/review. |

Closest existing pattern: warehouse estimate **must** be pending then owner-approved — but that approves the whole quote, not “discount above N%”.

### Stock adjustment approval

**Industry (primary docs)**

- **Odoo 19 Inventory adjustments:** count is recorded in Counted, then **Apply** / **Apply All** writes on-hand qty and a stock move. Reasons are documented (damage, human error, theft). Apply is a confirmation step; delayed apply warns that stock may have moved. Relocate requires Administrator rights. There is no separate “approval required” setting in this doc ([Inventory adjustments](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management/count_products.html)).
- **ERPNext Stock Reconciliation:** Save and **Submit** sets counted qty/valuation; difference posts to Stock Adjustment account when perpetual inventory is on ([Stock Reconciliation](https://docs.frappe.io/erpnext/stock-reconciliation)). Submit is the accounting commit (Frappe submit permission), not a configurable ON/OFF + second approver unless a custom Workflow is added. This note did not fetch a first-party “stock recon needs manager approval” setting.

**This repo**

| Requested control | Reality |
| --- | --- |
| Status enum | `draft` / `submitted` / `approved` / `rejected` exist (`packages/db/src/schema/stock-adjustment.ts:37-42`, `packages/db/src/schema/stock-adjustment.ts:71-72`). |
| Warehouse create/submit | Create may be `draft` or `submitted`. **Submitted immediately applies inventory.** Submit endpoint sets status to `"submitted"` and updates `availableQty` (`packages/api/src/routers/stock-adjustment.ts:198-201`, `packages/api/src/routers/stock-adjustment.ts:363-365`, `packages/api/src/routers/stock-adjustment.ts:399-563`). **No approve/reject handlers.** `approved`/`rejected` are unused by the router. |
| Shop create | `createShopAdjustment` always inserts `status: "submitted"` and updates shop inventory in the same transaction (`packages/api/src/routers/shop-owner.ts:11570-11754`). Auto-submitted; no draft, no approval. |
| Tenant column | Header `warehouseId` is reused for shop owner id (`packages/api/src/routers/shop-owner.ts:11697-11700`). |

Wireframe “ON → inventory change approval required” would mean: stop applying qty on submit, introduce a second actor, and actually transition `submitted → approved` before touching `inventory`. That workflow is sketched in the enum and **not implemented**.

### Return approval

**Industry (primary docs)**

- **Odoo Sales returns:** reverse transfer and/or credit note; warehouse **Validate** receives goods; credit note **Confirm** posts the refund document ([Returns and refunds](https://www.odoo.com/documentation/19.0/applications/sales/sales/products_prices/returns.html), [Credit notes](https://www.odoo.com/documentation/19.0/applications/finance/accounting/customer_invoices/credit_notes.html)). Validation is an operation confirm, not an ON/OFF shop setting.
- **ERPNext Sales Return:** return Delivery Note and/or Credit Note from the original submitted document; submit posts stock and/or customer credit. Policy is “keep the invoice and credit,” not cancel for audit ([Sales Return](https://docs.frappe.io/erpnext/sales-return)).

**This repo**

| Requested control | Reality |
| --- | --- |
| Status | `pending` / `approved` / `rejected` / `processed` (`packages/db/src/schema/order-return.ts:17-22`, `packages/db/src/schema/order-return.ts:83-84`). |
| Submit | Creates `status: "pending"` (`packages/api/src/routers/returns.ts:368-385`). |
| Process | `processReturn` **requires `context.session.user.role === "admin"`** (`packages/api/src/routers/returns.ts:404-407`). Approve sets `processed` (not `approved`) and can restock (`packages/api/src/routers/returns.ts:432-433`). Reject sets `rejected`. |
| Shop/warehouse manager approval | **Not available.** Shop owner cannot process returns through this endpoint. |
| ON/OFF setting | **None.** Returns always start pending. There is no path that auto-approves when the toggle is off. |

The wireframe OFF = “no approval, salesman/cashier completes return immediately” would be new. ON is closer to today’s pending state, except today’s approver is platform admin, not the shop/warehouse owner.

### Option-by-option approval map

| Wireframe control | Industry analogue | This repo | Build vs reuse |
| --- | --- | --- | --- |
| Expense ON/OFF + ≥ amount | Odoo submit/approve/post; ERPNext expense claim | Immediate paid expense; no pending | **New** (breaks current “always paid” principle) |
| Discount ON/OFF + ≥ % | ERPNext Authorization Rule on discount % / total | POS free discount; salesman estimates hardcode `> 5%` → pending | **Reuse** estimate pending path; **new** setting to replace `5`; **new** POS enforcement |
| Stock adjustment ON/OFF | Odoo apply count; ERPNext submit recon | Enum has approved/rejected; submit already mutates stock | **New** two-step approve; reuse table/enum only |
| Return ON/OFF | Odoo validate + credit note; ERPNext submit return | Pending + admin-only process | Reuse pending/process; **new** shop-owner processor and optional auto-approve |

## Order control settings: this-repo map

| Requested UI | Real source | Recommendation |
| --- | --- | --- |
| Minimum Order Quantity ON/OFF + ≥ N units **shop-wide** | **No shop-wide field.** Product: `minimumOrderEnabled` (default true), `minimumOrderQty` (default `"1"`) (`packages/db/src/schema/product.ts:138-149`). Copied onto variants as `orderMin` (`packages/db/src/schema/product-variant.ts:94-97`; warehouse/shop config routers write `orderMin` from those product fields). Cart enforcement uses variant `orderMin` (`packages/api/src/routers/helpers/retailer-cart-inventory.ts:249-258`). Product-type defaults: `minimumOrderDefault`, `minimumOrderQtyDefault` (`packages/db/src/schema/product-type-rule-setting.ts:52-61`). | Do not present product-level min qty as a shop toggle. A shop-wide N would be a **new** setting, then must be defined vs per-product `orderMin` (max of both? override?). |
| Minimum Order Amount ON/OFF + ≥ ৳ | **No shop-wide order minimum amount.** `checkout_setting` has shipping fee and tax, not min order value (`packages/db/src/schema/checkout-setting.ts:20-28`). `offer_template.minimumOrderAmount` is an **offer eligibility** floor (`packages/db/src/schema/offer-template.ts:69`), not a checkout gate for all orders. | Omit or build a new owner setting. Do not reuse offer-template minimums as store policy. |

`order` schema has no `minimumOrder*` columns (search in `packages/db/src/schema/order.ts`: none).

## Gaps that must be built (not present today)

1. Shop/warehouse User Roles page (currently Coming Soon).
2. Shop-internal job titles and access-level bundles that are not platform `user.role`.
3. Shop staff other than deliverymen (no shop salesman/purchase-manager create API).
4. Passing custom `ac`/`roles` into `adminClient` if client-side Admin permission helpers are used.
5. Organization plugin (tables, `activeOrganizationId`, invitations) — **not installed**.
6. Approval-settings persistence (no table/fields).
7. Expense draft/pending/approve and delayed ledger posting (contradicts current expense principle).
8. Discount threshold enforcement on POS and/or estimates.
9. Stock-adjustment `approved`/`rejected` transitions that run **before** inventory mutation.
10. Shop/warehouse-owner return processing (today admin-only); optional auto-approve when toggle is off.
11. Shop-wide minimum order quantity and amount.
12. User Profile destination for View, except existing delivery-team detail for riders.
13. Staff invitation (Admin plugin has none; referral `invite` tables are the wrong domain).

## Recommended implementation sequence

**Recommendation**, ordered by dependency and honesty about missing data:

1. **Staff table (read-only then CRUD) using existing owner-scoped lists.** Shop: delivery team. Warehouse: salesman + deliveryman. Show real `user.id`, `name`, platform `role`. Do not display invented access levels.
2. **Add staff without touching `adminRoles`.** Extend the existing `auth.api.createUser` + `shopId`/`warehouseId` pattern. Keep platform role as `deliveryman` or `salesman` only when that portal is intended.
3. **Introduce a separate staff-function / permission bundle** before any Purchase Mgr / shop-admin labels. Update ORPC checks to use that bundle; leave `shopOwnerProcedure` equality intact for owners.
4. **Do not wire `authClient.admin.listUsers` / `setRole` into the shop page.**
5. **Returns (smallest approval reuse):** allow shop_owner/warehouse to call a scoped process endpoint; add an ON/OFF only after auto-approve vs pending is a real state machine.
6. **Stock adjustment:** implement `submitted → approved` and stop applying qty on submit if the toggle is on; if off, keep today’s apply-on-submit.
7. **Discount:** replace the hardcoded `discountPercent > 5` in salesman estimate create/update with the stored threshold; then enforce the same cap on POS `calculatePosCheckout` / checkout. Keep `getRisk` as UX only.
8. **Expense:** only if product accepts replacing “always paid” with a claim workflow; otherwise omit the expense toggle rather than faking pending.
9. **Order controls:** new owner settings; decide merge rule with per-product `minimumOrderQty` / `orderMin` before UI.
10. **Organization plugin** only after explicitly modeling each shop/warehouse as an organization; otherwise `shopId`/`warehouseId` remain the tenancy key.

## Sources

### Better Auth (official)

- [Admin plugin](https://www.better-auth.com/docs/plugins/admin) — createUser, listUsers, getUser, setRole, ban, impersonate, removeUser, hasPermission / userHasPermission, custom AC, adminRoles, multiple comma-separated roles, default user/session statements. Fetched 2026-09-03.
- [Organization plugin](https://www.better-auth.com/docs/plugins/organization) — members, invitations, org roles owner/admin/member, org-scoped AC, listMembers, schema tables. Fetched 2026-09-03.
- GitHub [issue 3717](https://github.com/better-auth/better-auth/issues/3717) and [PR 4385](https://github.com/better-auth/better-auth/pull/4385) — server-side admin session behavior (supporting context; not a substitute for the 1.5.5 source file, which was not read from `node_modules`).

### Odoo 19 (official)

- [Expenses](https://www.odoo.com/documentation/19.0/applications/finance/expenses.html)
- [Submit expenses](https://www.odoo.com/documentation/19.0/applications/finance/expenses/submit_expenses.html)
- [Process expenses](https://www.odoo.com/documentation/19.0/applications/finance/expenses/approve_expenses.html)
- [Post expenses](https://www.odoo.com/documentation/19.0/applications/finance/expenses/post_expenses.html)
- [Log expenses](https://www.odoo.com/documentation/19.0/applications/finance/expenses/log_expenses.html)
- [Inventory adjustments](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/warehouses_storage/inventory_management/count_products.html)
- [Returns and refunds](https://www.odoo.com/documentation/19.0/applications/sales/sales/products_prices/returns.html)
- [Credit notes](https://www.odoo.com/documentation/19.0/applications/finance/accounting/customer_invoices/credit_notes.html)
- [Studio approval rules](https://www.odoo.com/documentation/19.0/applications/studio/approval_rules.html)

Fetch failures: `.../expenses/process.html` and `.../expenses/expense_submit.html` returned 404; the correct submit/approve URLs above succeeded.

### ERPNext / Frappe (official)

- [Expense Claim](https://docs.frappe.io/hr/expense-claim)
- [Stock Reconciliation](https://docs.frappe.io/erpnext/stock-reconciliation)
- [Sales Return](https://docs.frappe.io/erpnext/sales-return)
- [Authorization Rule](https://docs.frappe.io/erpnext/authorization-rule)
- [Pricing Rule](https://docs.frappe.io/erpnext/pricing-rule)

Fetch timeout: [https://docs.frappe.io/erpnext/applying-discount](https://docs.frappe.io/erpnext/applying-discount) on 2026-09-03. Shopify POS / Lightspeed first-party docs were not required once Odoo and ERPNext covered the four controls.

### This repository

- Auth: `packages/auth/src/index.ts`, `packages/auth/src/permissions.ts`, `apps/web/lib/auth-client.ts`, `pnpm-workspace.yaml:19`, `pnpm-lock.yaml` (`better-auth@1.5.5`)
- User schema and tenancy: `packages/db/src/schema/auth-schema.ts`
- Procedures and routing: `packages/api/src/index.ts`, `apps/web/proxy.ts`
- Staff CRUD: `packages/api/src/routers/employee.ts`, `packages/api/src/routers/warehouse-employee.ts`, `packages/api/src/routers/shop-owner.ts` (delivery-team + `createShopAdjustment`)
- Expenses: `packages/db/src/schema/expense.ts`, `packages/api/src/routers/expense.ts`
- Stock adjustment: `packages/db/src/schema/stock-adjustment.ts`, `packages/api/src/routers/stock-adjustment.ts`
- Returns: `packages/db/src/schema/order-return.ts`, `packages/api/src/routers/returns.ts`
- Discounts: `packages/db/src/schema/estimate.ts`, `packages/api/src/routers/salesman.ts` (`discountPercent > 5` → pending), `packages/api/src/routers/warehouse-estimate.ts`, `packages/db/src/schema/warehouse-pos.ts`, `packages/api/src/services/owner-pos.ts`
- Min order: `packages/db/src/schema/product.ts`, `packages/db/src/schema/product-variant.ts`, `packages/db/src/schema/product-type-rule-setting.ts`, `packages/api/src/routers/helpers/retailer-cart-inventory.ts`, `packages/db/src/schema/checkout-setting.ts`, `packages/db/src/schema/offer-template.ts`
- Placeholders: `apps/web/app/shop/(management)/dashboard/user-roles/page.tsx`, `apps/web/app/warehouse/(management)/dashboard/user-roles/page.tsx`
