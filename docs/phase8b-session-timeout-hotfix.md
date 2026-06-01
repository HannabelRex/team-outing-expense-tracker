# Phase 8B - Session Timeout Hotfix

This hotfix adds a client-side idle session timeout.

## Behavior

- Default timeout: 30 minutes of inactivity.
- The timeout can be changed in Vercel with `VITE_SESSION_TIMEOUT_MINUTES`.
- User activity such as click, key press, mouse move, scroll, or touch refreshes the idle timer.
- When the timer expires, the saved session is cleared and the user is sent back to the Sign in screen.
- The Sign in screen shows: `Your session timed out after X minutes. Please sign in again.`
- API calls and file downloads also check the idle timeout before running.

## Optional Vercel environment variable

```text
VITE_SESSION_TIMEOUT_MINUTES=30
```

If omitted, the app uses 30 minutes.

## Test

1. Sign in.
2. Set `VITE_SESSION_TIMEOUT_MINUTES=1` in Vercel for testing if you want a quick test.
3. Wait without touching the app.
4. Confirm the app returns to the Sign in screen.
5. Sign in again and confirm the app works normally.
