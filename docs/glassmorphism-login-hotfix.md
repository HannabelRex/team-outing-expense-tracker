# Glassmorphism Login Experience Hotfix

## Summary

This hotfix replaces the plain authentication screen with a premium glassmorphism login experience inspired by floating receipts and SaaS dashboard previews.

## What changed

- Added animated gradient/aurora background.
- Added split layout with product showcase and login/signup card.
- Added floating animated cards for budget, receipts, approvals, and settlements.
- Added mini SaaS-style outing snapshot card.
- Kept existing login, signup, invite-aware signup, forgot-password, and password-reset behavior.
- Added CSS-only animations with `prefers-reduced-motion` support.
- No backend changes, database changes, or environment variables are required.

## Files changed

- `client/src/App.jsx`
- `client/src/styles.css`
- `README.md`
- `docs/glassmorphism-login-hotfix.md`

## Testing checklist

1. Open the app while signed out.
2. Confirm the new animated glassmorphism login screen appears.
3. Test normal sign in.
4. Test signup.
5. Test invite-link signup.
6. Test forgot password.
7. Test mobile responsiveness.
8. Confirm app performance remains normal after sign-in.

## Accessibility

Animations are CSS-only and respect `prefers-reduced-motion: reduce`.
