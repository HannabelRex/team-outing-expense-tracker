# Phase 25D - Mobile Data Cards and Table Readability Hotfix

## Goal

Improve mobile readability for table-heavy screens where participant names, descriptions, and currency amounts wrapped into multiple lines on narrow screens.

## What changed

- Added reusable mobile ledger card components in `client/src/App.jsx`.
- Added reusable mobile detail tiles for compact value pairs.
- Added mobile-first CSS classes in `client/src/styles.css`.
- Kept desktop table layouts unchanged.
- Switched mobile views from cramped tables to compact ledger-style cards.
- Added no-wrap money styling so amounts do not split across lines.
- Added fallback no-wrap table styling for any remaining table cells on mobile.

## Mobile card coverage

The following areas now use card/list layouts on mobile:

- Dashboard participant balances
- Analytics event comparison
- Event setup event list
- Participants list
- Budget collection tracker
- Team fund pool ledger
- Final pool closure rows
- User invitation list
- Role/user access list

Expenses, Claims, and Audit already used card-style mobile layouts and continue to use them.

## UX behavior

### Desktop

Desktop keeps the existing tables because wide screens are where tables belong. Civilization occasionally learns.

### Mobile

Mobile now shows a ledger feed pattern:

- Main name/title on the left
- Amount/status on the right
- Important metadata on one compact line
- Optional chips for status/role/type
- Details shown in compact tiles
- Actions shown below the card

This avoids ugly second-line wrapping for names and currency values.

## Technical notes

- Frontend-only change.
- No backend changes.
- No database changes.
- No environment variable changes.
- Vercel redeploy only.

## Validation

Validated with:

```bash
node --check server/src/index.js
node server/src/calculations.test.js
npm --prefix client run build
```

Build passed. The existing Vite large bundle warning is unrelated to this hotfix.
