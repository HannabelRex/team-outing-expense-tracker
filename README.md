# Team Outing Expense Tracker - Phase 8C Error Navigation Hotfix

This package is a small frontend-only hotfix for the Team Outing Expense Tracker app.

## Included fix

Error screens now include clear navigation actions:

- Retry
- Go to home screen
- Go to sign in

It also adds a React error boundary so unexpected UI errors do not trap users on a blank or dead-end screen.

## Files to copy

Copy these files into your existing project:

```text
client/src/App.jsx
docs/phase8c-error-navigation-hotfix.md
README.md
```

## Deploy steps

```powershell
cd C:\Users\ksath\Downloads\team-outing-expense-tracker-mobile-pwa\team-outing-expense-tracker

git status

git add client/src/App.jsx docs/phase8c-error-navigation-hotfix.md README.md

git commit -m "Add navigation actions to error pages"

git push
```

If Git says `fetch first`:

```powershell
git pull --rebase origin main
git push
```

Vercel should redeploy automatically. Render does not need redeploy because this is frontend-only.
