# Settlement Partial Payment Tracking Hotfix

## Purpose

This hotfix improves the Settlements screen so partial payments collect the actual amount paid instead of guessing or auto-filling half of the settlement amount.

## What changed

- The **Partially paid** button now opens an inline form.
- Admin/Finance can enter:
  - paid amount
  - transaction/reference note
- The settlement card now shows:
  - total settlement amount
  - paid amount
  - remaining amount
  - transaction/reference note when available
- A **Reset** action is shown when a settlement already has a paid amount.
- The **Complete** action still marks the full settlement amount as paid.
- Backend settlement status is now derived from paid amount:
  - `pending` when paid amount is `0`
  - `partially-paid` when paid amount is greater than `0` and less than the settlement amount
  - `completed` when paid amount equals the settlement amount
- Settlement audit entries now include remaining amount and use the correct participant names.

## Files changed

```text
client/src/App.jsx
server/src/index.js
README.md
docs/settlement-partial-payment-hotfix.md
```

## Testing checklist

1. Sign in as Admin or Finance.
2. Go to **Settlements**.
3. Click **Partially paid**.
4. Enter an amount lower than the settlement amount.
5. Save the partial payment.
6. Confirm paid amount and remaining amount are displayed.
7. Click **Complete** and confirm paid amount becomes the full settlement amount.
8. Click **Reset** and confirm settlement returns to pending.
9. Check Audit for `settlement.updated`.

## Notes

No new Render/Vercel environment variables are required.
