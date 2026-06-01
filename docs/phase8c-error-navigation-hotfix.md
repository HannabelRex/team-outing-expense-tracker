# Phase 8C - Error Page Navigation Hotfix

## Purpose

This hotfix prevents users from being trapped on full-screen error pages.

## What changed

- Added a reusable error recovery screen.
- Added `Retry`, `Go to home screen`, and `Go to sign in` actions on blocking error pages.
- Added a React error boundary so unexpected render errors show a recoverable screen instead of a blank/blocked page.
- Kept normal inline form errors unchanged.

## User behavior

If the app cannot load dashboard data or a screen crashes, users can now:

1. Retry loading the page.
2. Return to the app home screen.
3. Clear the current session and go back to sign in.

## Files changed

- `client/src/App.jsx`

## Testing

1. Sign in normally and confirm the app still loads.
2. Use the app as Admin, Finance, and Member.
3. Temporarily break connectivity or wait for a backend/API failure.
4. Confirm the full-screen error page shows navigation buttons.
5. Click `Go to sign in` and confirm the login screen opens.
6. Click `Go to home screen` and confirm the app reloads at the dashboard/home route.
