# Theme Picker Mobile Center Hotfix

The theme picker now opens as a centered modal on mobile screens instead of anchoring to the header button and overflowing outside the viewport.

## What changed

- Added a mobile-only backdrop behind the theme picker.
- Centered the theme picker panel on small screens.
- Limited the theme picker width to the viewport.
- Added vertical scrolling inside the panel when screen height is small.
- Preserved the existing desktop dropdown behavior.

## Files changed

- `client/src/App.jsx`
- `client/src/styles.css`

## Testing

1. Open the app on a mobile screen.
2. Tap **Themes**.
3. Confirm the picker opens in the center of the screen.
4. Confirm all theme options are visible or scrollable.
5. Tap outside the picker to close it.
6. Select a theme and confirm it applies.
