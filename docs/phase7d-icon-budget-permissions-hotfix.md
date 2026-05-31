# Phase 7D Hotfix: App Icon + Budget Permissions

## Changes

- Replaced PWA app icons with the new Team Outing Expense Tracker icon.
- Updated `client/public/icons/icon-192.png`.
- Updated `client/public/icons/icon-512.png`.
- Added `client/public/icons/icon-1024-master.png` as a reference master icon.
- Made Budget read-only for Members in the UI.
- Budget add/edit/delete controls are visible only to Admin and Finance.
- Backend category create/update/delete APIs now allow only Admin and Finance.
- Members can still open Budget and view category estimates/actuals.

## Expected permissions

| Feature | Admin | Finance | Member |
|---|---:|---:|---:|
| View Budget | Yes | Yes | Yes |
| Add Budget Category | Yes | Yes | No |
| Edit Budget Category | Yes | Yes | No |
| Delete Budget Category | Yes | Yes | No |

## Health check flags

`/api/health` should include:

```json
{
  "memberBudgetReadOnly": "enabled",
  "financeBudgetManagement": "enabled"
}
```

## PWA icon refresh note

Browsers and installed PWAs aggressively cache icons. After deployment, uninstall the existing installed app from mobile/desktop and install it again to see the new icon.
