# Dashboard KPI Card Convention

Use this rule when creating or refactoring KPI cards in dashboard pages.

## Source Of Truth

- Use `apps/web/components/dashboard/dashboard-kpi-card.tsx`.
- Prefer `DashboardKpiGrid` for KPI layouts.
- Prefer `DashboardKpiCard` for every dashboard KPI card.
- Do not create one-off KPI card markup inside pages unless the shared component cannot represent the required state.

## Card Anatomy

Each KPI card should follow this structure:

1. Header row:
   - left side: icon bubble + KPI label/trend text
   - right side: overflow menu or status badge
2. Large metric value:
   - use tabular numeric styling
   - keep it visually dominant
3. Supporting footer:
   - short label and value only
   - do not repeat the same noun twice
   - example: `Last 7 Days: 45`, not `Last 7 Days: 45 Orders`
4. Optional sparkline:
   - render only when real time-series data exists
   - never use generated or decorative fake chart data

## Component API

Use these props instead of custom markup:

```tsx
<DashboardKpiCard
  label="Direct Orders"
  value={directOrderCount.toLocaleString()}
  icon={<ShoppingCart />}
  tone="red"
  active={source === "direct"}
  disabled={false}
  badge={undefined}
  onClick={() => setSource("direct")}
  trend={{
    value: "+18%",
    label: "vs Previous 7 Days",
    direction: "up",
  }}
  footer={{
    label: "Last 7 Days",
    value: directLastSevenDays.toLocaleString(),
  }}
  chartData={directTrend}
/>
```

Only pass `chartData` when it is real API-derived series data shaped as:

```ts
type DashboardKpiChartPoint = {
  label: string;
  value: number;
};
```

## Chart Rule

- Use the shared `DashboardKpiSparkline` through `DashboardKpiCard`.
- The sparkline must use the existing shadcn chart wrappers from `@/components/ui/chart`.
- The underlying chart library should be Recharts.
- If an API only returns aggregate counts, omit `chartData`.
- Do not invent placeholder chart points to make a card look richer.

## Grid Rule

Use `DashboardKpiGrid` for KPI groups:

```tsx
<DashboardKpiGrid>
  {cards.map((card) => (
    <DashboardKpiCard key={card.label} {...card} />
  ))}
</DashboardKpiGrid>
```

The shared grid is responsible for responsive behavior. On wide dashboard screens, five KPI cards should fit in a single row when there are five cards.

## Tone Rule

Use restrained tones. Current allowed tones:

- `slate` for all/default summaries
- `red` for direct/order urgency
- `blue` for user/salesman/field flow
- `violet` for estimate/quote flow
- `amber` for pre-order/time-based flow
- `emerald` for positive financial or success states

Do not introduce new KPI tone colors unless the shared component supports them and the page has a clear semantic need.

## Interaction Rule

- Clickable cards may use `onClick` or `href`.
- Disabled cards must not be interactive.
- Disabled future states should show a clear badge such as `Coming soon`.
- Selection should be represented with `active`, not custom page-level borders.
- Preserve the page's existing filter/query behavior when replacing old KPI cards.

## Copy Rule

- Keep labels short: `All Orders`, `Direct Orders`, `Net Revenue`.
- Keep trend labels consistent: `vs Previous 7 Days`, `vs Last Month`.
- Keep footer labels concise: `Last 7 Days`, `This Month`.
- Avoid duplicated wording between footer label and value.
- Prefer formatted values in the page layer before passing them to the component.

## Current Reference Implementation

The warehouse order management page is the reference implementation:

- `apps/web/app/warehouse/(management)/dashboard/order-management/page.tsx`
- `apps/web/components/dashboard/dashboard-kpi-card.tsx`

When another dashboard needs KPI cards, start from this pattern and extend the shared component only when the new requirement should apply across dashboard pages.
