# Phase 25B - Dashboard Next Action Logic Hotfix

## Summary

This hotfix corrects the Dashboard **Next action** recommendation logic so a newly created event is treated as a setup-stage event instead of being incorrectly marked as ready for final report export.

Previously, an event with all financial values at zero could satisfy the old "closed money flow" condition and show:

- Export final report

That was wrong because zero activity is not completion. It is only setup waiting to happen, because dashboards apparently needed this explained in writing.

## What changed

### Setup-aware recommendation order

The Dashboard now recommends actions in this order:

1. Add participants
2. Set up event budget
3. Start participant collection
4. Add first expense
5. Review pending expenses
6. Upload missing receipts
7. Record pending collections
8. Follow up company claims
9. Complete settlements
10. Calculate final closure
11. Close final items
12. Export final report

### New-event behavior

For a new event with participants but no planned budget, the Next action now shows:

- **Set up event budget**
- Add Budget tab categories so collections, pool usage, and reports can work correctly.

### Export report is now restricted to real completion

The Dashboard no longer recommends exporting the final report unless meaningful event activity has progressed through the correct workflow.

### Dashboard health wording improved

The Event Health card now uses setup-aware language:

- Budget not set
- Collection waiting
- Pool not funded
- Closure later
- Setup in progress on mobile

This avoids misleading labels such as "Fully collected" or "Healthy outing" for a newly created event.

## Files changed

- `client/src/App.jsx`
- `docs/phase25b-dashboard-next-action-hotfix.md`

## Validation

Validated with:

```powershell
node --check .\server\src\index.js
node .\server\src\calculations.test.js
npm --prefix client run build
```

## Deployment notes

Frontend-only hotfix. No backend route changes, no database changes, no Render environment variables.

After pushing to GitHub, Vercel should redeploy the frontend automatically. Render does not need to redeploy for this hotfix.
