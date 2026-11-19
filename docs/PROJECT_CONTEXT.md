# Bikalpo — Full Project Context (for AI assistants)

Last updated: 2026-10-27, at `main` commit `7b566827` (PR #170).

Read this before touching the code. It explains what Bikalpo is, how the repository is laid out, how to run it, where each feature lives, and the rules that keep you from breaking production.

Related docs at the repo root:
- [`CONTEXT.md`](../CONTEXT.md): the domain glossary (Core Product Identity, Brand Product, Owner Variant, Open Order, …). Use those exact terms.
- [`PRODUCT.md`](../PRODUCT.md) and [`DESIGN.md`](../DESIGN.md): product personality and design rules for UI work.

---

## 1. What Bikalpo is

Bikalpo (bikalpo.com) is a Bangladeshi multi-sided commerce platform. One codebase serves:

| Audience | What they do | Where |
|---|---|---|
| **Consumer** | Browse products and sellers, order from a retailer (Direct Order) or ask nearby retailers for offers (Open Order), and rent property (To-Let) | `bikalpo.com` |
| **Shop Owner / retailer** | Run a shop: POS, inventory, orders, storefront, staff, finance | `shop.bikalpo.com` |
| **Warehouse Owner** (wholesaler/distributor) | Wholesale stock, supply shops, cartons, delivery team, finance | `warehouse.bikalpo.com` |
| **Delivery / Deliveryman** | Delivery management and the rider app | `delivery.bikalpo.com`, `/deliveryman` |
| **Sales / Salesman** | Field sales | `sales.bikalpo.com` |
| **B2B marketing** | Marketing site, pricing, registration | `b2b.bikalpo.com` |
| **Admin** | Whole-platform control | `bikalpo.com/dashboard/admin` |
| **Property owner / tenant** | To-Let: register properties, list units, book, pay rent | `bikalpo.com/to-let`, `/account/to-let` |

The UI is mostly English with Bangla (বাংলা) copy in marketing and To-Let sections. Currency is BDT (৳), and dates use the Asia/Dhaka timezone.

---

## 2. Tech stack

The project was scaffolded with **Better-T-Stack** (see [`bts.jsonc`](../bts.jsonc)).

```
Frontend  : Next.js 16 (App Router, Turbopack) + React Native (Expo)
Backend   : Hono on Bun
API       : oRPC (RPC at /rpc, REST at /, OpenAPI docs at /docs)
Database  : PostgreSQL + Drizzle ORM
Auth      : better-auth (phone-number OTP login, roles via access control)
Storage   : Cloudinary (images, video, documents)
Realtime  : Socket.IO (@socket.io/bun-engine)
Language  : TypeScript everywhere
Monorepo  : pnpm workspaces + Turborepo (pnpm@10.12.4)
```

**Web extras:**
- UI: Tailwind CSS v4, shadcn/ui on Radix, Lucide/Tabler icons
- Data: TanStack Query (through `@orpc/tanstack-query`)
- Forms: React Hook Form, TanStack Form, Zod v4
- URL state: nuqs
- Maps: Leaflet; Barikoi for Bangladesh geocoding
- Charts and tables: Recharts, TanStack Table
- Other: Lexical (rich text), Embla (carousel), pdf-lib, qrcode.react, ExcelJS, Sonner (toasts), Motion
- Lint/format: Biome

**Mobile extras:** Expo Router, Tamagui, React Navigation, `@better-auth/expo`.

---

## 3. Repository layout

```
E:\bikalpo-project\
├── apps/
│   ├── web/        Next.js site and every portal (consumer, shop, warehouse, admin, …)
│   ├── server/     Bun + Hono API server (thin: mounts auth, oRPC and Socket.IO)
│   └── native/     Expo / React Native mobile app
├── packages/
│   ├── api/        All business logic: oRPC routers, services, helpers
│   ├── auth/       better-auth config, roles/permissions, phone identity, OTP store
│   ├── db/         Drizzle schema, SQL migrations, seeds and maintenance scripts
│   ├── env/        Typed env vars (server.ts, web.ts, native.ts)
│   └── config/     Shared tsconfig (tsconfig.base.json)
├── docs/           Feature notes, research, ADRs (see §13)
├── context/        Older working notes (pricing, delivery flow, test plans)
├── rayhandev-docs/ To-Let handoff notes
├── scripts/        One-off verification scripts (warehouse carton/order flows)
├── migrations/     One stray manual SQL fix (2026-05-26); real migrations live in packages/db
├── Dockerfile      API image (oven/bun)
├── Dockerfile.web  Web image (node:20-alpine)
├── .github/workflows/ci.yml   CI: type-check + build web and server
├── turbo.json, pnpm-workspace.yaml, package.json, bts.jsonc
└── CONTEXT.md, PRODUCT.md, DESIGN.md
```

Ignore `node_modules/`, `.next/`, `.turbo/`, `output/`, `tmp/`, `logs/`, `.impeccable/` and `artifacts/`; they hold build output or local scratch.

### Workspace package names
`@bikalpo-project/api`, `@bikalpo-project/auth`, `@bikalpo-project/db`, `@bikalpo-project/env`, `@bikalpo-project/config`. Apps import them as `workspace:*`. For example, the web app imports API types and shared lib functions directly from `@bikalpo-project/api/...`.

---

## 4. Running locally

### Hostnames (important)
Auth cookies are shared across subdomains, so the app must be opened on the `.localhost` hostnames, **not** `localhost:3001`:

| What | URL |
|---|---|
| Web (consumer/admin) | http://bikalpo.localhost:3001 |
| Shop portal | http://shop.bikalpo.localhost:3001 |
| Warehouse portal | http://warehouse.bikalpo.localhost:3001 |
| Delivery / Sales / B2B | `delivery.` / `sales.` / `b2b.` + `bikalpo.localhost:3001` |
| API | http://api.bikalpo.localhost:3000 (docs: `/docs`) |

### Commands (from repo root)
```bash
pnpm install
pnpm dev:server      # API: bun --hot, port 3000 (env: apps/server/.env)
pnpm dev:web         # Web: next dev --port 3001 --hostname bikalpo.localhost
pnpm dev             # both via turbo
pnpm dev:native      # Expo
pnpm check-types     # all packages
pnpm check-types:web # web and its deps (what CI runs)
```
On Windows PowerShell use `pnpm.cmd`. `.claude/launch.json` defines `web` and `server` preview configs.

### Env files (names only; never commit or print the values)
- `apps/server/.env`:
  - `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (=`http://api.bikalpo.localhost:3000` locally), `CORS_ORIGINS` (comma list)
  - `COOKIE_DOMAIN` (=`.bikalpo.localhost` locally), `NODE_ENV`
  - `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` / `_UPLOAD_PRESET`, `BARIKOI_API_KEY`, `DUMMY_OTP_ENABLED`
  - The schema is in `packages/env/src/server.ts`.
- `apps/web/.env.local`:
  - `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_AUTH_URL`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
  - `NEXT_PUBLIC_APP_SUBDOMAIN_URL`
  - `NEXT_PUBLIC_SHOP_SUBDOMAIN_URL`, `NEXT_PUBLIC_B2B_SUBDOMAIN_URL`, `NEXT_PUBLIC_WAREHOUSE_SUBDOMAIN_URL`, `NEXT_PUBLIC_DELIVERY_SUBDOMAIN_URL`, `NEXT_PUBLIC_SALES_SUBDOMAIN_URL`

> ⚠️ **The local `DATABASE_URL` points at the same Postgres database as live bikalpo.com.** Every write you make locally (test bookings, migrations, data fixes) changes production data. Do not run migrations, seeds, resets or bulk updates without explicit human approval. Prefer read-only queries.

---

## 5. Request flow

```
Browser ──► Next.js (apps/web) ──┬─ server components: oRPC client → API (lib/orpc/public-server.ts)
                                 └─ client components: TanStack Query + oRPC client (utils/orpc.ts)
                                          │
                                          ▼
                   Bun + Hono (apps/server/src/index.ts)
                   ├─ CORS (credentials, CORS_ORIGINS + *.bikalpo.localhost in dev)
                   ├─ /auth/*        → better-auth handler (packages/auth)
                   ├─ /rpc/*         → oRPC RPCHandler(appRouter)
                   ├─ /docs          → OpenAPI + Scalar UI
                   ├─ /*             → oRPC OpenAPIHandler (REST, routes declared per procedure)
                   ├─ /socket.io/*   → Socket.IO engine (apps/server/src/socket.ts; open-order realtime)
                   └─ timers: due open orders every 5s; To-Let rental reconciler hourly (production only)
                                          │
                                          ▼
                   packages/api (routers → services/helpers) ──► packages/db (Drizzle) ──► PostgreSQL
```

### Subdomain routing (apps/web/proxy.ts)
Next 16 calls `proxy.ts` instead of `middleware.ts`.
- **Rewrites:** `shop.` is rewritten to `/shop/...`, and likewise `warehouse.`, `delivery.`, `sales.` and `b2b.` to their own folders.
- **Redirects:** auth routes (`/login`, `/sign-up`, …) always redirect to the root domain.
- **Guards:** it checks the session cookie (`better-auth.session_token`, or the `__Secure-` variant in production) and a `user-role` cookie, which the auth after-hook sets for routing. Staff-only paths are `/dashboard` and `/deliveryman`.

---

## 6. API layer (packages/api)

- **Entry:** [`packages/api/src/index.ts`](../packages/api/src/index.ts) defines the procedure builders. Pick the narrowest one:
  - `publicProcedure` (no auth), `protectedProcedure` (any signed-in user)
  - Single role: `consumerProcedure`, `adminProcedure`, `salesmanProcedure`, `deliverymanProcedure`, `shopOwnerProcedure`, `warehouseProcedure`
  - `shopPortalProcedure`: shop owner or shop staff, permission-aware
  - Combined: `catalogRequesterProcedure`, `warehouseOrAdminProcedure`, `fulfillmentManagerProcedure`
- **Context:** `packages/api/src/context.ts`, which carries the session and realtime emitter.
- **Root router:** [`packages/api/src/routers/index.ts`](../packages/api/src/routers/index.ts) composes about 90 routers into `appRouter`. Clients call `orpc.<routerKey>.<procedure>`, for example `orpc.toLetUnitListing.getForUnit`.
- **Where code goes:**
  - `routers/*.ts`: procedure definitions, with Zod input, `.route({ method, path })` for REST, and auth.
  - `routers/helpers/*.ts`: domain helpers shared by routers, such as order lifecycle, SKU generation and To-Let rules.
  - `services/*.ts`: larger domain workflows: checkout, open-order matching, purchases, POS accounting, To-Let rent/lifecycle.
  - `lib/*.ts`: small pure modules also imported by web, such as To-Let categories, facilities, banner defaults, captcha and phone policy.
  - Root `src/*.ts`: shop authorization/roles, business registration, consumer price.
  - `scripts/`: one-off migrations or backfills.
- **Router groups:**

  | Group | Routers |
  |---|---|
  | Admin | `admin-*.ts` (applications, users, catalog, offers, invoices, marketing, areas, tickets, To-Let units, …) |
  | Catalog | `product`, `brand`, `category`, `catalog-approval-request`, `shop-product-config`, `admin-variant-option`, `admin-core-product` |
  | Orders | `customer`, `shop-owner`, `retailer-pos`, `retailer-offer`, `warehouse-*`, `deliveryman`, `salesman`, `returns`, `empty-pack-management` |
  | Finance | `finance`, `expense`, `payee`, `purchase*`, `supplier-payment`, `balance-sheet`, `profit-loss` |
  | Onboarding | `seller-application`, `warehouse-application`, `verified-user`, `user-invite`, `shop-staff`, `shop-role` |
  | Public | `landing`, `seller-directory`, `barikoi*`, `cloudinary` |
  | To-Let | see §10 |
  | Dev | `dev-otp` (simulated OTP reader) |

- **Tests:** colocated `*.test.ts` files (node:test style). Run one with `bun test <file>`. `*.integration.test.ts` files are opt-in via env flags and hit a database.

---

## 7. Database (packages/db)

- **Schema:** `packages/db/src/schema/*.ts`, about 100 files, re-exported from `schema/index.ts`. Import it as `@bikalpo-project/db/schema`, and the client as `db` from `@bikalpo-project/db`. Main areas:
  - Auth: `auth-schema.ts` (user, session, verification), `user-profile`
  - Catalog: `core-product`, `brand`, `product`, `product-variant`, `catalog-variant`, `variant-option`, `category`, `product-type`
  - Commerce: `order`, `cart`, `open-order-bid`, `invoice`, `payment`, `offer`, `retailer-offer`
  - Inventory: `inventory`, `stock-*`, `carton*`, `warehouse-*`
  - Finance: `journal-*`, `financial-ledger`, `finance-*`, `expense`, `wallet`
  - To-Let: `tolet-property`, `tolet-listing` (unit + listing), `tolet-booking`, `tolet-rental` (contracts, rent cycles), `tolet-banner`
- **Migrations:** `packages/db/src/migrations/NNNN_*.sql`, 0000 through **0090** at the time of writing.
  - ⚠️ The shared database's `__drizzle_migrations` journal is **behind the SQL files** (it stopped around 0079). Newer migrations were applied by hand. **Do not run `pnpm db:migrate` or `db:push` blindly.** Inspect what is already applied and ask a human.
- **Scripts:** `db:generate`, `db:migrate`, `db:push`, `db:studio`, `db:seed-accounting`, `db:seed-subscriptions`, `db:reset-product-flow`. Dev/backfill files live in `packages/db/src/*.ts`. Every one of them writes to the live database (see §4).
- **Spatial:** `spatial-helpers.ts` holds location and radius queries used by delivery and To-Let.

---

## 8. Auth and roles (packages/auth)

- **Config:** [`packages/auth/src/index.ts`](../packages/auth/src/index.ts) sets up better-auth with these pieces:
  - A phone-number plugin, plus `otp-store.ts` and `phone-identity.ts` for Bangladesh number normalisation (`+8801XXXXXXXXX`).
  - `crossSubDomainCookies` with `COOKIE_DOMAIN`. Cookies are `sameSite: lax` and not `secure` in development.
  - An after-hook that sets the `user-role` cookie.
- **OTP:** there is no SMS gateway yet. With `DUMMY_OTP_ENABLED`, the login OTP is simulated: the web reads it through the `dev-otp` router and auto-fills it.
- **Roles** (`permissions.ts`): `consumer`, `shop_owner`, `shop_staff`, `warehouse`, `salesman`, `deliveryman`, `admin`.
  - Seller vs buyer-only is a capability flag, not a role.
  - Shop staff get granular permissions (`shop-permissions.ts`, `shop-permission-catalog.ts`, `shop-staff-access.ts`).
- **Login security** (`login-security-policy.ts`): applies only to `shop_owner`. It provides single-device sessions and an auto logout (30 minutes by default).
- **Web client:** `apps/web/lib/auth-client.ts` (`authClient.useSession()`).

---

## 9. Web app (apps/web) map

```
apps/web/
├── app/                         Next App Router
│   ├── (public)/                consumer site: products, sellers, stores, offers, checkout,
│   │   │                        open-orders, about/terms/privacy/faqs/help-center
│   │   ├── account/             consumer account: orders, addresses, payments, open-orders,
│   │   │                        estimates, complaints, support, security, to-let/…
│   │   └── to-let/              public To-Let: landing, listings, [id], qr/[qrToken], reviews
│   ├── (auth)/login, @auth/(.)login    login page + intercepted modal
│   ├── (dashboard)/dashboard/   admin (admin/*: ~42 sections) + finance/reports/sales
│   ├── (retailer-storefront)/stores    public retailer storefronts
│   ├── shop/(management)/dashboard/*   shop portal (pos, products, stock, orders, finance, staff…)
│   ├── shop/(storefront)/*             shop-side storefront and ordering from warehouses
│   ├── warehouse/(management)/dashboard/*   warehouse portal (carton-tracking, supply, pos…)
│   ├── delivery/, deliveryman/, sales/, b2b/   other portals
│   ├── w/[slug]                 warehouse storefront
│   ├── apply-business, apply-warehouse, application-status, warehouse-application-status
│   └── layout.tsx               root layout (Poppins font, providers, third-party widget script)
├── components/
│   ├── features/<domain>/       feature UI (to-let, orders, product, stock, warehouse, admin, …)
│   ├── ui/                      shadcn/ui primitives
│   ├── layout/, shared/, storefront/, dashboard/, checkout/, …
├── hooks/                       TanStack/oRPC hooks per domain (use-to-let-*-api.ts, use-cart.tsx, …)
├── lib/                         domain utilities + their tests (to-let-marketplace.ts, public-data.ts,
│                                routes.ts, *-routing.ts, property-qr-pdf.ts, …)
├── lib/orpc/public-server.ts    server-side oRPC client (cached public reads)
├── utils/orpc.ts                browser oRPC client + TanStack utils (`orpc`, `client`)
├── schema/                      Zod form schemas (e.g. to-let-listing.schema.ts)
├── proxy.ts                     subdomain rewrites + auth gating
└── next.config.ts               image domains (Cloudinary etc.)
```

- **Conventions:**
  - Server components fetch public data through `lib/public-data.ts` or `getPublicOrpcClient(revalidate)`.
  - Client components use `useQuery(orpc.x.y.queryOptions(...))` hooks from `hooks/`.
  - Tailwind classes use theme tokens (`bg-primary`, `text-muted-foreground`, `border-border`). Don't hard-code colours.
  - Shared To-Let button and chip styles live in `components/features/to-let/to-let-button.ts`.
  - Mobile-only overrides sometimes live in CSS modules, such as `app/(public)/to-let/to-let-mobile.module.css` and `compact-listing-card.module.css`.

---

## 10. To-Let module (most recent active work)

### Concepts
- **Property:** owned by a consumer account; there is no separate login and no admin approval.
  - Public ID `PR-YYYY-NNNNNN`.
  - A permanent private `qrToken` powers the printed QR poster.
  - Status: `active` or `blocked`.
- **Unit:** a physical space inside a property, with ID `UNT-NNNNNN`.
  - Types: family flat, bachelor room, sublet, family/bachelor sub-let, shop, office, warehouse, garage, factory, other.
  - Status: vacant, booked, occupied, archived, …
- **Listing:** an advert for one unit, with ID `LST-NNNNNN`.
  - Status: draft → active → paused or closed. Visibility is `public` or QR-only.
  - Visible for 30 days after publish, then renewable.
  - Only vacant or occupied units are listable (`isToLetListableUnitStatus`).
- **Booking:** a tenant request, `BKG-…`. Once accepted it becomes a **rental contract**, with monthly rent cycles confirmed by owner OTP.
- **Leaving rules** (client-confirmed):
  - A tenant can leave on any day, and the contract ends on the last day of that month.
  - The tenant keeps access (details, dues, OTP) until the end of the next month.
  - The owner can post a new listing at any time, but a new tenant's contract cannot start before the 1st after the old one ends.
  - Code: `routers/helpers/tolet-leaving.ts`, `tolet-rental-lifecycle.ts`, `services/tolet-rental-lifecycle.ts`.
- **Alerts:** tenants save search alerts and get notified when a new listing matches (`services/tolet-alert-notifications.ts`, `tolet-saved-alerts.ts`).
- **Contact verification:** a property's contact phone is verified by a server-drawn 6-digit **captcha**, not SMS.
  - The answer never reaches the browser. It is hashed, allows 5 attempts and expires after 5 minutes, and the resulting proof can be used once.
  - Files: `lib/tolet-property-captcha.ts`, `tolet-property-phone*.ts`.
  - It is required at property registration, on contact-number change, and at listing form Step 3.
  - It is gated by `DUMMY_OTP_ENABLED` outside development.

### Key files

| Layer | Files |
|---|---|
| API routers | `tolet-property.ts`, `tolet-unit-listing.ts` (also public listing pages + QR), `tolet-booking.ts`, `tolet-rental.ts`, `tolet-owner-rental-history.ts`, `tolet-banner.ts`, `tolet.ts`, `admin-tolet-unit.ts` |
| API helpers / services | `routers/helpers/tolet-*.ts`, `services/tolet-*.ts`, `lib/tolet-*.ts` |
| DB | `schema/tolet-property.ts`, `tolet-listing.ts`, `tolet-booking.ts`, `tolet-rental.ts`, `tolet-banner.ts` |
| Public pages | `app/(public)/to-let/page.tsx` (landing), `listings/`, `listings/[listingCode]`, `qr/[qrToken]`, `reviews/` |
| Owner pages | `app/(public)/account/to-let/…` (properties, units, listing wizard, bookings, alerts) |
| Components | `components/features/to-let/` (landing hero, category scroller, listing cards, location explorer, community reviews, detail layout) and `components/features/to-let/property/` (registration wizard, unit form, listing form, QR card/poster, phone verification) |
| Hooks / lib | `hooks/use-to-let-property-api.ts`, `use-to-let-booking-api.ts`, `use-to-let-rental-api.ts`; `lib/to-let-marketplace.ts`, `lib/public-data.ts`, `lib/property-qr-pdf.ts` |
| Admin | `app/(dashboard)/dashboard/admin/to-let/` (units, banners) |

### Landing page order (`/to-let`)
1. Hero banner plus the Type/Area search card
2. My Alerts button and category chips
3. 12 listing cards
4. To-Let Alert section
5. Location Intelligence
6. Tenant Journey
7. Stats
8. Community reviews
9. "Property নিবন্ধন" call to action

The layout follows the client's reference HTML.

---

## 11. Mobile app (apps/native)

- **Routing:** Expo Router in `app/`: `(tabs)/`, `account/`, `login.tsx`, `register.tsx`, `onboarding.tsx`, `product-detail.tsx`.
- **UI:** Tamagui (`tamagui.config.ts`).
- **Shared code:** it uses the same oRPC API and better-auth (`@better-auth/expo`) as the web.
- **Env:** `packages/env/src/native.ts`.
- It covers less than the web app; most portals are web-only.

---

## 12. Build, CI and deployment

- **CI** (`.github/workflows/ci.yml`): `pnpm install --frozen-lockfile`, then type-check and build the web app (`--filter=web...`) and the server (`--filter=server...`).
- **Docker:** `Dockerfile` builds the API on `oven/bun`. `Dockerfile.web` builds the web app on `node:20-alpine`. Both serve on port 3000 inside the container.
- **Git:**
  - The upstream is `Shorno/bikalpo-project` (remote `shorno-write`), and PRs go to `main`. `origin` is a personal mirror.
  - The working branch is usually `lo-let-fixes`.
  - Commits should come from the `MohammadRayhanHabib` account.
- **Production:** `bikalpo.com` (web), `api.bikalpo.com` (API) and the portal subdomains. The rental reconciler and other timers run only when `NODE_ENV=production`.

---

## 13. Documentation index

- `docs/adr/`: decisions (atomic open orders, owner-scoped fulfillment, self-pickup, retailer POS).
- `docs/tolet-*.md`: one note per To-Let feature (alerts, banner, QR poster, phone verification, leave, payments, location data, …).
- `docs/research/`, `docs/*-research.md`: research behind product ID, catalog, retailer, store and footer features.
- `docs/pending/*.sql`: SQL that was prepared but not yet applied.
- `context/`: older notes (pricing, delivery flow, manual purchase test plan).
- `rayhandev-docs/README.md`: To-Let milestone handoff (M1–M4).

---

## 14. Known issues and gotchas

1. **Old QR posters:** posters downloaded before PR #168 encode `https://app.bikalpo.com/to-let/qr/<token>`. That host returns 503.
   - The fix needs infrastructure: point or redirect `app.bikalpo.com` to `bikalpo.com`.
   - Production `NEXT_PUBLIC_APP_SUBDOMAIN_URL` should be `https://bikalpo.com`; shop and warehouse storefront links still use it.
2. **Shared database:** local equals live. See §4 and §7.
3. **Migration journal drift:** see §7.
4. **Wrong hostname:** opening `localhost:3001` instead of `bikalpo.localhost:3001` breaks cookies, and you get logged out right after login.
5. **No SMS gateway:** login OTP is simulated, and property contact uses the captcha.
6. **Third-party script:** the root layout loads the external feedback widget `ekhanemark w.js`. Keep exactly one tag, and change its `data-project` id only when asked.
7. **Pre-existing type errors:** several `packages/api` test files fail `tsc`. The web app type-checks clean.

---

## 15. Rules for AI assistants working here

- **Never write to the database** (migrations, seeds, updates) without explicit human approval. Treat it as production.
- **Never print or commit secrets.** Reference env variable names only.
- **Never commit** `.claude/launch.json`, `output/`, `.impeccable/`, `tmp/`, `logs/` or personal notes.
- **Before starting**, fetch `shorno-write` and bring your branch up to date with `main`. **Before finishing**, run `pnpm check-types:web` (and the server or api checks if you touched them).
- **Respect the scopes:**
  - Pick the narrowest oRPC procedure.
  - Every To-Let query must stay owner-scoped.
  - Public endpoints must not leak private fields, such as hidden prices, `qrToken` or owner phone on QR-only listings.
- **Reuse what exists:**
  - Use the glossary terms in `CONTEXT.md`.
  - Use theme tokens and the shared To-Let button styles.
  - Reuse existing helpers before adding new ones.
- **Mobile first:** many users are on phones. Check layouts at 375–390px, and keep text rows from wrapping by using `min-w-0` + `truncate` on labels and `shrink-0` + `whitespace-nowrap` on controls.
- **Talking to the project owner (Rayhan):** reply in Bangla script (বাংলা) when they write in Bangla or Banglish.
