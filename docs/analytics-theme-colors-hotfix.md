# Analytics Theme Colors Hotfix

## Summary

This hotfix connects the Analytics dashboard charts to the selected app theme.

Previously, the app shell changed when users selected a theme, but the Analytics charts still rendered mostly in default black/gray Recharts colors. The Analytics tab now derives chart fills, progress bars, grid lines, axis labels, legends, and tooltips from the active theme.

## What changed

- Added chart theme helpers in `client/src/App.jsx`.
- Passed the active theme into `AnalyticsDashboard`.
- Applied theme colors to:
  - Budget utilization progress bar
  - Budget vs actual category chart
  - Spend share pie chart
  - Participant contribution chart
  - Expense approval mix chart
  - Chart legends, grid lines, axis labels, and tooltips

## Access

No role or backend access change. The theme picker remains available to all signed-in users.

## Backend impact

None.

## Environment variables

No new Render or Vercel environment variables are required.

## Test checklist

1. Sign in as Admin or Finance.
2. Open Analytics.
3. Switch each theme from the top header.
4. Confirm charts update colors immediately.
5. Refresh the page and confirm the selected theme persists.
6. Confirm Analytics values remain unchanged.
