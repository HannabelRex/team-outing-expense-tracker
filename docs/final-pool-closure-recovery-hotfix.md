# Final Pool Closure Recovery Hotfix

This hotfix restores the Phase 20 Final Pool Closure UI/API that was missing from the current working copy.

## Restored

- `calculateFinalClosure` in backend calculations.
- Final closure data in `/api/bootstrap` and reports.
- Backend endpoints under `/api/final-closure`.
- Settlements tab section: **Final pool closure**.
- PDF/CSV report final closure fields.

## Why

A later frontend hotfix replaced `client/src/App.jsx` and removed the final closure section. This recovery patch merges it back into the current app version without removing later features such as personal off-budget expenses, team fund pool threshold checks, and report chart colors.
