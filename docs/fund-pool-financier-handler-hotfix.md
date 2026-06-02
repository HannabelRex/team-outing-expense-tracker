# Fund Pool Financier Handler Hotfix

## Summary

This hotfix makes the Event setup page the source of truth for the common pool handler / financier used for team fund pool expenses.

## What changed

- Event setup now includes **Common pool handler / financier**.
- Admin/Finance can select one participant as the financier for the collected fund pool.
- Members can view the configured financier in read-only event setup.
- When an expense is marked as **Paid from team fund pool**, the expense form automatically uses the Event setup financier as **Handled by financier**.
- The handler is no longer manually selected for pool expenses from the expense form.
- Split method and Participants involved are hidden for pool-paid expenses.
- Pool-paid expenses no longer create participant split shares because the participants already contributed to the common pool.
- Backend enforces the financier rule and blocks pool expenses if no financier is configured.
- Personal participant-paid expenses keep the existing split behavior.

## Files changed

- `client/src/App.jsx`
- `server/src/index.js`
- `server/src/calculations.js`
- `server/src/calculations.test.js`
- `README.md`

## Validation

Backend validation:

```powershell
cd server
node --check src/index.js
node --check src/calculations.js
npm run test:logic
cd ..
```

Frontend parse validation:

```powershell
cd client
npx --yes tsc --jsx react-jsx --allowJs --checkJs false --noEmit --skipLibCheck --moduleResolution node --module esnext --target es2020 src/App.jsx src/offlineStorage.js
cd ..
```
