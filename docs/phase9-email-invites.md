# Phase 9: Email Invitation Delivery

Phase 9 upgrades user invitations from manual-link sharing to email-based delivery using the existing SMTP configuration.

## Features

- Admin can create an invite and send the invite link by email in one step.
- Pending invites store email delivery status.
- Admin can resend an invite email for pending invites.
- Manual copy-link remains available as a fallback.
- Invite email delivery success/failure is recorded in the audit log.
- SMTP send failures do not break invite creation; the invite remains available for manual sharing.

## Backend changes

Updated file:

```text
server/src/index.js
```

Added invitation email fields returned by the API:

```text
emailStatus
emailAttempts
emailLastAttemptAt
emailSentAt
emailFailedAt
emailError
```

Added helper functions:

```text
invitePlainText()
sendInviteEmail()
```

Added endpoint:

```text
POST /api/invitations/:id/resend-email
```

Added SMTP timeout settings so failed email connections return faster:

```text
connectionTimeout: 10000
greetingTimeout: 10000
socketTimeout: 15000
```

## Frontend changes

Updated file:

```text
client/src/App.jsx
```

The Roles tab invitation table now shows:

- Email delivery badge
- Attempt count
- Last attempt timestamp
- Email error message, if any
- Resend email button for pending invites

## Email statuses

| Status | Meaning |
|---|---|
| `sent` | Invite email was sent successfully. |
| `failed` | SMTP attempted delivery but failed. |
| `pending` | Email send is queued/in progress during request handling. |
| `not-configured` | SMTP environment variables are missing. |
| `not-requested` | Email was not needed, usually because the user already exists. |

## Audit actions

```text
invite.email.sent
invite.email.failed
invite.email.resent
invite.email.resend_failed
```

## Test flow

1. Sign in as Admin.
2. Open Roles.
3. Create an invite for a new email address.
4. Confirm the invite row shows Email sent.
5. Confirm the invited inbox receives the message.
6. Click Resend email and confirm attempt count increases.
7. Open Audit and confirm invite email actions are recorded.
8. Use Copy link as the manual fallback if needed.
