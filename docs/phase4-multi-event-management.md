# Phase 4: Multi-Event Management

Phase 4 upgrades Team Outing Expense Tracker from a single-outing tracker into a reusable multi-event application.

## New capabilities

- Admin and Finance users can open the new **Events** tab.
- Admin users can create new outing events.
- Admin users can optionally copy participants from an existing event.
- Admin and Finance users can switch between events.
- Each event has its own participants, categories, expenses, settlements, notifications, receipts, and reports.
- Admin users can mark events as active, completed, archived, or cancelled.
- Events with no expenses can be deleted. Events with expenses should be archived instead.
- Archived or completed events are protected from participant, budget, expense, settlement, and notification edits until reactivated.

## Data migration

The backend automatically migrates the existing single-event JSON state into the new multi-event structure on the first authenticated API call after deployment.

Old shape:

```json
{
  "event": {},
  "participants": [],
  "categories": [],
  "expenses": []
}
```

New shape:

```json
{
  "activeEventId": "evt-...",
  "events": [
    {
      "id": "evt-...",
      "status": "active",
      "event": {},
      "participants": [],
      "categories": [],
      "expenses": [],
      "settlements": [],
      "notifications": []
    }
  ],
  "users": []
}
```

Your existing event data is preserved as the first event.

## Backend endpoints added

- `GET /api/events`
- `POST /api/events`
- `POST /api/events/:id/activate`
- `PATCH /api/events/:id`
- `DELETE /api/events/:id`

The existing endpoints such as `/api/participants`, `/api/categories`, `/api/expenses`, `/api/settlements`, and `/api/reports` now operate against the currently active event.

## Health check

After Render deployment, `/api/health` should include:

```json
{
  "multiEvent": "enabled"
}
```

## Testing checklist

1. Sign in as admin.
2. Confirm the new **Events** tab is visible.
3. Create a new event.
4. Confirm the app switches to that new event.
5. Add participants and expenses to the new event.
6. Switch back to the original event.
7. Confirm the original event data is still there.
8. Switch to the new event again.
9. Confirm the new event has its own isolated data.
10. Mark an event as completed or archived.
11. Confirm edits are blocked until it is reactivated.
12. Reactivate the event and confirm edits work again.

## Role behavior

- Admin: can create, switch, archive, complete, reactivate, and delete draft events.
- Finance: can switch and review events.
- Member: does not see the Events tab.

