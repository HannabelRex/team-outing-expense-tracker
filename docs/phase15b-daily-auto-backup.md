# Phase 15B - Daily Automatic Backup to Supabase Storage

Phase 15B adds an automatic backup workflow for the Team Outing Expense Tracker.

The app can now save one daily full-app JSON backup to a private Supabase Storage bucket and overwrite the previous file with the new one.

## Storage design

Recommended bucket:

```text
app-backups
```

Recommended path:

```text
daily/latest-backup.json
```

The bucket must stay private. The backup contains app data such as events, users, expenses, invitations, notifications, and audit entries.

## New Render environment variables

Add these to the Render backend service:

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

## Backend endpoints

Cron endpoint, protected by `BACKUP_CRON_SECRET`:

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

## Admin UI

The Data tab now includes a Daily automatic backup panel showing:

- Whether automatic backup is ready
- Storage bucket/path
- Last successful automatic backup
- Last failed automatic backup
- Run backup now button
- Download latest auto backup button

## Render Cron setup

Create a Render Cron Job that runs once daily.

Suggested schedule:

```text
0 2 * * *
```

Suggested command:

```bash
curl -X POST "https://team-outing-expense-tracker-api.onrender.com/api/admin/backup/auto" -H "x-backup-cron-secret: $BACKUP_CRON_SECRET"
```

Set the same `BACKUP_CRON_SECRET` value in the Cron Job environment.

## Audit actions

```text
backup.auto_completed
backup.auto_failed
backup.auto_downloaded
```

## Notes

- Each automatic backup overwrites the previous file at `daily/latest-backup.json`.
- Manual full backup and restore from Phase 15 still work.
- The automatic backup file is stored outside the database, so it remains useful if the app state table needs recovery.
- Do not make the `app-backups` bucket public.
