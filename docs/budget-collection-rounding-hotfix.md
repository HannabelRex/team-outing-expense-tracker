# Budget Collection Rounding Hotfix

## Purpose

Budget collection suggestions now avoid decimal and awkward participant split amounts.

When the Budget tab total is divided by participants, the suggested collection per participant is rounded up to the nearest 100.

Example:

```text
Budget total: INR 17,307.69
Participants: 3
Raw split: INR 5,769.23
Suggested collection: INR 5,800
```

## Why round up

Rounding up avoids under-collection and gives Admin/Finance a clean practical number to collect from participants.

## Scope

- Budget Collection Tracker suggested amount
- Auto-created expected collection records
- Reset expected to suggested
- Dashboard collection summary
- Fund Pool collected/pending summaries
- Reports using budget collection summary

Custom expected amounts remain unchanged.

## Files changed

- `server/src/calculations.js`
- `server/src/index.js`
- `server/src/calculations.test.js`
- `README.md`
