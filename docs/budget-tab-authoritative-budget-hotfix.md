# Budget Tab Authoritative Budget Hotfix

This hotfix makes the Budget tab category estimates the single source of truth for the event budget.

## What changed

- Removed manual Estimated budget entry from Event setup.
- Removed Estimated budget from the Create event form.
- Event budget is derived from the sum of Budget tab category estimates.
- Dashboard, Analytics, Events list, Budget Collection Tracker, Fund Pool, PDF reports, and CSV reports now use the Budget tab total.
- Category create/edit/delete operations resync the stored event budget value for backward compatibility.
- Budget collection suggested amount is calculated from the Budget tab category total divided by participant count.

## Why

The project workflow now collects money based on the budget categories maintained in the Budget tab. Keeping a separate event-level budget field caused duplicate sources of truth and confused users.

## User impact

Admin and Finance users should update budget values only in the Budget tab. Event setup now controls event metadata such as name, date, location, currency, organizer, and settlement deadline.

## Technical note

The backend still keeps `event.estimatedBudget` populated for compatibility with existing UI/report paths, but it is automatically synced from category estimates and no longer accepted as a manual event setup input.
