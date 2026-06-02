# Phase 21A - Claims and Expense Lock Workflow

This phase adds a compact **Claims** tab for post-trip company reimbursement tracking.

## What it supports

- Fixed company reimbursement to the team fund pool
- Company payment to the financier / pool handler
- Category-based reimbursement claim preview
- Percentage reimbursement claim preview with optional cap
- Direct company payments to participants
- Expense locking after claim submission
- Admin-only expense reopen flow using `REOPEN CLAIM`

## Expense lock rule

Expenses remain editable while a claim is in `draft`, `reopened`, or `rejected` status.

Expenses are locked when any claim is in:

- `submitted`
- `approved`
- `partially-received`
- `received`

When locked, the backend blocks add, edit, approve/reject, and delete expense operations. The frontend also disables those actions and shows a warning in the Expenses tab.

## Pool impact

Only received company money affects calculations.

Pool-based claims increase the team fund pool only when the claim status is `partially-received` or `received`.

Direct participant reimbursements do not enter the pool. They are subtracted from that participant's final closure result so nobody gets reimbursed twice.

## APIs added

- `GET /api/company-claims`
- `POST /api/company-claims`
- `PUT /api/company-claims/:id`
- `DELETE /api/company-claims/:id`
- `POST /api/company-claims/:id/reopen-expenses`

## Reports

PDF and CSV reports include company claim totals and received reimbursement impact.

## Environment variables

No new Render or Vercel environment variables are required.
