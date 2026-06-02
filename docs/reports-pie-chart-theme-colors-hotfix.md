# Reports Pie Chart Theme Colors Hotfix

## Summary

The Reports tab pie chart now uses the active theme color palette instead of default grayscale chart slices.

## What changed

- Reports pie chart receives the active theme from the main app shell.
- Pie slices use the same theme palette used by Dashboard and Analytics charts.
- Tooltip styling follows the active theme.
- Legend styling follows the active theme.
- Slice borders were added for better separation between categories.

## Files changed

- `client/src/App.jsx`
- `README.md`
- `docs/reports-pie-chart-theme-colors-hotfix.md`

## Testing

1. Sign in as Admin or Finance.
2. Open the Reports tab.
3. Confirm the pie chart has colored slices.
4. Open Themes and switch themes.
5. Confirm the Reports pie chart updates colors with the selected theme.
6. Confirm PDF/CSV export still works.

## Notes

This is a frontend-only visual hotfix. It does not change backend calculations, reports API output, database structure, or environment variables.
