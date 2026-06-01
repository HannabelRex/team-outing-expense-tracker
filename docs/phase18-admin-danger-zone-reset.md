# Phase 18 - Admin Danger Zone Workspace Reset

## Purpose

Phase 18 adds an Admin-only workspace reset flow for demo cleanup, pilot resets, and fresh-start scenarios.

The feature is intentionally designed as a **backup-first destructive operation**. It does not silently erase the app. It first saves a full backup, then resets active workspace data.

## UI

A new section appears in:

```text
Data -> Danger Zone: Reset workspace data
```

Visible only to Admin users.

The Admin must type:

```text
MASTER RESET
```

before the button becomes usable.

## Backend endpoint

```text
POST /api/admin/master-reset
```

Request body:

```json
{
  "confirmation": "MASTER RESET"
}
```

## Backup-first behavior

Before resetting data, the backend creates a full app backup using the same format as the normal full backup.

The backup is saved to Supabase Storage:

```text
<app-backups bucket>/danger-zone/master-reset-backup-<timestamp>.json
```

The reset is blocked if backup storage is not configured.

## Data cleared

The active workspace is reset by clearing:

- Events
- Participants
- Expenses
- Settlements
- Budget collections
- Notifications
- Invitations
- Non-admin app users
- Previous audit logs

A new blank event is created after reset.

## Data preserved

The reset preserves:

- Current signed-in Admin
- Other active Admin users
- Supabase Auth accounts
- Render/Vercel/Supabase environment configuration
- Automatic backup configuration

Supabase Auth users are not deleted. Non-admin users are removed only from the app state.

## Audit behavior

Old audit logs are included in the safety backup and cleared from active state.

After reset, one new audit entry is created:

```text
workspace.master_reset_completed
```

This gives the clean workspace a trace that a reset happened without keeping the full old audit trail active.

## Testing checklist

1. Sign in as Admin.
2. Open Data.
3. Confirm Danger Zone is visible.
4. Confirm button is disabled until `MASTER RESET` is typed.
5. Click reset.
6. Confirm backup appears in Supabase Storage under `danger-zone/`.
7. Confirm app reloads with a blank event.
8. Confirm active Admin users remain.
9. Confirm Finance/Member users are removed from app state.
10. Confirm Audit shows `workspace.master_reset_completed`.
11. Confirm Finance/Member cannot see the Data tab or call the endpoint.

## Notes

This feature is meant for controlled admin cleanup. It should not be treated as normal operational housekeeping. Backups are mandatory because destructive buttons without parachutes are how apps become warning labels.
