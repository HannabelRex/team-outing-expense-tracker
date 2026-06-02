# Final Closure Whole-Rupee Rounding Hotfix

## Purpose

Final pool closure amounts are now shown as whole rupee values for practical cash/UPI settlement.

Example:

- Exact amount: `INR 111.54`
- Rounded payable/refund amount: `INR 112`

Another example:

- Exact amount: `INR 111.39`
- Rounded payable/refund amount: `INR 111`

## Why

Final closure settlement may create decimal values when remaining pool balance is distributed proportionally. Users should not be asked to pay decimal rupee amounts, but the exact non-rounded amount must remain visible so the financier can tally round-off differences and avoid paying silently from their own pocket.

## Behavior

The app now stores/displays both:

- Rounded whole-rupee amount for actual payment
- Exact non-rounded amount for reconciliation
- Round-off adjustment amount

## Affected areas

- Settlements tab → Final pool closure summary cards
- Final pool closure participant rows
- Mark refund paid / Mark collected action amount
- PDF final closure table
- CSV export final closure columns

## Notes

Backend calculation still preserves exact values. Rounded values are added as separate fields so reports and UI can show both versions.
