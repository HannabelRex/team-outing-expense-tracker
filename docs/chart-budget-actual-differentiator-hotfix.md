# Chart Budget vs Actual Differentiator Hotfix

## Purpose

This hotfix improves readability for Budget/Estimated vs Actual bars in the Dashboard and Analytics charts.

Previously, the bars could look too similar depending on the selected theme and browser rendering. Users had to look carefully to distinguish planned budget from actual spend, which is not exactly the dream when financial data is involved.

## Changes

- Dashboard category spending chart now uses theme-aware chart colors.
- Estimated budget bars now use a diagonal striped pattern with an outline.
- Actual spend bars now use a solid theme color.
- Legend labels were renamed for clarity:
  - Estimated budget
  - Actual spend
- Axis, grid, legend, and tooltip styling now follow the active theme in the dashboard category chart.
- Analytics Budget vs Actual chart uses the same visual differentiator.

## Scope

Updated file:

```text
client/src/App.jsx
```

No backend routes, database changes, Supabase changes, Render variables, or Vercel variables are required.

## Testing

1. Sign in as Admin or Finance.
2. Open Dashboard.
3. Confirm Category spending chart shows striped Estimated budget bars and solid Actual spend bars.
4. Open Analytics.
5. Confirm Budget vs actual by category uses the same differentiator.
6. Switch themes from the header.
7. Confirm the chart colors update while the striped/solid distinction remains clear.
