# Phase 22 - Itinerary Planner

Phase 22 adds an Itinerary tab and Dashboard itinerary preview for Team Outing Expense Tracker.

## What changed

- Added an `Itinerary` tab for all assigned users.
- Admin and Finance users can add, edit, delete, complete, reopen, and cancel itinerary items.
- Members can view the itinerary in read-only mode.
- Itinerary items support title, date, start time, end time, location, category link, notes, and status.
- Completed itinerary items are shown with a strike-through and completion timestamp.
- Dashboard now shows Today's itinerary, next activity, and trip progress.
- PDF and CSV reports now include itinerary summary details.
- Backend APIs were added for itinerary CRUD and status changes.

## Backend APIs

```text
GET /api/itinerary
POST /api/itinerary
PUT /api/itinerary/:id
DELETE /api/itinerary/:id
POST /api/itinerary/:id/complete
POST /api/itinerary/:id/reopen
POST /api/itinerary/:id/cancel
```

## Audit actions

```text
itinerary.created
itinerary.updated
itinerary.deleted
itinerary.completed
itinerary.reopened
itinerary.cancelled
```

## Notes

No new environment variables are required. The feature is stored inside the current event record under `itinerary`.
