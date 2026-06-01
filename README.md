# Team Outing Expense Tracker - Phase 14 Offline Receipt Sync

This package upgrades the Team Outing Expense Tracker with offline receipt attachment support for expense drafts.

## Phase 14 summary

Phase 14 builds on Phase 13 Offline Expense Draft Queue. Users can now create offline expense drafts with receipt files attached. The app stores the draft metadata in `localStorage`, stores receipt files in IndexedDB, uploads the receipt during sync, and only deletes the local draft after the expense is saved successfully.

Key additions:

- Attach receipt files while offline for new expense drafts
- Store offline receipt files in IndexedDB
- Show receipt file name, size, and sync status in the Offline expense drafts queue
- Upload receipt first during sync, then create the expense with the uploaded receipt reference
- Preserve failed drafts and show sync errors
- Avoid duplicate receipt uploads when receipt upload succeeds but expense creation fails
- Delete local receipt blob after successful sync or draft deletion
- Service worker cache bumped to `team-outing-expense-tracker-v5`

## Files changed

```text
client/src/App.jsx
client/src/offlineStorage.js
client/public/service-worker.js
README.md
docs/phase14-offline-receipt-sync.md
```

## Backend changes

No new backend routes or Render environment variables are required for Phase 14.

The sync flow reuses existing authenticated endpoints:

```text
POST /api/receipts/upload
POST /api/expenses
```

The backend continues to enforce event access, role restrictions, member paid-by ownership, category validity, participant validity, receipt validation, and normal expense validation.

## Important notes

- Offline receipt support applies to new offline expense drafts only.
- Existing expense edits remain blocked offline.
- Offline receipt files are saved only on the current browser/device.
- Clearing browser storage deletes local offline drafts and receipt files.
- Supported receipt types remain JPG, PNG, WebP, and PDF.
- Max receipt size remains 4 MB.

## Deploy steps

```powershell
cd C:\Users\ksath\Downloads\team-outing-expense-tracker-mobile-pwa\team-outing-expense-tracker

git status

git add -A

git commit -m "Add offline receipt sync"

git push origin main
```

Vercel should redeploy the frontend automatically after the push. Render does not need a backend environment change for Phase 14.

## Testing checklist

1. Sign in while online and open the Expenses tab.
2. Switch Chrome DevTools Network to Offline.
3. Create a new expense.
4. Attach a JPG, PNG, WebP, or PDF receipt under 4 MB.
5. Confirm the form says the receipt is queued offline.
6. Save the draft.
7. Confirm the Offline expense drafts queue shows the receipt name and size.
8. Refresh while offline and confirm the draft remains.
9. Restore network.
10. Confirm the draft syncs automatically.
11. Confirm the expense appears in the expense list.
12. Confirm the receipt link opens.
13. Test `Sync now` manually with another draft.
14. Delete a draft with a receipt and confirm it disappears from the queue.

---

# Status Banner Auto-Hide Hotfix

The online/offline status ribbon now appears for 5 seconds and then hides automatically.

It reappears whenever the sync state changes, including:

- app comes online
- app goes offline
- latest data refreshes and updates the last synced time
- an offline/cache notice changes

The compact Online/Offline chip in the header remains visible at all times so users can still see the current connection state without the full ribbon taking screen space.

## Changed file

```text
client/src/App.jsx
```

## Deploy steps

```powershell
cd C:\Users\ksath\Downloads\team-outing-expense-tracker-mobile-pwa\team-outing-expense-tracker

git status

git add -A

git commit -m "Auto-hide online offline status banner"

git push origin main
```


---

# Phase 15 - Admin Backup, Restore, and Data Export Pack

Phase 15 adds an Admin-only **Data** tab for backup, event export, and full app restore.

## New Admin-only features

- Download full app backup as JSON
- Export current event as JSON
- Restore full app backup from JSON
- Preview backup summary before restore
- Require typing `RESTORE` before replacing current app data
- Preserve the currently signed-in Admin as active Admin after restore
- Record backup and restore actions in Audit

## Backend endpoints

```text
GET /api/admin/backup
GET /api/admin/events/:eventId/export
POST /api/admin/restore
```

## Audit actions

```text
backup.downloaded
backup.event_exported
backup.restore_completed
```

## Notes

- Only full backups can be restored.
- Event exports are archive/reference files and cannot be restored as the whole app state.
- Backup files do not include Render, Vercel, Gmail, or Supabase environment secrets.
- No new Render or Vercel environment variables are required.

## Deploy steps

```powershell
cd C:\Users\ksath\Downloads\team-outing-expense-tracker-mobile-pwa\team-outing-expense-tracker

git status

git add -A

git commit -m "Add admin backup and restore workflow"

git push origin main
```

Both Vercel and Render may redeploy because Phase 15 changes frontend and backend files.
