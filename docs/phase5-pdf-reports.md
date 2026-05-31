# Phase 5 - PDF Report Export

Phase 5 adds authenticated PDF report exports for each outing event.

## What is included in the PDF

- Event name, date, location, organizer, and status
- Total budget, planned budget, total spent, and remaining budget
- Category-wise planned vs actual spending
- Participant-wise paid, owed, and net balance
- Settlement summary
- Expense list
- Receipt references
- Developer signature footer

## Deployment notes

Render installs the new `pdfkit` dependency from `server/package.json`. Keep the Render build command as:

```bash
npm install --no-package-lock --registry=https://registry.npmjs.org
```

The frontend download buttons use authenticated fetch requests instead of plain links, so PDF and CSV exports work with Phase 3 authentication enabled.

## Health check

After deploying the backend, `/api/health` should include:

```json
"pdfReports": "enabled"
```

## Test flow

1. Sign in as Admin, Finance, or an assigned Member.
2. Open the Reports tab.
3. Click Export PDF.
4. Confirm a PDF downloads.
5. Open the PDF and confirm event details, totals, participants, settlements, expenses, receipt references, and signature are present.
6. Click Export CSV to verify authenticated CSV download still works.
