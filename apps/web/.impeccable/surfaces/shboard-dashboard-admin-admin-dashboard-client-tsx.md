---
version: 1
slug: "shboard-dashboard-admin-admin-dashboard-client-tsx"
primary_target: "apps/web/app/(dashboard)/dashboard/admin/admin-dashboard-client.tsx"
related_targets: ["apps/web/app/(dashboard)/dashboard/admin/page.tsx"]
---

# Admin dashboard overview

**Mode:** Operate. Help administrators scan live user and order performance within the existing admin shell.
**Scope:** Replace this route's dashboard content only; retain surrounding navigation, shell, and established design system.

## Composition and copy

- The supplied document establishes layout and metric labels only. Omit its reference-only Admin Dashboard / KPI View and Primary KPI Blocks headings, ASCII rules, brackets, and emoji.
- Use `Today Overview` as the page heading and retain the live `Last Updated` timestamp.
- Stack `Users Performance` above `Orders Performance`; each header has a shared `View Report` button and each panel has independent `Daily`, `Monthly`, and `Yearly` controls.
- Users: `Total Users` / `User Growth`; then `New Users` / `Active Users` and `Inactive` / `Suspended`; chart caption `USER GROWTH`.
- Orders: `Total Orders` / `Order Growth`; `Completed` at left with the right position empty, then `Pending` / `Cancelled`; chart caption `ORDER TREND`.
- Inherit the project typography. Use shared Card, Button, and ToggleGroup components, rounded corners, semantic borders and muted surfaces, Lucide icons, and primary-blue unfilled Recharts curves. Reserve monospace for numeric data. Preserve the two metric columns and responsive panel order.

## Data and behavior

- Every metric and chart bucket comes from live database aggregates through `dashboard.getPerformance`, using one read-only snapshot; no demo series or fabricated values.
- Total Users, Total Orders, and account/order status counts are all-time values. New Users counts registrations in the selected current period to date.
- Inactive means business accounts pending approval under current user-management rules; Suspended means banned accounts; Active Users excludes both groups.
- Completed means delivered orders. Pending includes every open order state, excluding delivered, cancelled, and returned. Returned remains included in Total Orders and appears only in View Report.
- Daily, Monthly, and Yearly compare elapsed current-period registrations/orders against matching elapsed time in the previous period, capped at its end. Chart windows contain 30 days, 12 months, and 5 years respectively.
- Use the Bangladesh calendar (`Asia/Dhaka`) for boundaries and timestamps. An undefined percentage baseline displays `—`; zero activity in both periods is 0%.
- View Report exposes exact bucket counts, metric definitions, and current/comparison date ranges. Periods default to Daily and refresh every minute.
- Preserve loading, zero-activity, unavailable-data, and retry states; refresh failure retains the last successful snapshot and reports it explicitly.

## Evidence

- Visual authority: existing admin performance panels, shared UI components, and DESIGN.md.
- The supplied wireframe is a structural reference only.
