# Phase 6B Auth Refresh Hotfix

This hotfix fixes notification send failures caused by an expired Supabase access token.

## Symptoms

The app is signed in and visible, but notification send fails with:

- `POST /api/notifications/send-preview 401 Unauthorized`
- Browser console shows `send-preview` returning `502` or `401`
- In-app-only reminders fail even though SMTP is not involved

## Fix

The frontend now automatically refreshes the saved Supabase session using the stored refresh token when an API request returns `401`, then retries the request once.

## Files changed

- `client/src/App.jsx`

## Deployment

This is frontend-only. Push the file and wait for Vercel to redeploy. Render does not need redeploy.
