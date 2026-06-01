# Phase 16 - Login Performance Optimization

Phase 16 improves the first screen after sign-in without changing database schema, routes, or deployment providers.

## Goals

- Show useful app data faster after sign-in.
- Avoid waiting on non-critical requests before the dashboard appears.
- Reduce avoidable full-state writes from read-only requests.
- Add backend timing logs so slow loading can be measured instead of guessed.

## Frontend changes

### Immediate cached bootstrap display

The app now stores `/api/bootstrap` data under a session-scoped cache key. After sign-in, if a matching cached bootstrap payload exists for the signed-in user, the app displays it immediately while refreshing the latest server data in the background.

This improves perceived loading time for returning users.

### Session-safe cache keys

The bootstrap cache key now includes the signed-in user's identity derived from the Supabase session/JWT. Cached data is only used if it matches the current session user.

### Delayed inbox refresh

The notification inbox refresh now waits briefly after the dashboard data is visible. This prevents `/api/notification-inbox` from competing with `/api/bootstrap` during the critical post-login render.

### Analytics memoization

Analytics calculations are wrapped with `useMemo` so chart and summary data is recalculated only when the underlying app data changes.

## Backend changes

### Bootstrap timing logs

`GET /api/bootstrap` now logs measured timing segments in Render logs:

```text
Bootstrap performance timing {
  readStoreMs,
  normalizeAndUserMs,
  calculateMs,
  conditionalWriteMs,
  responseBuildMs,
  totalMs
}
```

Use these logs to identify whether slow sign-in is caused by Supabase read time, calculation time, write time, or response construction.

### Conditional read-write behavior

Previously, read-heavy endpoints could rewrite the full JSON state because `resolveAppUser` updated `lastLoginAt` on every authenticated request. Phase 16 adds a dirty-store flag and updates `lastLoginAt` only if it is older than 10 minutes.

Read-heavy endpoints now call `writeStoreIfDirty(data)` instead of always writing the full app state:

- `GET /api/bootstrap`
- `GET /api/events`
- `GET /api/audit`
- `GET /api/notification-inbox`
- `GET /api/admin/backup/auto-status`

This reduces avoidable Supabase JSON writes during login and tab refreshes.

## New health flag

`GET /api/health` now includes:

```json
"loginPerformanceOptimization": "enabled"
```

## Deployment impact

No new environment variables are required.

Both frontend and backend files changed, so both Vercel and Render may redeploy.

## Testing checklist

1. Sign in once online and let the dashboard load.
2. Sign out and sign in again.
3. Confirm cached dashboard data appears quickly.
4. Confirm the app refreshes latest data in the background.
5. In Render logs, check `Bootstrap performance timing`.
6. Confirm Inbox still loads after the dashboard appears.
7. Open Analytics and confirm charts still render.
8. Open Audit and Data tabs as Admin/Finance and confirm they still load.

## Git deploy

```powershell
cd C:\Users\ksath\Downloads\team-outing-expense-tracker-mobile-pwa\team-outing-expense-tracker

git status

git add -A

git commit -m "Optimize login loading performance"

git push origin main
```
