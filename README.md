# Team Outing Expense Tracker - Phase 13 Offline Expense Sync

This package upgrades the Team Outing Expense Tracker with an offline expense draft queue and automatic sync.

## Phase 13 summary

Phase 13 builds on Phase 12 Offline PWA Mode. Users can now create text-only expense drafts while offline. The drafts are saved locally on the device and synced to the backend when the app reconnects.

Key additions:

- Offline expense draft creation from the Expenses form
- Local draft queue using browser `localStorage`
- Offline expense draft section in the Expenses tab
- Automatic draft sync after reconnecting
- Manual `Sync now` button
- Delete draft button
- Per-draft status, sync attempts, last attempt timestamp, and error display
- Receipt upload remains blocked while offline
- Member users are blocked from creating offline drafts paid by another participant profile
- Existing backend expense validation remains the final safety gate

## Files changed

```text
client/src/App.jsx
README.md
docs/phase13-offline-expense-sync.md
```

## Backend changes

No backend routes or environment variables are required for Phase 13.

Draft sync reuses the existing authenticated endpoint:

```text
POST /api/expenses
```

The backend continues to enforce event access, role restrictions, member paid-by ownership, category validity, participant validity, and normal expense validation.

## Important limitation

Offline drafts do not support receipt files yet. Receipt upload still requires online Supabase Storage access. Users can save the expense draft offline, sync it later, then attach the receipt online.

## Deploy steps

```powershell
cd C:\Users\ksath\Downloads\team-outing-expense-tracker-mobile-pwa\team-outing-expense-tracker

git status

git add -A

git commit -m "Add offline expense draft sync"

git push origin main
```

Vercel should redeploy the frontend automatically after the push. Render does not need a backend environment change for Phase 13.

## Testing checklist

1. Sign in while online and open the Expenses tab.
2. Switch Chrome DevTools Network to Offline.
3. Create a new expense without a receipt.
4. Confirm the button says `Save offline draft`.
5. Save the draft and confirm it appears in Offline expense drafts.
6. Refresh while offline and confirm the draft remains.
7. Restore the network.
8. Confirm the draft syncs automatically and appears in the expense list.
9. Create another offline draft and test `Sync now` manually.
10. Test Member role safety by trying to save a draft paid by another participant.

