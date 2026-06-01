# Phase 8: User Invitations and Event Assignment

Phase 8 adds an Admin-driven invitation flow so users can be invited, assigned a role, and tagged to an outing from one place.

## Features

- Admin can create an invite with name, email, role, and target event.
- The app automatically creates or updates the app user record.
- The app automatically adds the invited email as a participant in the selected event.
- Admin can copy a manual invite link and share it through chat or email.
- Existing account emails are linked to the selected event without creating duplicates.
- New account emails can sign up from the invite link.
- Pending invites are accepted automatically when the invited email signs in.
- Admin can revoke pending invites.
- Invite actions are recorded in the audit log.

## Role rules

| Action | Admin | Finance | Member |
|---|---:|---:|---:|
| Create invite | Yes | No | No |
| View invites | Yes | Yes | No |
| Revoke pending invite | Yes | No | No |
| Accept own invite | Yes | Yes | Yes |

## Manual invite flow

1. Admin opens Roles.
2. Admin fills User invitations and event assignment.
3. Admin clicks Create invite.
4. App auto-tags the user as a participant in the selected event.
5. Admin copies the invite link and shares it manually.
6. User opens the invite link.
7. New user creates account or existing user signs in.
8. App accepts the invite and links the user to the event.

## Notes

This phase does not depend on SMTP email reminders. Invite links are copied manually until the email hotfix is completed.
