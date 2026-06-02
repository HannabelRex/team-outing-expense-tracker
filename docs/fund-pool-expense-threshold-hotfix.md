# Fund Pool Expense Threshold Hotfix

## Summary

This hotfix prevents Admin/Finance users from saving an expense paid from the team fund pool when the expense amount is greater than the currently available collected pool balance.

## Changes

- The Expenses form now shows the available team fund pool balance when `Paid from team fund pool` is selected.
- The form also shows the projected remaining pool balance after the entered expense amount.
- If the entered amount is above the available shared pool threshold, the save button is disabled and a clear warning is shown.
- The backend also validates the same rule for `POST /api/expenses` and `PUT /api/expenses/:id`, so direct API calls cannot overspend the pool.
- When editing an existing pool expense, the current expense amount is temporarily credited back to the available balance so valid edits are not incorrectly blocked.

## Error message

If the pool balance is exceeded, the app shows:

```text
This expense is above the shared pool threshold. Reduce the amount or collect more money before saving it.
```

The backend returns a similar validation error with the available pool balance.

## Notes

- Rejected pool expenses do not reduce pool balance and are not checked against the pool threshold.
- Participant-paid expenses are unaffected.
- No new environment variables, database tables, or Supabase storage changes are required.
