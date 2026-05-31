# Phase 7C Access Permissions Hotfix

## Purpose

This hotfix tightens role-based access around event setup and participant management.

## Changes

- Members can view the Participants tab but cannot add, edit, or remove participants.
- Members can view Event setup in read-only mode but cannot save changes.
- Admin and Finance users can edit Event setup.
- Admin and Finance users can add, edit, and remove participants.
- Backend permissions now enforce the same rules, so hiding buttons is not the only protection. Tiny mercy from the security gods.

## Role behavior

| Role | Event setup | Participants |
|---|---|---|
| Admin | Edit | Add, edit, remove, view |
| Finance | Edit | Add, edit, remove, view |
| Member | View only | View only |

## Health check

The backend health endpoint includes:

```json
{
  "financeParticipantEventManagement": "enabled"
}
```

## Test checklist

1. Sign in as Admin.
2. Confirm Event setup is editable.
3. Confirm Participants can be added, edited, and removed.
4. Sign in as Finance.
5. Confirm Event setup is editable.
6. Confirm Participants can be added, edited, and removed.
7. Sign in as Member.
8. Confirm Event setup is read-only.
9. Confirm Participants tab is visible.
10. Confirm Add/Edit/Remove participant controls are hidden.
11. Confirm direct API calls from Member are rejected by backend.
