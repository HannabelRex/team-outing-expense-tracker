# Phase 7: Audit Trail and Security Hardening

Phase 7 adds an event-level audit trail and stricter backend checks for member-owned expense actions.

## New features

- New Audit tab for Admin and Finance users.
- Audit entries for event, participant, category, expense, settlement, role, and notification actions.
- Search and filter in the Audit tab.
- Backend endpoint: `GET /api/audit`.
- Health check flag: `auditTrail: "enabled"`.
- Security check: Members can only create or update expenses where the paid-by participant matches their login email.
- Existing restrictions remain: Members cannot see Events, Roles, Notifications, or Audit tabs.

## Roles

| Role | Audit tab | Notes |
|---|---:|---|
| Admin | Yes | Full audit visibility for selected event |
| Finance | Yes | Review audit visibility for selected event |
| Member | No | Members cannot access audit data |

## What gets tracked

- Event created, updated, deleted, archived, completed, reactivated
- Participant created, updated, deleted
- Budget category created, updated, deleted
- Expense created, updated, deleted, approval changed
- Settlement updated
- User role updated
- Reminder queued/deleted

## Testing checklist

1. Sign in as Admin.
2. Add a participant.
3. Add a budget category.
4. Add an expense.
5. Approve or reject an expense.
6. Open Audit tab.
7. Confirm the actions are listed.
8. Sign in as Finance and confirm Audit tab is visible.
9. Sign in as Member and confirm Audit tab is hidden.
10. As Member, try creating an expense paid by another participant. The backend should block it.

## Notes

Audit entries are stored inside the selected event in the existing `app_state` JSON structure as `auditLog`.
