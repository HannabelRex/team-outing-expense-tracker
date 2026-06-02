# Phase 24B - Mobile UX Polish and Session Retention

## Summary

This hotfix improves the mobile experience after the Phase 24 viewport optimization. Desktop remains unchanged, while mobile gets a more app-like dashboard and faster expense entry.

## Updates included

### Compact mobile Event Health

- Keeps the full Event Health banner on desktop.
- Replaces the mobile banner with a compact one-line health card.
- Shows only the most useful mobile signals:
  - health status
  - budget usage percentage
  - team fund pool balance
  - pending expense count
- Uses healthy, warning, or danger styling based on budget, pending review, collection, and pool status.

### Mobile floating Add Expense button

- Adds a circular `+` floating action button on mobile.
- The button is shown above the bottom navigation.
- It is visible from non-Expense tabs only.
- Tapping it:
  - closes the mobile More panel if open
  - switches to the Expenses tab
  - resets any previous edit state
  - scrolls to the Record an expense section
  - focuses the first input so users can begin immediately

### Mobile session retention

- Mobile/PWA users are no longer forced out by the client-side inactivity timeout.
- The existing Supabase refresh-token flow still handles expired access tokens.
- Manual sign out is still available, but it is moved out of the crowded mobile header and into the More panel.
- Desktop timeout behavior remains unchanged.

## Files changed

- `client/src/App.jsx`
- `client/src/styles.css`
- `docs/phase24b-mobile-ux-session-retention.md`

## Deployment notes

No backend routes, database changes, or environment variables are required.

## Validation

The server syntax check and calculation tests should continue to pass:

```bash
node --check server/src/index.js
node server/src/calculations.test.js
```

Frontend build should be run after installing client dependencies:

```bash
npm --prefix client install
npm --prefix client run build
```
