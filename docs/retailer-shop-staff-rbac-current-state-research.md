# Retailer Shop Staff Roles and Permissions: Current State and Recommended Direction

**Research date:** 2026-09-04
**Scope:** retailer/shop staff only; primary sources in this repository; no application behavior changed.

## Executive finding

The user's suspicion is correct: retailer staff access is currently a **hard-coded preset system**, not a configurable role-and-permission system.

- `user.role` is the platform/portal account type.
- A retailer employee has one plain-text `user.shopFunction`.
- That function selects one fixed TypeScript bundle of coarse modules.
- The User Roles screen can create a staff member and select one of those fixed bundles, but cannot create a named role or edit module, page, or action grants.
- Sidebar visibility is computed client-side from the same hard-coded matrix. There is no page-level route guard.
- Server coverage is partial: many APIs correctly check a module, but other APIs do not, and several pages group together operations protected by different modules.

The right next step is a **hybrid data-driven RBAC model**: keep the permission catalog and API bindings developer-controlled, but store each shop's named roles and grants in the database. The owner should edit those grants through a module → page → action matrix.

## 1. The two authorization layers that exist today

The codebase has two separate access-control concepts.

### 1.1 Platform role / portal routing

Better Auth registers the static roles `consumer`, `shop_owner`, `admin`, `salesman`, `deliveryman`, `shop_staff`, and `warehouse` (`packages/auth/src/index.ts:66-78`). The database stores the platform role in `user.role` (`packages/db/src/schema/auth-schema.ts:21-25`).

The role cookie controls portal routing. Both `shop_owner` and `shop_staff` are treated as shop-portal roles (`packages/auth/src/shop-staff-access.ts:145-147`), and the shop subdomain proxy admits a logged-in shop-portal role before rewriting the URL into the `/shop` application tree (`apps/web/proxy.ts:167-224`).

The Better Auth statement catalog is also static: resources include `order`, `product`, `delivery`, `estimate`, `shop`, `inventory`, and `seller_application` (`packages/auth/src/permissions.ts:8-19`). The `shop_staff` platform role receives a broad fixed statement set, and its source comment explicitly delegates fine-grained access to `shopFunction` (`packages/auth/src/permissions.ts:91-103`).

No application call to Better Auth's `hasPermission`, `userHasPermission`, or `checkRolePermission` was found under `packages/` or `apps/web/`. Retailer module enforcement uses the separate custom helpers described below.

### 1.2 Shop function / module bundle

The retailer-specific layer is entirely declared in `packages/auth/src/shop-staff-access.ts`:

- fixed functions: `shop_admin`, `purchase_manager`, `sales_agent`, `delivery`, `inventory` (`packages/auth/src/shop-staff-access.ts:3-11`);
- fixed modules: `overview`, `inventory`, `purchase`, `sales`, `delivery`, `finance`, `contacts`, `network`, `fulfillment`, `marketing`, `reports`, `referral`, `settings`, `staff` (`packages/auth/src/shop-staff-access.ts:13-30`);
- fixed labels and display access levels (`packages/auth/src/shop-staff-access.ts:42-56`);
- fixed function-to-module grants (`packages/auth/src/shop-staff-access.ts:58-70`).

The resulting matrix is:

| Actor / shop function | Stored platform role | Effective modules |
| --- | --- | --- |
| Shop owner | `shop_owner` | All 14 modules, including `staff` |
| Shop Admin | `shop_staff` | All modules except `staff` |
| Purchase Manager | `shop_staff` | `overview`, `purchase`, `contacts`, `network` |
| Sales Agent | `shop_staff` | `overview`, `sales`, `contacts`, `fulfillment` |
| Delivery | `deliveryman` | Declared as `overview`, `delivery`, `fulfillment`, but routed to the separate delivery portal |
| Inventory / Warehouse clerk | `shop_staff` | `overview`, `inventory` |

The platform-role mapping is special-cased: Delivery becomes `deliveryman`; all other employee functions become `shop_staff` (`packages/auth/src/shop-staff-access.ts:139-143`). A `deliveryman` is explicitly not a shop-portal role (`packages/auth/src/shop-staff-access.ts:145-147`), and the User Roles UI warns that Delivery signs in through the delivery portal (`apps/web/app/shop/(management)/dashboard/user-roles/page.tsx:81-87`). Therefore the Delivery row is a portal switch, not a normal set of shop-dashboard page grants.

## 2. What is stored in the database

The current staff tenancy and function data consists of:

- `user.role` — platform account type;
- `user.shopId` — parent shop-owner user ID;
- `user.shopFunction` — nullable free text.

These fields are declared at `packages/db/src/schema/auth-schema.ts:21-25,64-69`. `shopFunction` has no database enum, foreign key, or check constraint. No role, module, page, permission, role-permission, or membership-role table was found in `packages/db/src/schema`.

There is also a deployment risk: migration `packages/db/src/migrations/0040_retailer_delivery_ownership.sql:1-20` adds `shop_id`, but a repository-wide search of committed SQL migrations found no migration that adds `shop_function`, even though the Drizzle schema now expects it (`packages/db/src/schema/auth-schema.ts:68-69`). A migrated environment that has not used schema push may therefore lack the column.

Tenant resolution is otherwise designed correctly in the shared helper:

- a shop owner's tenant ID is the owner's user ID;
- a `shop_staff` user's tenant ID is `user.shopId`;
- a missing/invalid function cannot resolve to a shop actor.

Evidence: `packages/auth/src/shop-staff-access.ts:98-132,155-165` and `packages/api/src/shop-portal-scope.ts:29-57`.

## 3. How staff are created and assigned

All staff-management APIs use `shopOwnerProcedure`, so only the actual `shop_owner` can list functions, create staff, view staff profiles, reassign functions, reset passwords, ban, or remove staff (`packages/api/src/routers/shop-staff.ts:159-176,178-230,288-326,328-470`; `packages/api/src/index.ts:101-117`).

Creation works as follows:

1. The input accepts exactly one `shopFunction` from the fixed enum (`packages/api/src/routers/shop-staff.ts:25,231-240`).
2. The code creates a Better Auth user with either `shop_staff` or `deliveryman` (`packages/api/src/routers/shop-staff.ts:241-257`).
3. A separate database update writes `shopId` and `shopFunction` (`packages/api/src/routers/shop-staff.ts:270-279`).

Reassignment similarly writes one next function and may change the platform role when crossing into or out of Delivery (`packages/api/src/routers/shop-staff.ts:288-325`). There is no support for multiple shop roles, custom role names, direct per-user grants, or deny overrides.

Because auth-user creation and the follow-up staff-link update are separate writes, a failed second step can leave an orphaned account. Changing `user.role` directly also means an already-issued session and its `user-role` routing cookie may remain stale until session refresh or a new sign-in; that cookie is only set in the sign-in/sign-up/phone-verification auth hook (`packages/auth/src/index.ts:305-323`).

## 4. What the current visual UI actually manages

The current `/dashboard/user-roles` page is no longer a placeholder. It provides:

- a read-only role catalog showing the fixed access-level label and comma-separated module IDs (`apps/web/app/shop/(management)/dashboard/user-roles/page.tsx:151-190`);
- a staff directory (`apps/web/app/shop/(management)/dashboard/user-roles/page.tsx:192-239`);
- an Add New User dialog with one fixed-role dropdown (`apps/web/app/shop/(management)/dashboard/user-roles/page.tsx:242-355`);
- a profile page where the owner can replace that one fixed function with another (`apps/web/app/shop/(management)/dashboard/user-roles/[id]/page.tsx:90-131`).

It does **not** provide:

- custom named roles;
- module or page checkboxes;
- action-level grants such as View, Create, Edit, Approve, Void, or Export;
- per-user overrides;
- permission diffs or a "preview as this role" mode;
- persisted role-permission records.

The server exposes a `myAccess` response containing actor, access level, modules, and `canManageStaff` (`packages/api/src/routers/shop-staff.ts:123-156`), but no frontend consumer of `shopStaff.myAccess` was found. The sidebar independently recalculates access from session fields instead.

## 5. How modules are translated to pages

The entire shop menu and page hierarchy is hard-coded in `apps/web/components/dashboard/shop-owner-sidebar.tsx:54-326`. A second hard-coded map assigns each sidebar **group label** to one coarse module (`apps/web/components/dashboard/shop-owner-sidebar.tsx:328-342`):

| Module | Sidebar group and pages represented there |
| --- | --- |
| `overview` | Dashboard |
| `inventory` | Inventory, Product Catalog, Catalog Requests, My Store |
| `purchase` | Stock pages, Add Stock, Stock Adjustment, Damage, pricing/setup, Warehouses, purchase orders, Suppliers |
| `sales` | POS, Sales, Daybook, EMI |
| `finance` | Financial overview, income, expenses, receivable, payable, transactions, accounts, ledger, cash collection, P&L, balance sheet, categories, trial balance |
| `contacts` | Customers, Suppliers, Payees |
| `network` | Connected Suppliers |
| `fulfillment` | Product Sync, Incoming Orders, Open Orders, Dispatch Orders, Delivery Management |
| `delivery` | Delivery Team and Delivery Assignment |
| `marketing` | SMS Marketing, Promotions, Marketing Materials |
| `reports` | Sales, purchase, A/P, A/R, P&L reports |
| `referral` | Refer & Earn |
| `settings` | General Settings, User Roles, System Control |
| `staff` | No sidebar group is mapped to this module |

For a resolved actor, the sidebar removes groups whose module is not in the fixed bundle (`apps/web/components/dashboard/shop-owner-sidebar.tsx:344-350`). It then separately hides User Roles and System Control from every non-owner (`apps/web/components/dashboard/shop-owner-sidebar.tsx:351-365`). This second rule does not use the declared `staff` module.

There is a client-side fail-open: an unresolved actor is treated as `owner` (`apps/web/components/dashboard/shop-owner-sidebar.tsx:344-346`), so an invalid/missing function displays the full owner menu even though properly protected APIs later reject the user.

## 6. Page access is not a security boundary

The shop dashboard layout only renders the shell and children; it performs no module/page authorization (`apps/web/app/shop/(management)/dashboard/layout.tsx:1-40`). The shop-subdomain proxy checks the portal role, not the requested page's module (`apps/web/proxy.ts:167-224`).

Consequently, hiding a menu item does not block a direct URL. A user may type any shop-dashboard URL. Actual security depends on every API used by the page checking the correct permission and resolving the parent shop correctly.

The backend's intended module guard is sound in isolation:

- `shopModuleProcedure(module)` requires a session and calls `requireShopModule` (`packages/api/src/index.ts:119-150`);
- `requireShopModule` resolves the shop actor, checks the hard-coded module set, and fails with `FORBIDDEN` (`packages/api/src/shop-portal-scope.ts:29-57`);
- owner scoping can use the parent shop through `shopTenantId` or `shopOrWarehouseOwnerScope` (`packages/api/src/shop-portal-scope.ts:42-67`).

The main shop-owner router declares module-specific procedures for overview, inventory, purchase, sales, fulfillment, delivery, network, and contacts (`packages/api/src/routers/shop-owner.ts:321-328`). Shared finance, expense, purchase, payee, and related routers also call `shopOrWarehouseOwnerScope` with a module before reading or writing tenant data, for example `packages/api/src/routers/finance.ts:138-140`, `packages/api/src/routers/expense.ts:38-90`, and `packages/api/src/routers/purchase.ts:43-56`.

However, `reports`, `referral`, `settings`, and `staff` were never found as arguments to `shopModuleProcedure`, `requireShopModule`, or `shopOrWarehouseOwnerScope` anywhere under `packages/api/src`. Those module names are currently navigation/catalog concepts rather than consistent server permissions.

## 7. Concrete drift between the menu and server enforcement

The broad sidebar groups are already too coarse to represent real page capabilities.

### 7.1 Stock pages: `purchase` in the menu, `inventory` in the APIs

Stock Control, Add Stock, Stock Adjustment, Damage, and setup pages all sit inside **Supply & Purchasing**, so the sidebar treats them as `purchase` (`apps/web/components/dashboard/shop-owner-sidebar.tsx:77-124,328-342`). Yet core stock APIs are guarded as `inventory`, including `getStockOverview` (`packages/api/src/routers/shop-owner.ts:610-618`) and real-time/low/expired/adjustment/damage operations declared from `inventoryProcedure` (`packages/api/src/routers/shop-owner.ts:793,980,1182,11500-12111`).

Result:

- Inventory staff have relevant API permission but do not see these navigation links.
- Purchase Managers see the links but are denied by those module-guarded APIs.

The visible Stock Overview page also uses a separate `stockOverview` router (`apps/web/app/shop/(management)/dashboard/stock/page.tsx:175-203`) whose two dashboard endpoints require only `protectedProcedure` and scope data to `context.session.user.id` (`packages/api/src/routers/stock-overview.ts:348-391`). For staff, that is the employee ID rather than the parent `shopId`, so the page does not use either the inventory module or the correct parent-shop scope.

### 7.2 My Store: `inventory` in the menu, `sales` in the APIs

My Store appears under Inventory Management (`apps/web/components/dashboard/shop-owner-sidebar.tsx:60-74`), but its preview and stats handlers use `salesProcedure` (`packages/api/src/routers/shop-owner.ts:10974-10979,11191-11195`). An Inventory clerk sees the link but cannot use its server operations; a Sales Agent receives the API permission but does not see the link.

### 7.3 Fulfillment group mixes sales, fulfillment, and purchase

E-Commerce & Fulfillment puts Incoming Orders, Open Orders, Dispatch Orders, and Delivery Management in one `fulfillment` group (`apps/web/components/dashboard/shop-owner-sidebar.tsx:212-235,336`). Server operations span multiple modules:

- incoming-order approval/invoice operations use `salesProcedure` (`packages/api/src/routers/shop-owner.ts:6655-7010`);
- handoff and delivery operations use `fulfillmentProcedure` (`packages/api/src/routers/shop-owner.ts:7012-7270`);
- open-order pool, history, offer, and withdrawal operations use `purchaseProcedure` (`packages/api/src/routers/shop-owner.ts:8646-8934`).

No one coarse `fulfillment` checkbox can accurately describe this group.

### 7.4 Reports module does not match report APIs

The sidebar has a separate `reports` module (`apps/web/components/dashboard/shop-owner-sidebar.tsx:265-300,339`), but purchase and accounts-payable reports use `purchaseProcedure` (`packages/api/src/routers/shop-owner.ts:2960,3142`). A Purchase Manager can be allowed by the report API while the entire Reports menu is hidden.

### 7.5 Shop Admin sees Settings but owner-only APIs reject it

Shop Admin is labeled "All Modules" and has `settings`, but not `staff` (`packages/auth/src/shop-staff-access.ts:50-69`). The sidebar keeps General Settings visible while removing only User Roles and System Control (`apps/web/components/dashboard/shop-owner-sidebar.tsx:351-365`). Business-profile and security endpoints are still protected with exact-owner `shopOwnerProcedure`, including `updateShopLocation`, business/contact/plan updates, login security, and profile update (`packages/api/src/routers/shop-owner.ts:2063,2099,2185,2224,2259,2281,2340`). Thus the Shop Admin is shown a page whose mutations 403.

### 7.6 Marketing is only partially protected

Retailer offer/promotions handlers correctly use `shopModuleProcedure("marketing")` (`packages/api/src/routers/retailer-offer.ts:418,555,670,715,827,889`). Marketing Materials handlers use only `protectedProcedure`, with no marketing module check (`packages/api/src/routers/marketing.ts:22-69,124-165`). Hiding Marketing Materials in the sidebar therefore does not deny its APIs.

## 8. Staff tenant-scope regressions

Some endpoints were converted from owner-only procedures to module procedures, but their handlers still use `context.session.user.id` as the shop ID. For a staff session, that is the employee ID; the correct value is `shopTenantId(context.session.user)`.

Examples include:

- incoming-order invoice creation (`packages/api/src/routers/shop-owner.ts:6989-7010`);
- fulfillment configuration and self-pickup completion (`packages/api/src/routers/shop-owner.ts:7012-7079`);
- dispatch shop/profile and order filters (`packages/api/src/routers/shop-owner.ts:7083-7111`);
- delivery-team update/reset/ban filters (`packages/api/src/routers/shop-owner.ts:7375-7464`);
- open-order offer submission and withdrawal (`packages/api/src/routers/shop-owner.ts:8868-8934`).

The likely effect is empty results, false Not Found responses, or writes scoped to an employee ID rather than the parent shop. Unique user IDs make this primarily a broken tenant-resolution problem, not evidence of a cross-shop data leak, but it shows why permission checking and tenant resolution must be one shared operation.

## 9. Tests and documentation status

The pure helper tests validate the fixed function list, labels, matrix, owner privilege, platform-role mapping, tenant resolution, and presented directory labels (`packages/auth/src/shop-staff-access.test.ts:20-220`). The focused test suite passes all 13 tests.

Fulfillment helper tests cover a Sales Agent resolving to the parent shop and a Purchase Manager being rejected from fulfillment (`packages/api/src/routers/helpers/fulfillment-owner.test.ts:35-64`).

No shop-staff router integration test, direct-page guard test, sidebar/API parity test, or staff-session integration test for the affected shop-owner endpoints was found. Existing retailer POS integration fixtures use shop-owner sessions, not `shop_staff` sessions (`packages/api/src/routers/retailer-pos.integration.test.ts:54-70`).

The earlier research note is stale on UI status: it still describes the User Roles page as Coming Soon (`docs/user-roles-approval-controls-research.md:19-29`). Its architectural warning remains correct: shop job titles should not be written into the platform role used for routing (`docs/user-roles-approval-controls-research.md:90-148`).

## 10. Recommended target model

This direction also matches primary authorization guidance:

- NIST's RBAC model treats a role as a collection of permissions and authorizes transactions through role membership, which is the separation missing from the current single `shopFunction` preset ([NIST RBAC FAQ](https://csrc.nist.gov/Projects/Role-Based-Access-Control/faqs)).
- OWASP recommends least privilege, deny-by-default behavior, and validating authorization on every request. That is why sidebar hiding cannot be the security boundary and newly added capabilities should not inherit access accidentally ([OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)).
- Better Auth's Admin plugin supports static custom resource/action statements, which resembles the platform-level catalog already used here ([Better Auth Admin — Access Control](https://better-auth.com/docs/plugins/admin#access-control)). Its Organization plugin also offers database-backed dynamic roles and permissions scoped to an organization ([Better Auth Organization — Dynamic Access Control](https://better-auth.com/docs/plugins/organization#dynamic-access-control)). That plugin becomes a viable implementation option only if this product deliberately models each shop as an organization; today a shop is the `shop_owner` user row, so adopting it without a shop-to-organization migration would create a second tenant identity.

### 10.1 Keep portal identity separate from shop authorization

Continue using `user.role` only for broad account/portal identity:

- `shop_owner` — tenant owner;
- `shop_staff` — employee who may enter the shop portal;
- `deliveryman` — separate delivery portal;
- other existing platform roles unchanged.

Do not turn custom names such as "Cashier", "Purchase Manager", or "Branch Manager" into new platform roles.

### 10.2 Persist named shop roles and grants

A minimal relational model should be equivalent to:

| Table | Purpose |
| --- | --- |
| `shop_role` | `id`, `shop_id`, `name`, `description`, `is_system`, `status` |
| `permission_catalog` | stable global `key`, `module_key`, `page_key`, `action`, description, sensitivity metadata |
| `shop_role_permission` | grants a catalog permission to a shop role |
| `shop_user_role` | assigns one shop role to one staff member within one shop |

Start with one named shop role per staff member. Multiple-role union and per-user overrides add substantial explanation and auditing complexity and should wait for a demonstrated need.

### 10.3 Make the permission catalog developer-controlled

The shop owner should choose grants, not type raw URLs or invent backend permission keys. Stable capability keys should be source-controlled and registered alongside their page/API bindings, for example:

- `inventory.products.view`
- `inventory.stock.view`
- `inventory.stock.adjust`
- `purchase.orders.view`
- `purchase.orders.approve`
- `sales.pos.use`
- `sales.pos.void`
- `finance.expenses.view`
- `finance.expenses.create`
- `staff.users.manage`
- `settings.business.manage`

This hybrid keeps the system extendable—developers add a capability once, and it appears in the owner UI—while preventing the UI from claiming access that no server handler enforces.

### 10.4 Build the owner UI as a permission matrix

Recommended layout:

```text
Roles                            Permission editor
┌──────────────────────┐         ┌──────────────────────────────────────────┐
│ Shop Admin       3   │         │ Inventory                         [−]    │
│ Purchase Manager 2   │         │   Products                        [✓]    │
│ Cashier          5   │         │     View [✓] Create [ ] Edit [ ] Delete [ ]
│ + New role           │         │   Stock                           [−]    │
└──────────────────────┘         │     View [✓] Adjust [✓] Export [ ]       │
                                 │ Purchase                          [ ]    │
                                 │ Sales                             [✓]    │
                                 └──────────────────────────────────────────┘
```

Useful behavior:

- roles on the left; collapsible modules on the right;
- pages beneath each module;
- action checkboxes under each page;
- tri-state module checkbox for select all / partial / none;
- Copy Role, Reset to Template, Preview Navigation, affected-user count, and unsaved-change diff;
- clear labels for sensitive grants such as Delete, Approve, Void, Refund, Export, and Manage Staff;
- staff assignment as a separate screen from role definition;
- audit records for who changed a role and which grants changed.

### 10.5 Make server permission checks authoritative

Every protected operation should call one shared resolver that returns both the parent shop and the effective permission set, conceptually:

```ts
const { shopId } = await requireShopPermission(
  context.session.user,
  "sales.pos.void",
);
```

The same catalog should drive:

1. sidebar visibility;
2. a real page-level guard that renders a 403 state for direct URLs;
3. button/action visibility;
4. API query and mutation enforcement.

The API remains the security boundary. Navigation and button filtering are usability layers. Unknown routes/capabilities and missing role assignments must fail closed.

## 11. Safe migration sequence

1. Add the missing `shop_function` migration first so current code is deployable consistently.
2. Create the permission catalog and named-role tables.
3. Seed default role templates matching the current five function bundles.
4. Backfill each existing `shopFunction` to a shop role assignment; keep `shopFunction` temporarily for compatibility.
5. Create one canonical route/capability registry and replace sidebar group-label mapping.
6. Convert APIs module by module to stable action permissions while always resolving the parent shop through the same guard.
7. Add page guards and permission-aware buttons from the same effective-access response.
8. Add integration tests for every default role: direct URLs, reads, mutations, forbidden actions, banned users, and cross-shop isolation.
9. Remove the legacy function matrix only after parity tests and tenant-scope tests pass.

Newly registered pages and actions should default to **denied** until a role template or shop owner explicitly grants them.

## Final recommendation

Do not expand the current `FUNCTION_MODULES` object into a larger list of URLs. It will make drift worse.

Use the present functions as **migration templates**, then move to database-backed named roles with developer-defined capability keys and an owner-editable module/page/action matrix. Fix the current sidebar/API mismatches and parent-shop ID regressions during that migration. This gives the retailer a visual, page-by-page experience while keeping real security in server-side action checks.
