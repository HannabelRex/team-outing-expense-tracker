# Phase 20 - Final Pool Closure and Refund Settlement

Phase 20 closes the collection-first outing workflow.

## Purpose

After an outing is completed, the app now calculates the remaining team fund pool and adjusts it against pending settlement balances and pending participant collections. This gives Admin/Finance users a final list of amounts to refund to participants or collect from participants.

## Calculation

For each participant:

```text
Final amount = Pool refund share - Pool deficit share + Settlement receivable - Settlement payable - Pending collection
```

If the final amount is positive, the app shows **Refund to participant**.
If the final amount is negative, the app shows **Collect from participant**.
If the final amount is zero, the participant is settled.

## Pool refund share

When the fund pool has a positive balance, the remaining amount is distributed based on each participant's actual contribution to the pool.

```text
Participant refund share = Remaining pool balance * (participant collected amount / total collected amount)
```

This keeps refunds fair when participants did not contribute equal amounts.

## Settlement adjustment

The final closure calculation uses pending settlement amounts:

- Settlement payable reduces the participant's refund.
- Settlement receivable increases the participant's refund.

Already paid settlement amounts are not added again.

## Pending collection adjustment

If a participant still has pending collection, that amount is subtracted from their final refund. If it exceeds their refund, the app shows a final amount still to collect.

## UI

The Settlements tab now includes a **Final pool closure** section with:

- Remaining pool
- Refund due
- Still to collect
- Closure progress
- Participant-wise final closure table
- Mark refund paid / Mark collected actions
- Reopen closure records action

## API endpoints

```text
GET /api/final-closure
POST /api/final-closure/calculate
POST /api/final-closure/:participantId/mark
POST /api/final-closure/reopen
```

## Audit actions

```text
closure.calculated
closure.refund_marked_paid
closure.amount_collected
closure.reopened
closure.waived
```

## Reports

PDF and CSV reports now include final closure details.
