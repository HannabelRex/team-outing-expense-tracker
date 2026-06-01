# Login Floating Cards Safe-Space Hotfix

## Purpose

The animated login showcase cards were visually overlapping the main headline and dashboard preview. This made the login screen look busy and made the content harder to read.

## Changes

- Moved floating cards to safer edge/corner positions.
- Lowered floating card stacking order so the main headline, description, and dashboard preview always stay visually dominant.
- Added `pointer-events: none` to prevent decorative cards from blocking clicks or text selection.
- Reduced visual weight with softer opacity and gentler movement.
- Added a dedicated `auth-showcase-copy` layer so login copy stays above decorative flyers.
- Kept the existing CSS-only animations and reduced-motion support.

## Result

The floating receipt/dashboard cards still animate, but they now behave as background decoration instead of fighting the actual login content like tiny glass rectangles with main-character syndrome.

## Files changed

- `client/src/App.jsx`
- `client/src/styles.css`
- `README.md`
- `docs/login-floating-cards-safe-space-hotfix.md`
