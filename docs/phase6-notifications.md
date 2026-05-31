# Phase 6: Notifications and reminders

Phase 6 adds a real notification workflow to the Team Outing Expense Tracker.

## What changed

- Admin and Finance can send reminders from the Notifications tab.
- Members still cannot see the Notifications tab.
- Reminders can target:
  - all participants with an email address,
  - participants with pending balances,
  - selected participants.
- Reminders are saved in each event's notification history.
- Optional SMTP email delivery is supported.
- If SMTP is not configured, reminders are still stored in the app as in-app history.

## Render environment variables for email

Add these only to the backend service on Render:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=Team Outing Expense Tracker <your-email@gmail.com>
```

For Gmail, use an App Password, not your normal Gmail password.

## Health check

After deployment, `/api/health` should show:

```json
{
  "inAppNotifications": "enabled",
  "emailNotifications": "configured"
}
```

If SMTP is not configured, `emailNotifications` shows `not-configured`. In-app history still works.

## Testing

1. Sign in as Admin or Finance.
2. Open Notifications.
3. Choose a target group.
4. Choose channel: In-app, Email, or In-app + email.
5. Send the reminder.
6. Check reminder history.
7. If using email, check recipient inboxes.

## Notes

The notification system uses participant email/contact values. For email delivery, participant contact must contain a valid email address.
