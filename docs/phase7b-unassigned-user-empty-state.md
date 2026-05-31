# Phase 7B Hotfix: Unassigned User Empty Dashboard

## Problem
Members who were not tagged to any outing were previously blocked by a hard error and had to close the tab or ask an admin immediately.

## Fix
The backend now allows unassigned members to log in and returns a safe empty dashboard state.

## Behavior
- Admin and Finance behavior is unchanged.
- Members tagged to events still see and switch only their assigned events.
- Members with zero assigned events can sign in normally.
- The dashboard shows a clear empty-state message asking them to contact an admin.
- Event-specific tabs are hidden for unassigned members to avoid invalid actions.
- Inbox remains available, though it will be empty until the user is assigned to an event.

## Health Check
`/api/health` now includes:

```json
{
  "unassignedMemberEmptyState": "enabled"
}
```

## Test
1. Create a new member account or remove a test member from all event participant lists.
2. Sign in as that member.
3. Confirm the app shows an empty dashboard instead of an error.
4. Add that member's login email to an event participant.
5. Refresh or sign in again.
6. Confirm the event dashboard appears normally.
