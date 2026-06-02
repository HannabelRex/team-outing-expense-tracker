# Phase 24 Mobile Viewport Optimization Hotfix

## Goal

Make the mobile experience behave like an app instead of a long web page. The outer browser page should not scroll on phones. The logged-in shell stays inside the visible device viewport, while the active module area scrolls only when its content genuinely needs more height.

## What changed

- Added a dedicated `app-shell` wrapper class to the authenticated app shell.
- Added mobile-specific classes for the header, event title, event metadata, header actions, bottom navigation grid, More panel, content viewport, footer, and toast.
- Converted the mobile authenticated shell to a fixed-height `100dvh` flex layout.
- Prevented body/page scrolling on mobile for the authenticated shell.
- Moved scroll behavior into `.app-content-scroll`, so the active tab is the controlled scroll container.
- Hid the footer on mobile to prevent wasted vertical space.
- Reduced mobile header height by tightening title, metadata, and action button sizing.
- Made header actions horizontally swipeable instead of wrapping into multiple rows.
- Reduced bottom navigation height and safe-area spacing.
- Reduced More panel height and spacing so it fits shorter devices.
- Added mobile fallback rules for narrow phones and short screens.
- Added overflow guards for charts, tables, long text, SVGs, canvas elements, and images.
- Repositioned the theme menu and toast on mobile so they stay within the viewport.

## Files changed

- `client/src/App.jsx`
- `client/src/styles.css`
- `docs/phase24-mobile-viewport-optimization-hotfix.md`

## Validation

- `node --check server/src/index.js`
- `node server/src/calculations.test.js`
- `npm run build` inside `client`

The production frontend build succeeds. Vite still reports the existing large bundle warning, which is not caused by this hotfix.

## Notes

This hotfix removes unwanted outer-page scrolling on mobile. Some modules with large datasets, charts, tables, or long forms may still scroll inside the active content area. That is intentional. A phone cannot physically fit every receipt, claim, itinerary, settlement, and tiny financial panic attack into one static screen.
