# Team Outing Expense Tracker - Phase 11 Analytics Dashboard

This package upgrades the Team Outing Expense Tracker with a new Admin/Finance Analytics tab.

## Phase 11 summary

The app now includes a dedicated Analytics dashboard that turns existing outing data into useful visual insight.

Key additions:

- Analytics tab for Admin and Finance users
- Member users do not see the Analytics tab
- Submitted, approved, pending, and rejected spend summary
- Budget utilization percentage and progress bar
- Top category and top contributor cards
- Receipt coverage percentage
- Budget versus actual category chart
- Category spend share chart
- Participant paid versus owed chart
- Expense approval mix chart
- Event comparison table across visible events

## Files changed

```text
client/src/App.jsx
README.md
docs/phase11-analytics-dashboard.md
```

## Backend changes

No backend changes are required for this phase.

The Analytics tab uses existing data from `/api/bootstrap`, including current event details, dashboard calculations, expenses, category spending, participant balances, and visible event summaries.

## Deploy steps

```powershell
cd C:\Users\ksath\Downloads\team-outing-expense-tracker-mobile-pwa\team-outing-expense-tracker

git status

git add -A

git commit -m "Add analytics dashboard"

git push origin main
```

Vercel should redeploy the frontend automatically after the push. Render does not need a backend environment change for Phase 11.

## Testing checklist

1. Sign in as Admin and confirm the Analytics tab is visible.
2. Sign in as Finance and confirm the Analytics tab is visible while Roles remains hidden.
3. Sign in as Member and confirm the Analytics tab is hidden.
4. Compare Analytics totals against Dashboard and Reports.
5. Confirm charts render on desktop and mobile.
6. Confirm event comparison table shows visible events.
