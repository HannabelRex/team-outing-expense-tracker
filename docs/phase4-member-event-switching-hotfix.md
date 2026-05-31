# Phase 4 Hotfix: Member Event Switching

This hotfix keeps the Phase 4 member event scoping protection, but allows Members to switch between only the events where their login email is tagged as a participant.

## Behavior

- Admin can see the Events tab and switch all events.
- Finance can see the Events tab and switch all events.
- Member cannot see the Events tab.
- Member can use the header event dropdown only when they are tagged in more than one event.
- Member cannot switch to events where they are not tagged as a participant.
- Member event selection is saved per user as `activeEventId`, so it does not change the global active event for Admin/Finance.

## Matching rule

A member belongs to an event when their Supabase login email matches the participant `email`, `emailOrPhone`, or one of the tokens in `emailOrPhone`.

Example:

```text
Member login email: ravi@example.com
Participant Email/Phone: ravi@example.com
```

## Deployment

Copy these files into the project:

```text
client/src/App.jsx
server/src/index.js
docs/phase4-member-event-switching-hotfix.md
```

Then commit and push:

```powershell
git add client/src/App.jsx server/src/index.js docs/phase4-member-event-switching-hotfix.md
git commit -m "Allow members to switch assigned events"
git push
```

Redeploy both Vercel and Render.

## Health check

After Render redeploys, `/api/health` should include:

```json
{
  "memberEventScoping": "enabled",
  "memberEventSwitching": "enabled"
}
```
