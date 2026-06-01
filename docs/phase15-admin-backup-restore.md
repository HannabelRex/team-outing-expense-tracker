# Phase 15 - Admin Backup, Restore, and Data Export Pack

Phase 15 adds an Admin-only Data Management tab for safe backup and restore operations.

## What changed

### Backend

Updated `server/src/index.js` with Admin-only endpoints:

```text
GET /api/admin/backup
GET /api/admin/events/:eventId/export
POST /api/admin/restore
```

### Frontend

Updated `client/src/App.jsx` with a new Admin-only tab:

```text
Data
```

The tab includes:

- Download full backup
- Export current event
- Restore full backup JSON
- Restore confirmation requiring `RESTORE`
- Backup summary preview before restore

## Full backup

The full backup includes:

- events
- participants
- budget categories
- expenses
- settlements
- notifications
- audit entries
- users and roles
- invitations
- app metadata

The backup does not include Render, Vercel, Gmail, or Supabase environment secrets.

## Event export

The current event export downloads one event as JSON. It is intended for archive/reference use and is not accepted by the full restore endpoint.

## Restore safety

Restore is Admin-only and requires:

1. A full backup JSON file with `backupType = team-outing-full-app-state`
2. Supported `backupVersion = 1`
3. Required event/app structure
4. Confirmation text exactly matching `RESTORE`

After restore, the currently signed-in Admin is preserved as an active Admin to reduce the risk of locking yourself out after restoring an older backup. Because apparently lockout bugs enjoy dramatic timing.

## Audit actions

Phase 15 adds these audit actions:

```text
backup.downloaded
backup.event_exported
backup.restore_completed
```

## No new environment variables

Phase 15 does not require new Render or Vercel environment variables.

## Testing checklist

1. Sign in as Admin.
2. Confirm the Data tab is visible.
3. Download a full backup.
4. Confirm the JSON file opens and includes `backupType = team-outing-full-app-state`.
5. Export the current event.
6. Confirm Finance and Member users cannot see the Data tab.
7. Upload a full backup JSON in the Data tab.
8. Confirm summary details appear.
9. Type `RESTORE`.
10. Click Restore backup.
11. Confirm data reloads successfully.
12. Check Audit for backup/download/restore entries.
