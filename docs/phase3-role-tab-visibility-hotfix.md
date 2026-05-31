# Phase 3 Role Tab Visibility Hotfix

This hotfix changes visible navigation tabs by signed-in user role.

## Behavior

- Admin: sees Notifications and Roles.
- Finance: sees Notifications, but not Roles.
- Member: sees neither Notifications nor Roles.

If a user is currently on a tab that becomes unavailable after a role change, the app automatically moves them back to the Dashboard.

## Files changed

- `client/src/App.jsx`

## Deployment

Replace `client/src/App.jsx`, commit, push, and wait for Vercel to redeploy.
Render does not need a redeploy because this is a frontend-only UI change.
