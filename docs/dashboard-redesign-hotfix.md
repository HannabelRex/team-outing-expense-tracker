# Dashboard UX Redesign Hotfix

This hotfix redesigns the Dashboard first screen so the most important outing finance status is visible at a glance instead of spreading repeated budget, collection, and fund-pool cards across the top of the page.

## What changed

- Added a smart Event health banner that summarizes budget status, pool balance, collection status, and final closure status in one sentence.
- Replaced the duplicated top cards with four icon-based KPI cards:
  - Total budget
  - Total spent
  - Pool balance
  - Final closure progress
- Added a Financial flow section showing the money journey:
  - Budget planned
  - Collected
  - Spent
  - Remaining
- Added progress bars for:
  - Budget usage
  - Collection progress
  - Pool usage
- Added a Next action card that recommends the most relevant next step, such as reviewing pending expenses, recording pending collections, calculating final closure, closing pending final closure items, or exporting the final report.
- Added a Quick status card for supporting metrics without overwhelming the first screen.
- Kept Category spending and Participant balances lower on the dashboard.

## Technical notes

This is a frontend-only dashboard layout update in `client/src/App.jsx`. It does not add backend routes, database changes, or environment variables.

## Validation

- Frontend JSX parse validation passed with TypeScript.
- Existing backend validation and logic tests should be run before deployment.
