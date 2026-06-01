# Phase 17 - Budget Collection Tracker

Phase 17 adds a budget collection workflow so the app can estimate how much money should be collected from each participant before or during an outing and track how much has actually been collected.

## What changed

### Budget tab

A new **Budget collection tracker** section is shown below Budget planning.

It shows:

- Suggested collection per participant
- Expected total collection
- Total collected
- Pending collection
- Per-participant expected, collected, pending, and status
- Payment history per participant

## Suggested collection logic

The suggested contribution is calculated as:

```text
Event estimated budget / participant count
```

If the event budget is zero, the backend uses the planned category budget as the collection basis.

## Collection statuses

| Status | Meaning |
|---|---|
| `not-required` | Expected and collected amounts are zero |
| `not-collected` | Nothing collected yet |
| `partially-collected` | Some amount collected, but pending remains |
| `collected` | Collected equals expected amount |
| `over-collected` | Collected amount is greater than expected |

## Admin and Finance permissions

Admin and Finance users can:

- Refresh collection records from current budget/participants
- Reset expected amounts to suggested split
- Override expected collection amount per participant
- Record collection payment with amount, mode, date, and reference/note
- Delete collection payment records

## Member permissions

Members can view the collection tracker but cannot edit collection records.

## Backend APIs added

```text
GET /api/budget-collections
POST /api/budget-collections/recalculate
PUT /api/budget-collections/:participantId/expected
POST /api/budget-collections/:participantId/payments
PUT /api/budget-collections/:participantId/payments/:paymentId
DELETE /api/budget-collections/:participantId/payments/:paymentId
```

## Data model

Each event can now store:

```js
budgetCollections: [
  {
    id: 'bc-...',
    participantId: 'p-...',
    expectedAmount: 50000,
    isExpectedCustom: false,
    payments: [
      {
        id: 'bcp-...',
        amount: 10000,
        mode: 'UPI',
        reference: 'UPI ref 123456',
        paidAt: '2026-06-01',
        createdAt: '...',
        updatedAt: '...'
      }
    ],
    createdAt: '...',
    updatedAt: '...'
  }
]
```

## Dashboard and reports

The Dashboard now shows a Budget collection summary when participants exist:

- Suggested each
- Expected collection
- Collected so far
- Pending collection

The PDF report includes a Budget collection summary section, and the CSV report includes budget collection expected/collected/pending/status columns.

## Audit actions added

```text
collection.recalculated
collection.expected_updated
collection.payment_recorded
collection.payment_updated
collection.payment_deleted
```

## Environment variables

No new Render, Vercel, or Supabase environment variables are required.

## Deployment

Both Render and Vercel may redeploy because this phase changes backend and frontend files.
