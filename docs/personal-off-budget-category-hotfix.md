# Personal Off-Budget Category Hotfix

## Purpose

Adds a built-in **Personal (off-budget split)** category for expenses that should not affect event budget totals, category actuals, the team fund pool, or official expense report lists, while still allowing the amount to be split between selected participants for settlement.

## Behavior

- The Expenses category dropdown includes **Personal (off-budget split)**.
- Personal expenses are always treated as participant-paid expenses.
- Team fund pool payment source is disabled for Personal expenses.
- Split method and participant selection remain available.
- Personal expenses are included in participant balances and settlement calculations.
- Personal expenses are excluded from:
  - Dashboard total spent and remaining budget
  - Budget category actuals
  - Analytics budget/category spend charts
  - Team fund pool ledger and pool balance
  - Official PDF expense list and receipt references

## Notes

The expense is still stored internally because settlement calculations need the source amount and selected participants. It is off-budget, not invisible to the application.
