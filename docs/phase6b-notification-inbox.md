# Phase 6B: Notification Inbox

Phase 6B adds a personal in-app notification inbox to the header.

## Added

- Inbox button with unread count in the app header.
- Notification drawer for Admin, Finance, and Members.
- Members see only reminders addressed to their participant email in the current assigned event.
- Admin and Finance see reminders for the selected event.
- Mark a notification as read.
- Mark all visible notifications as read.
- Backend endpoints for notification inbox access.

## Backend endpoints

- `GET /api/notification-inbox`
- `POST /api/notification-inbox/:id/read`
- `POST /api/notification-inbox/read-all`

## Health check

`/api/health` now includes:

```json
{
  "notificationInbox": "enabled"
}
```

## Role behavior

| Role | Notifications tab | Inbox button |
| --- | --- | --- |
| Admin | Visible | Visible |
| Finance | Visible | Visible |
| Member | Hidden | Visible |

Members still cannot use the full Notifications sender console. They only receive a personal inbox.
