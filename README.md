# Team Outing Expense Tracker - Phase 12 Offline PWA Mode

This package upgrades the Team Outing Expense Tracker with safe offline PWA behavior and sync visibility.

## Phase 12 summary

The app now detects online/offline status, keeps a cached copy of the latest `/api/bootstrap` outing data in the browser, and blocks write actions while offline so users do not accidentally believe unsaved changes were stored.

Key additions:

- Online/offline status chip in the app header
- Offline/sync banner with last synced timestamp
- Cached last successful bootstrap data in localStorage
- Offline fallback loading from cached outing data
- Write API calls blocked while offline with a clear user message
- Report downloads blocked while offline with a clear message
- Inbox refresh paused while offline
- Event switching disabled while offline
- Service worker cache upgraded to v4
- Offline fallback page added at `/offline.html`
- Runtime caching for same-origin static assets

## Files changed

```text
client/src/App.jsx
client/public/service-worker.js
client/public/offline.html
client/public/manifest.webmanifest
README.md
docs/phase12-offline-pwa.md
```

## Backend changes

No backend route, database, or Render environment variable changes are required for this phase.

## Deploy steps

```powershell
cd C:\Users\ksath\Downloads\team-outing-expense-tracker-mobile-pwa\team-outing-expense-tracker

git status

git add -A

git commit -m "Add offline PWA mode"

git push origin main
```

Vercel should redeploy the frontend automatically after the push. Render does not need a backend configuration change for Phase 12.

## Testing checklist

1. Sign in while online and let the dashboard load once.
2. Confirm the header shows Online and the banner/footer show Last synced.
3. Open browser DevTools, set Network to Offline, or disconnect internet.
4. Refresh the app and confirm cached outing data still appears.
5. Try a write action, such as creating an expense or switching event, and confirm it is blocked with an offline message.
6. Confirm report download is blocked while offline.
7. Restore internet and confirm the app refreshes data and returns to Online.
8. In Chrome Application tab, verify service worker version `team-outing-expense-tracker-v4` is active after reload.

## PWA cache reset if old behavior appears

1. Open Chrome DevTools.
2. Go to Application.
3. Service Workers -> Unregister.
4. Storage -> Clear site data.
5. Close and reopen the app.
6. Hard refresh with Ctrl + Shift + R.
