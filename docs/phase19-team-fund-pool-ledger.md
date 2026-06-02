# Phase 19 - Team Fund Pool Ledger

Phase 19 adds support for the real-world workflow where money is collected first and expenses are paid from a shared team fund pool.

## What changed

- The Budget tab now includes a **Team fund pool ledger** section.
- Participant collection payments from the Budget Collection Tracker increase the pool.
- Expenses can now be marked with a payment source:
  - `Paid by participant personally`
  - `Paid from team fund pool`
- Pool expenses reduce the fund pool balance and do not give personal paid-credit to the selected handler.
- Personal expenses continue to affect participant balances and settlements as before.
- Admin and Finance users can record manual fund transactions:
  - reimbursement
  - refund to participant
  - adjustment
- Members can view fund pool information but cannot edit fund transactions or record pool-paid expenses.

## New calculations

The fund pool balance is calculated as:

```text
Collected participant contributions
- expenses paid from team fund pool
- reimbursements
- refunds
+/- adjustments
= current pool balance
```

## Dashboard changes

The Dashboard now shows Team Fund Pool cards:

- Collected into pool
- Spent from pool
- Reimbursed / refunded
- Current pool balance

## Expense form changes

The expense form now includes **Payment source**.

If `Paid from team fund pool` is selected:

- the selected participant becomes the handler, not the personal payer
- the expense still counts as spending
- the team fund pool balance decreases
- participant paid-credit is not increased

## Reports

PDF and CSV reports now include fund pool summary fields and the PDF report includes a Team Fund Pool Ledger section.

## APIs added

```text
GET /api/fund-pool
POST /api/fund-pool/transactions
DELETE /api/fund-pool/transactions/:id
```

## Audit actions added

```text
fund.reimbursement_recorded
fund.refund_recorded
fund.adjustment_recorded
fund.transaction_deleted
```

## Chart update

Budget vs Actual charts in Dashboard and Analytics now use solid theme colors for both bars instead of striped budget bars.
