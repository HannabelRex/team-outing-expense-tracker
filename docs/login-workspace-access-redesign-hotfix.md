# Login Workspace Access Redesign Hotfix

## Purpose

This hotfix replaces the previous animated login copy with a clearer, mobile-first workspace access screen.

## What changed

- Reworded the login, signup, forgot password, reset password, and invite messages for clarity.
- Login form remains first on mobile so users do not need to scroll before signing in.
- Desktop layout keeps the login form on the left and a simplified product explanation panel on the right.
- Removed confusing marketing-style wording and replaced it with direct product language.
- The right panel now explains the workflow clearly: plan, track, settle, report.
- On small mobile screens, the showcase panel is hidden to keep login fast and focused.

## Preserved behavior

- Sign in
- Signup
- Invite-aware signup/signin
- Forgot password
- Password reset
- Glassmorphism background
- CSS-only animation
- Reduced-motion support

## Validation

The following checks were run:

```powershell
cd client
npx --yes tsc --jsx react-jsx --allowJs --checkJs false --noEmit --skipLibCheck --moduleResolution node --module esnext --target es2020 src/App.jsx src/offlineStorage.js
cd ..\server
node --check src/index.js
npm run test:logic
```

Result:

```text
Expense calculation tests passed.
```
