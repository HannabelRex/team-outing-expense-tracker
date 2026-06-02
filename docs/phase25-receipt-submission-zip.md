# Phase 25 - Receipt Submission ZIP Export

## Purpose

Phase 25 adds a one-click receipt evidence export for Admin and Finance users. The Reports tab now includes a **Receipt Submission ZIP** card that downloads all selected receipt files for the active event in a single ZIP package.

This is intended for company reimbursement, finance submission, and audit handoff workflows where downloading receipts one by one would be an excellent way to test human patience for no reason.

## Frontend changes

Changed file:

```text
client/src/App.jsx
client/src/styles.css
```

The Reports tab now includes:

- A Receipt Submission ZIP card.
- A single **Download receipt ZIP** action.
- Receipt export counts for selected expenses, attached receipts, and missing receipts.
- Options to include pending expenses, rejected expenses, and personal/off-budget expenses.
- Admin/Finance-only download access.
- Mobile-friendly checkbox rows and button layout.

Default export behavior:

- Includes approved official expenses only.
- Excludes personal/off-budget expenses unless explicitly selected.
- Includes the receipt index CSV.
- Includes a missing receipts CSV when selected expenses have no receipt.
- Includes company claim mapping columns in the index.

## Backend changes

Changed files:

```text
server/src/index.js
server/package.json
```

New dependency:

```bash
archiver
```

New backend endpoint:

```http
GET /api/reports/receipt-zip
```

Supported query parameters:

```text
includePending=true|false
includeRejected=true|false
includePersonal=true|false
includeMissing=true|false
includeClaimMapping=true|false
```

The endpoint is restricted to:

```text
Admin
Finance
```

Members cannot download all receipts.

## ZIP contents

Generated ZIP file name:

```text
<event-name>-receipt-submission.zip
```

Typical structure:

```text
00-event-summary.json
00-receipt-index.csv
approved-receipts/
pending-receipts/
rejected-expenses/
personal-off-budget/
missing-receipts/missing-receipts.csv
receipt-download-errors.csv
```

The final ZIP only includes folders that have content.

## Receipt file naming

Receipt files are renamed into readable, submission-safe names:

```text
YYYY-MM-DD_category_description_paidby_amount_expenseid.ext
```

Example:

```text
2026-06-01_food_lunch-ravi_2400_exp-123.jpg
```

The expense ID is included to avoid duplicate file-name collisions.

## CSV index fields

The receipt index includes:

- Expense ID
- Date
- Category
- Description
- Paid by
- Payment source
- Amount
- Approval status
- Personal/off-budget flag
- ZIP file path
- Original receipt file name
- Storage path
- Company claim mapping
- Notes

## Missing receipts

When selected expenses do not have receipt files, the ZIP includes:

```text
missing-receipts/missing-receipts.csv
```

This lets Finance see exactly which selected expenses are still missing evidence.

## Receipt download failures

If an expense has a receipt reference but the file cannot be downloaded from Supabase Storage, ZIP generation does not fail entirely. The failed item is listed in:

```text
receipt-download-errors.csv
```

That prevents one broken receipt from ruining the whole export. Software showing restraint, for once.

## Audit log

Every successful ZIP generation writes an audit entry:

```text
report.receipt_zip_downloaded
```

Audit metadata includes:

- Receipt count
- Selected expense count
- Missing receipt count
- Download error count
- Include pending flag
- Include rejected flag
- Include personal/off-budget flag
- Include claim mapping flag

## Deployment notes

Run this after applying the changed files:

```powershell
npm --prefix server install
npm --prefix client install
npm --prefix client run build
```

No new Render environment variables are required.

Existing receipt storage variables are still required for Supabase receipt downloads:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=receipts
```
