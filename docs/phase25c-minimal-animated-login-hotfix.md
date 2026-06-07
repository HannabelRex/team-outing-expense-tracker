# Phase 25C - Minimal Animated Login Screen Hotfix

## Goal

Remove the large right-side marketing/showcase panel from the sign-in screen and replace it with a minimal, stylish, animated login experience.

## Changes

- Removed the large desktop showcase panel from the authentication screen.
- Centered the sign-in/signup/reset card on the page.
- Added a subtle animated background with aurora glow, rotating halo, and light glass sweep.
- Added small floating feature chips on desktop only.
- Kept the mobile screen compact and simple by hiding decorative chips and reducing card spacing.
- Preserved all authentication modes:
  - Sign in
  - Create account
  - Forgot password
  - Reset password
  - Invite-based signup/login
- Preserved the existing password reset and invite acceptance flows.

## Files changed

- `client/src/App.jsx`
- `client/src/styles.css`

## Deployment

Frontend-only change. Deploy through Vercel after pushing to GitHub.

No backend changes, database changes, Render deployment, or new environment variables are required.
