# Durable web contribution and payment audit

Date: 2026-09-13  
Repository: `Shorno/bikalpo-project`  
Audited branch: `feat/more-ui-updates-v2`  
Audited commit: `895e04d56e281b9e6cc73d0b5cf1d0927135c69c`  
Default reference: `origin/main` at `febf5055cafcd519ad7f7143205f65fb53f537fd`

Evidence is limited to Git objects, tracked source, repository documentation, and checks run against this checkout.

## Executive decision

**Shorno has the largest durable web contribution.** Shorno owns 257,880 of 377,630 current nonblank web-product lines, or **68.29%**. Iftakhar Rahat is second at **21.40%** and leads non-merge commits touching the included web scope.

For an engineering payment pool, a transparent provisional split is:

| Contributor | Provisional payment share | Payment from pool `P` |
|---|---:|---:|
| **Shorno** | **63.84%** | `P × 0.6384` |
| **Iftakhar Rahat** | **27.15%** | `P × 0.2715` |
| **Mohammad Rayhan Habib** | **4.87%** | `P × 0.0487` |
| **Rakib Hossain** | **2.15%** | `P × 0.0215` |
| **Robiul Hassan** | **1.99%** | `P × 0.0199` |

This is a reproducible code-contribution model, not a legal finding. Planning, design, support, management, hours, employment terms, and off-repository work are not visible in Git and require separately documented adjustments.

### Payment formula

The owner's priority is code that still exists in the working product:

```text
payment score =
  60% × current surviving web-code share
+ 25% × filtered web-code churn share
+ 15% × web-touching non-merge commit share
```

| Contributor | Current code | Churn | Web commits | Result |
|---|---:|---:|---:|---:|
| Shorno | 68.2891% | 70.0508% | 35.6730% | **63.8371%** |
| Iftakhar Rahat | 21.4024% | 21.1753% | 60.1156% | **27.1526%** |
| Mohammad Rayhan Habib | 5.8428% | 4.7829% | 1.1561% | **4.8748%** |
| Rakib Hossain | 2.3716% | 2.1057% | 1.3212% | **2.1476%** |
| Robiul Hassan | 2.0941% | 1.8853% | 1.7341% | **1.9879%** |

If payment should reflect only code still present, use the current-code shares instead.

## Web-only scope

Included: `apps/web`, `apps/server`, `packages/api`, `packages/auth`, `packages/config`, `packages/db`, `packages/env`, web-supporting scripts, and root web/build configuration. This includes frontend, APIs, authorization, database schemas, accounting rules, and the server required by the web product. See [`package.json`](../../package.json), [`apps/web/package.json`](../../apps/web/package.json), and [`CONTEXT.md`](../../CONTEXT.md).

Excluded: `apps/native`, public/static/binary assets, docs, artifacts, locks, generated database migrations and snapshots, build output, caches, dependencies, and the large static `property-location-data.json` dataset. This prevents generated or downloaded noise from deciding payment.

## Current surviving ownership

Current nonblank lines were attributed using whitespace-insensitive, move-aware Git blame at the fixed `HEAD`.

| Rank | Contributor | Surviving lines | Share |
|---:|---|---:|---:|
| 1 | **Shorno** | **257,880** | **68.2891%** |
| 2 | **Iftakhar Rahat** | **80,822** | **21.4024%** |
| 3 | **Mohammad Rayhan Habib** | **22,064** | **5.8428%** |
| 4 | **Rakib Hossain** | **8,956** | **2.3716%** |
| 5 | **Robiul Hassan** | **7,908** | **2.0941%** |
|  | **Total** | **377,630** | **100.0000%** |

Blame measures surviving text, not difficulty or business value.

## Contribution by web feature

Percentages are ownership inside that feature. Each path is assigned once; shared services make these categories useful but heuristic.

| Feature bundle | Shorno | Iftakhar | Rayhan | Rakib | Robiul | Total |
|---|---:|---:|---:|---:|---:|---:|
| Warehouse & supply | 65,796 (72.25%) | 24,983 (27.43%) | 3 | 3 | 285 | 91,070 |
| Catalog, marketplace & ordering | 46,208 (82.43%) | 6,710 (11.97%) | 2 | 3,072 (5.48%) | 65 | 56,057 |
| Retail operations & POS | 42,898 (76.55%) | 12,285 (21.92%) | 9 | 442 | 405 | 56,039 |
| Administration & operations | 35,946 (77.09%) | 4,552 (9.76%) | 7 | 1,221 | 4,904 (10.52%) | 46,630 |
| Finance, billing & estimates | 14,372 (36.40%) | 25,016 (63.35%) | 0 | 0 | 98 | 39,486 |
| Shared platform & public UI | 29,921 (76.80%) | 3,372 | 795 | 3,449 | 1,423 | 38,960 |
| Delivery & returns | 19,249 (80.74%) | 3,866 | 0 | 5 | 720 | 23,840 |
| To-Let marketplace | 327 | 0 | 21,223 (95.14%) | 756 | 0 | 22,306 |
| Identity & access | 3,163 (97.56%) | 38 | 25 | 8 | 8 | 3,242 |

### Contributor interpretation

- **Shorno** leads seven of nine broad bundles: warehouse/supply, catalog/ordering, retail/POS, administration, shared platform/public UI, delivery/returns, and identity/access.
- **Iftakhar Rahat** owns most finance/billing/estimates (63.35%) and large secondary shares of warehouse/supply and retail/POS.
- **Mohammad Rayhan Habib** owns 95.14% of the To-Let marketplace: property, listing, booking, and rental work.
- **Rakib Hossain** contributes mainly customer-home/catalog work, shared/public UI, administration, and To-Let administration.
- **Robiul Hassan** contributes mainly referrals, rewards, invitations, administration, and delivery/returns.

## Strongest untouched-survivor evidence

For this strict test, every current nonblank line in the listed files must blame to the named contributor and complete file history must contain no other human author.

| Contributor | Strict survivor bundle | Files | Lines | Primary history evidence |
|---|---|---:|---:|---|
| **Shorno** | Warehouse estimates, warehouse damage API, core-product configuration | 3 | **4,789** | [`3ee99e4d`](https://github.com/Shorno/bikalpo-project/commit/3ee99e4da926963413fded0f231c8c8730bc8c85) through [`7abfbe02`](https://github.com/Shorno/bikalpo-project/commit/7abfbe029c3f9fe52c3c949ee4e6b61e7b14e708) |
| **Iftakhar Rahat** | Finance/daybook reports and dialogs | 6 | **7,199** | [`25b29940`](https://github.com/Shorno/bikalpo-project/commit/25b29940f23d46aac2821f2f2c8d99bf541d4571) through [`daf3fb7b`](https://github.com/Shorno/bikalpo-project/commit/daf3fb7b7e3d79ba0277a6ec430fe65a6a6672e8) |
| **Mohammad Rayhan Habib** | To-Let property, booking, and rental core | 7 | **7,174** | [`d8734ee7`](https://github.com/Shorno/bikalpo-project/commit/d8734ee7b2f8f35c9b17dc224c0a90ad851008fe) through [`bd84352a`](https://github.com/Shorno/bikalpo-project/commit/bd84352a45b50c0b732a503275007dc68666087b) |
| **Rakib Hossain** | Customer home-tab management and presentation | 4 | **1,315** | [`9a6771d7`](https://github.com/Shorno/bikalpo-project/commit/9a6771d714fee3bda57690c287bbbc2b2c578373) |
| **Robiul Hassan** | Referral, rewards, and invitation system | 8 | **1,806** | [`98f7f022`](https://github.com/Shorno/bikalpo-project/commit/98f7f02278e5d1eaa41c1680769ac0cd8140cb16) through [`b9f5060f`](https://github.com/Shorno/bikalpo-project/commit/b9f5060fad935f4ee24c526c082f5217add08579) |

These are conservative examples, not complete ownership lists. A later edit does not prove an earlier defect; it may add a requirement. Single-author survival proves attribution, not freedom from every runtime defect.

### Files in the strict bundles

- Shorno: `apps/web/app/warehouse/(management)/dashboard/estimates/page.tsx`, `packages/api/src/routers/warehouse-damage.ts`, and `apps/web/components/features/product/components/core-product-config-form.tsx`.
- Iftakhar Rahat: `apps/web/components/dashboard/reports/financial-report-pages.tsx`, `apps/web/components/dashboard/daybook/daybook-kpi-page.tsx`, `apps/web/components/dashboard/finance/transactions-page.tsx`, `apps/web/components/dashboard/daybook/daybook-money-movement-dialog.tsx`, `apps/web/components/dashboard/finance/profit-loss-report.tsx`, and `apps/web/components/dashboard/finance/balance-sheet-report.tsx`.
- Mohammad Rayhan Habib: `apps/web/components/features/to-let/property/unit-details-client.tsx`, `listing-form.tsx`, `property-registration-wizard.tsx`, `packages/api/src/routers/tolet-property.ts`, `tolet-booking.ts`, `tolet-rental.ts`, and `apps/web/components/features/to-let/booking/booking-details-client.tsx`.
- Rakib Hossain: `apps/web/components/admin/customer-home-tabs/customer-home-tabs-client.tsx`, `packages/api/src/routers/admin-customer-home-tab.ts`, `apps/web/components/features/home/customer-home-product-tabs.tsx`, and `packages/db/src/schema/customer-home-tab.ts`.
- Robiul Hassan: both general/shop `dashboard/referral/referral-client.tsx` files; `packages/api/src/routers/admin-reward.ts`, `user-invite.ts`, and `admin-invite-tracking.ts`; and `packages/db/src/schema/reward.ts`, `admin-invite.ts`, and `invite.ts`.

## Current branch increment

The branch is 0 commits behind and 2 ahead of `origin/main`, both by Shorno: [`5c89b8d7`](https://github.com/Shorno/bikalpo-project/commit/5c89b8d71819c1d33a3dd7588835879765468c2e) and [`895e04d5`](https://github.com/Shorno/bikalpo-project/commit/895e04d56e281b9e6cc73d0b5cf1d0927135c69c).

The combined text diff is 11 files, 81 insertions, and 1,160 deletions. Under the nonblank web-code policy, Shorno's surviving ownership decreases by 348 lines; every other contributor is unchanged.

| Contributor | `origin/main` | Current | Change |
|---|---:|---:|---:|
| Shorno | 258,228 | 257,880 | **-348** |
| Iftakhar Rahat | 80,822 | 80,822 | 0 |
| Mohammad Rayhan Habib | 22,064 | 22,064 | 0 |
| Rakib Hossain | 8,956 | 8,956 | 0 |
| Robiul Hassan | 7,908 | 7,908 | 0 |
| **Total** | **377,978** | **377,630** | **-348** |

The branch is 100% Shorno-authored but primarily simplifies code. Deleting obsolete complexity can improve a product, so raw net lines are not a value measure.

## Historical activity

The reachable history has 1,627 commits and 1,452 non-merges. Payment uses only the 1,211 non-merge commits touching included web paths.

| Contributor | All | Non-merge | Web commits | Web share | Active days | First-last |
|---|---:|---:|---:|---:|---:|---|
| Iftakhar Rahat | 972 | 935 | 728 | 60.1156% | 57 | 2026-03-14 - 2026-08-25 |
| Shorno | 592 | 465 | 432 | 35.6730% | 109 | 2026-02-06 - 2026-09-13 |
| Robiul Hassan | 23 | 21 | 21 | 1.7341% | 7 | 2026-02-10 - 2026-06-05 |
| Rakib Hossain | 20 | 17 | 16 | 1.3212% | 6 | 2026-02-11 - 2026-03-20 |
| Mohammad Rayhan Habib | 20 | 14 | 14 | 1.1561% | 11 | 2026-07-30 - 2026-09-13 |

Filtered non-merge web churn is:

| Contributor | Additions + deletions | Share |
|---|---:|---:|
| Shorno | 628,791 | 70.0508% |
| Iftakhar Rahat | 190,074 | 21.1753% |
| Mohammad Rayhan Habib | 42,932 | 4.7829% |
| Rakib Hossain | 18,901 | 2.1057% |
| Robiul Hassan | 16,923 | 1.8853% |
| **Total** | **897,621** | **100.0000%** |

Churn counts rework repeatedly, so it receives only 25% weight.

## Identity normalization

The repository has no `.mailmap`.

| Person | Consolidated identities |
|---|---|
| Shorno | `Shorno` and `shorno`, both `fb.shorno@gmail.com` |
| Iftakhar Rahat | `IftakharRahat <iftakharrahat71@gmail.com>`; `Iftakhar Rahat <113662310+IftakharRahat@users.noreply.github.com>` |
| Robiul Hassan | `Robiul Hassan <robiulhassan993@gmail.com>`; `MD. ROBIUL HASSAN <114005673+RobiulSahib@users.noreply.github.com>` |
| Rakib Hossain | `bnesa` and `MD RAKIB HOSSAIN`, both using the `mdrakib719` GitHub identity |
| Mohammad Rayhan Habib | `MohammadRayhanHabib <177920153+MohammadRayhanHabib@users.noreply.github.com>` |

The Copilot bot is not a human payment recipient. Merge commits are excluded from effort scoring.

## Verification and limits

- `pnpm check-types:web`: **passed**.
- `pnpm build:web`: **passed**; API `ECONNREFUSED` messages during page-data collection were handled rather than failing the build.
- Web-scope Bun tests: **407 passed, 23 skipped, 8 environment-loader errors**.

The type check and production build show that current web code compiles and integrates. Hundreds of tests pass, but the suite is not entirely green and no deployed E2E or live-database smoke test was completed. The strict bundles are therefore current single-author survivors in a buildable web product, not fully production-certified features.

## Confidence and caveats

| Finding | Confidence | Reason |
|---|---|---|
| Identity/commit counts | High | Direct Git author, email, and parent data |
| Current blame | High for textual attribution | Fixed commit, whitespace ignored, moves detected |
| Feature ownership | Medium-high | Current paths; shared services can cross boundaries |
| Strict survivor bundles | High | Current blame plus complete file-history author sets |
| Whole-product stability | Medium | Build/type check pass; eight test environment errors; no deployed E2E |
| Exact payment entitlement | Medium-low | Non-code work and contracts are absent from Git |

## Reproduction

```powershell
git branch --show-current
git rev-parse HEAD
git status --porcelain=v1
git rev-list --left-right --count origin/main...HEAD
git log --no-merges origin/main..HEAD --format='%H`t%aN`t%aE`t%s'
git diff --shortstat origin/main...HEAD
git shortlog -sne HEAD
git rev-list --count HEAD
git rev-list --count --no-merges HEAD
git log --no-merges --format='@@@%H%x09%aI%x09%aN%x09%aE%x09%s' --numstat HEAD
git blame --line-porcelain -w -M HEAD -- <path>
git log --format='%H%x09%aN%x09%aE%x09%s' -- <path>
pnpm check-types:web
pnpm build:web
bun test apps/web packages/api/src packages/auth/src packages/db/src
```

Before payment, confirm the pool covers code only, document non-code adjustments, choose the weights, resolve the eight test environment errors, and record the pool amount plus audited commit so everyone can reproduce the result.
