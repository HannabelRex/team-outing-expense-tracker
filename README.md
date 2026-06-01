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

---

# Phase 15B - Daily Automatic Backup to Supabase Storage

Phase 15B adds a daily automatic backup workflow that stores one full-app JSON backup in a private Supabase Storage bucket and overwrites the old backup with the newest one.

## Recommended Supabase bucket

```text
app-backups
```

Bucket settings:

```text
Public bucket: disabled
File size limit: 10 MB
Allowed MIME type: application/json
```

Backup path:

```text
daily/latest-backup.json
```

## New Render environment variables

```text
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_BUCKET=app-backups
AUTO_BACKUP_PATH=daily/latest-backup.json
AUTO_BACKUP_MAX_BYTES=10485760
BACKUP_CRON_SECRET=<random long secret>
```

Existing variables reused:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## New endpoints

Cron endpoint:

```text
POST /api/admin/backup/auto
```

Required header:

```text
x-backup-cron-secret: <BACKUP_CRON_SECRET>
```

Admin-only endpoints:

```text
GET /api/admin/backup/auto-status
POST /api/admin/backup/auto-run
GET /api/admin/backup/latest
```

## Render Cron Job command

```bash
curl -X POST "https://team-outing-expense-tracker-api.onrender.com/api/admin/backup/auto" -H "x-backup-cron-secret: $BACKUP_CRON_SECRET"
```

Suggested schedule:

```text
0 2 * * *
```

## Audit actions

```text
backup.auto_completed
backup.auto_failed
backup.auto_downloaded
```

## Deploy steps

```powershell
cd C:\Users\ksath\Downloads\team-outing-expense-tracker-mobile-pwa\team-outing-expense-tracker

git status

git add -A

git commit -m "Add daily automatic backup workflow"

git push origin main
```

Both Vercel and Render may redeploy because Phase 15B changes frontend and backend files.

---

# Phase 16 - Login Performance Optimization

Phase 16 improves post-sign-in loading performance and perceived speed.

## Included improvements

- Shows session-safe cached `/api/bootstrap` data immediately after sign-in when available.
- Refreshes latest server data in the background.
- Delays notification inbox refresh so it does not compete with the initial dashboard load.
- Memoizes analytics calculations with `useMemo`.
- Adds backend timing logs for `/api/bootstrap`.
- Reduces avoidable full JSON-state writes from read-heavy endpoints by using dirty-store tracking.
- Updates `lastLoginAt` at most once every 10 minutes per user instead of every authenticated read request.

## Render log to check

```text
Bootstrap performance timing
```

This log shows:

```text
readStoreMs
normalizeAndUserMs
calculateMs
conditionalWriteMs
responseBuildMs
totalMs
```

## New health flag

```json
"loginPerformanceOptimization": "enabled"
```

## Environment variables

No new Render or Vercel environment variables are required.

## Deploy steps

```powershell
cd C:\Users\ksath\Downloads\team-outing-expense-tracker-mobile-pwa\team-outing-expense-tracker

git status

git add -A

git commit -m "Optimize login loading performance"

git push origin main
```

Both Render and Vercel may redeploy because Phase 16 changes backend and frontend files.


### Invite signup existing-account hotfix

Invite-based signup is now invite-aware. When a user opens an invitation link and creates an account with the invited email, the app sends the invite token during the email-existence check. Pending invitation placeholder users no longer block first-time invited users from signing up. If the email is already linked to a real Supabase Auth login, the user is still redirected to sign in and accept the invite safely.



## Settlement Partial Payment Tracking Hotfix

The Settlements screen now collects the actual amount paid when marking a settlement as partially paid. Admin/Finance users can enter the partial paid amount and an optional transaction/reference note. Settlement cards now show total, paid, and remaining amounts, and backend status is derived from the paid amount to avoid inconsistent partial/full settlement state.


## Theme Picker Hotfix - Vibrant Color Profiles

A top-header **Themes** button is now available to all signed-in roles. Users can switch between multiple vibrant palettes, including Signature Blend, Travel Blue + Emerald, Sunset Coral + Indigo, Electric Cyan + Royal Purple, Forest Green + Gold, and Coorg Nature Theme.

Theme selection is stored locally in the user's browser with `localStorage`; it does not change shared app state and does not require backend routes, database changes, or environment variables.


### Analytics Theme Colors Hotfix

The Analytics dashboard now follows the active website theme. Chart fills, pie slices, progress bars, axis labels, grid lines, legends, and tooltip styling update when the user switches themes from the top header. This is a frontend-only UI hotfix and does not require backend routes, database changes, or new environment variables.


### Chart Budget vs Actual Differentiator Hotfix

Dashboard and Analytics category charts now make budget and actual bars easier to distinguish. Estimated budget bars use a theme-aware diagonal stripe pattern with an outline, while actual spend bars use a solid theme color. The Dashboard category chart also follows the active theme for axis, grid, legend, and tooltip styling. This is a frontend-only UI hotfix and does not require backend routes, database changes, or new environment variables.


### Settlement Dashboard Reflection Hotfix

Partial settlement payments now reflect in the Dashboard participant balances. The dashboard displays settlement paid/received details and adjusts the net balance after settlements while preserving the original settlement amount and paid amount in the Settlements screen.


## Phase 17 - Budget Collection Tracker

The Budget tab now includes a **Budget collection tracker** that calculates the approximate money to collect from participants based on the event budget and participant count.

Admin and Finance users can:

- Refresh collection records from the current budget and participant list
- Reset expected amounts to the suggested equal split
- Override expected collection amount per participant
- Record collection payments with amount, payment mode, date, and reference/note
- Delete collection payment records

The Dashboard now shows Budget collection summary cards, and PDF/CSV reports include collection details. Members can view collection status but cannot edit it.

New backend APIs:

```text
GET /api/budget-collections
POST /api/budget-collections/recalculate
PUT /api/budget-collections/:participantId/expected
POST /api/budget-collections/:participantId/payments
PUT /api/budget-collections/:participantId/payments/:paymentId
DELETE /api/budget-collections/:participantId/payments/:paymentId
```

Audit actions added:

```text
collection.recalculated
collection.expected_updated
collection.payment_recorded
collection.payment_updated
collection.payment_deleted
```

No new Render/Vercel environment variables are required.

## Phase 18 - Admin Danger Zone Workspace Reset

The Data tab now includes an Admin-only **Danger Zone: Reset workspace data** section.

The reset flow is intentionally strict:

- Admin must type `MASTER RESET`
- Backend creates a full safety backup first in Supabase Storage
- Backup is stored under `danger-zone/master-reset-backup-<timestamp>.json`
- Active Admin users are preserved
- Non-admin app users are removed from the app user list
- Events, participants, expenses, settlements, budget collections, notifications, invitations, and old audit logs are cleared from the active workspace
- A fresh blank event is created
- One new audit entry is kept: `workspace.master_reset_completed`

New backend API:

```text
POST /api/admin/master-reset
```

Request body:

```json
{
  "confirmation": "MASTER RESET"
}
```

The feature reuses the existing automatic backup storage configuration:

```text
AUTO_BACKUP_ENABLED=true
AUTO_BACKUP_BUCKET=app-backups
AUTO_BACKUP_MAX_BYTES=10485760
SUPABASE_URL=<configured>
SUPABASE_SERVICE_ROLE_KEY=<configured>
```

No Supabase Auth users are deleted. Removed Finance/Member users are deleted only from the application state, so they no longer have app access unless invited or created again.

## Glassmorphism login experience hotfix

The login screen has been redesigned into a premium glassmorphism experience with animated gradient background, floating receipt/budget/approval cards, a SaaS-style outing snapshot preview, and a frosted authentication card.

The hotfix preserves all existing authentication flows:

- Sign in
- Signup
- Invite-aware signup
- Forgot password
- Password reset

No backend routes, database changes, or environment variables are required. Animations are CSS-only and support reduced-motion preferences.

## Login floating cards safe-space hotfix

The glassmorphism login screen now keeps animated flyer cards in safer edge positions and behind the main content layer. The headline, form, and dashboard preview remain readable while the decorative budget/receipt/approval/settlement cards continue to animate in the empty visual spaces.
