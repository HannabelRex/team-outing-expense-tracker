# Phase 23 - Responsive Full-Screen and Mobile UX Upgrade

Phase 23 improves the app shell for wide desktop screens and mobile users.

## Desktop / large-screen updates

- The app shell now uses a wider responsive container instead of the older narrow centered width.
- Header, navigation, main content, errors, and footer now align to a wider layout up to about 1760px.
- The tab row wraps on desktop instead of forcing awkward horizontal scrolling when enough width is available.
- Dashboard content can use more horizontal room on large monitors while still staying readable.

## Mobile updates

- A mobile bottom navigation bar was added for primary areas: Dashboard, Expenses, Budget, and More.
- Secondary modules are now available from a centered More panel on mobile.
- The desktop tab row is hidden on mobile to avoid the long horizontal pill-scroll experience.
- The Expenses list now renders as mobile cards on small screens while keeping the full table on tablet/desktop.
- Extra bottom spacing was added so fixed mobile navigation does not cover content.
- Mobile header and sections have tighter spacing and friendlier sizing.

## No backend changes

This is a frontend UX update only. It does not add backend routes, database changes, or environment variables.
