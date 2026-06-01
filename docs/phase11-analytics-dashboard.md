# Phase 11 - Analytics Dashboard

Phase 11 adds a dedicated Analytics tab for Admin and Finance users.

## Goal

Turn existing outing data into quick visual insight without changing the backend data model.

## Access rules

| Role | Analytics tab |
|---|---|
| Admin | Visible |
| Finance | Visible |
| Member | Hidden |

Members continue to use Dashboard and Reports for assigned-event information.

## Included analytics

- Submitted spend
- Approved spend
- Pending review amount
- Budget usage percentage
- Top spending category
- Top contributor
- Receipt coverage percentage
- Budget utilization progress bar
- Budget versus actual by category
- Spend share by category
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

No backend route or environment variable changes are required for this phase.

The Analytics tab uses data already returned by `/api/bootstrap`:

- current event details
- dashboard summary
- category spending
- participant balances
- expenses
- visible event summaries

## Testing checklist

### Admin

- Sign in as Admin.
- Confirm Analytics tab is visible.
- Confirm overview cards load.
- Confirm category charts load.
- Confirm participant chart loads.
- Confirm event comparison table lists visible events.

### Finance

- Sign in as Finance.
- Confirm Analytics tab is visible.
- Confirm Roles tab remains hidden.
- Confirm analytics values match Dashboard and Reports.

### Member

- Sign in as Member.
- Confirm Analytics tab is hidden.
- Confirm Dashboard, Reports, and Inbox still work as before.

### Data checks

- Approved spend should equal the sum of approved expenses.
- Pending review should equal the sum of pending expenses.
- Submitted spend should include approved, pending, and rejected expenses.
- Budget used percentage should be based on event budget versus dashboard total spent.
- Receipt coverage should equal expenses with receipts divided by total expenses.
