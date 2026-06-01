# Theme Picker Hotfix

## Summary

Adds a top-header **Themes** button that is visible to every signed-in role: Admin, Finance, and Member.

The selected theme is saved in browser `localStorage`, so each user/browser keeps their own visual preference without changing shared app data.

## Included themes

- Signature Blend
- Travel Blue + Emerald
- Sunset Coral + Indigo
- Electric Cyan + Royal Purple
- Forest Green + Gold
- Coorg Nature Theme

## Behavior

- User clicks **Themes** in the top header.
- A theme palette menu opens.
- Selecting a theme immediately updates the header, nav tabs, buttons, cards, shadows, and background accent colors.
- The preference persists on the same browser/device.
- No backend route, database change, or Render/Vercel environment variable is required.

## Files changed

- `client/src/App.jsx`
- `client/src/styles.css`
- `README.md`
- `docs/theme-picker-hotfix.md`

## Testing checklist

1. Sign in as Admin and switch themes.
2. Refresh the browser and confirm the selected theme persists.
3. Sign in as Finance and confirm the Themes button is visible.
4. Sign in as Member and confirm the Themes button is visible.
5. Confirm nav active tabs and primary buttons follow the selected palette.
6. Confirm no expense/report/settlement data changes when changing themes.
