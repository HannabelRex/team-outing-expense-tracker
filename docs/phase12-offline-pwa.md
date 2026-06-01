# Phase 12 - Offline PWA Mode and Sync Safety

## Objective

Improve mobile reliability by allowing the installed PWA to open during weak or missing network conditions, while preventing unsafe writes when the backend cannot be reached.

## What changed

### Frontend app shell

`client/src/App.jsx` now includes:

- `browserIsOnline()` helper using `navigator.onLine`.
- Cached bootstrap data stored in localStorage under `team-outing-bootstrap-cache-v1`.
- Last synced timestamp stored in localStorage under `team-outing-last-synced-at-v1`.
- Safe offline fallback in `reload()`.
- Offline write protection inside the shared `api()` helper.
- Offline download protection inside `downloadApiFile()`.
- Offline banner component with last synced details.
- Online/offline header status chip.
- Offline inbox refresh pause.
- Offline event switch disable.

### Service worker

`client/public/service-worker.js` now uses cache version:

```text
team-outing-expense-tracker-v4
```

It caches:

```text
/
/index.html
/offline.html
/manifest.webmanifest
/icons/icon-192.png
/icons/icon-512.png
```

It also runtime-caches same-origin static assets after they are requested successfully.

### Offline fallback page

`client/public/offline.html` gives users a clean offline page if the app shell cannot fully load.

## Behavior

### Online

- `/api/bootstrap` loads normally.
- Successful bootstrap responses are cached locally.
- Last synced timestamp updates.
- Write actions continue normally.

### Offline with cached data

- App shows the last synced outing data.
- Offline banner explains the state.
- Write API actions are blocked before making a network call.
- Downloads are blocked.
- Inbox refresh is paused.

### Offline without cached data

- App shows a clear message asking the user to reconnect once.

## Not included yet

Phase 12 intentionally does not include offline edit queueing. That should be handled separately because it needs conflict handling, retry status, and receipt upload queue design.

Recommended next phase:

```text
Phase 13 - Offline Expense Draft Queue
```

## Test plan

1. Sign in online.
2. Open Dashboard, Expenses, Reports, and Analytics once.
3. Confirm Last synced is populated.
4. Turn off network.
5. Refresh the app.
6. Confirm cached data appears.
7. Try saving a write action and confirm it is blocked.
8. Restore network.
9. Confirm the app refreshes data successfully.
