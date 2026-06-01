# Settlement Dashboard Reflection Hotfix

## Summary

This hotfix makes partial settlement payments visible in the Dashboard participant balances table.

Before this change, the Settlements screen could store a partial paid amount, but the Dashboard still showed the original expense-based net balance only. That made it look like the payment had not affected the participant balance.

## What changed

- Dashboard participant balances now include settlement payment adjustments.
- Each participant balance includes:
  - `settlementPaid`
  - `settlementReceived`
  - `netBalanceBeforeSettlement`
  - adjusted `netBalance`
- Dashboard now shows a `Settlement paid/received` column whenever any settlement payment exists.
- Dashboard net balance is now labeled as `Net after settlements`.
- Settlement generation still uses raw expense balances so the original settlement amount and `paidAmount` history remain intact.

## Example

If A owes B INR 5,000 and A pays INR 2,000 partially:

- A net balance changes from `-5,000` to `-3,000`.
- B net balance changes from `+5,000` to `+3,000`.
- The settlement row still shows total amount INR 5,000, paid INR 2,000, remaining INR 3,000.

## Validation

Backend validation passed:

```powershell
cd server
node --check src/index.js
npm run test:logic
```

The calculation tests now include a partial-settlement scenario to ensure dashboard balances reflect settlement payments without shrinking the original settlement plan.
