# Final Closure Round-off Balancer Hotfix

This hotfix adds a net round-off balancing summary to Final pool closure.

## Why

Final closure payouts are shown as whole rupee amounts for practical cash/UPI settlement, while the exact calculation may contain paise. Rounding every participant independently can create a small net difference between:

- the rounded cash refund/collection plan, and
- the actual remaining team fund pool balance.

If this difference is hidden, the financier may silently pay from their own pocket or retain excess cash.

## What changed

The backend now calculates:

- `roundedCashNetOutflow`
- `roundOffTargetPoolBalance`
- `netRoundOffImpact`
- `roundOffBalancerAction`
- `roundOffBalancerAmount`
- `roundOffBalancerAmountRounded`
- `totalRefundWithRoundOffBalancer`
- `totalCollectWithRoundOffBalancer`
- `postBalancerCashNetOutflow`
- `postBalancerDifference`

The Settlements tab now shows a Round-off balancer card and a clear action message when a separate round-off collection or refund is required.

## Example

If participant-wise rounded refunds total INR 13,336 and rounded collections total INR 11,880, the rounded cash net outflow is INR 1,456.

If the remaining pool is INR 1,450, the cash plan is short by INR 6.

The app now shows:

- Round-off balancer: collect INR 6
- Rounded cash net
- Available pool
- Post-balancer difference

## Reports

PDF and CSV exports now include the round-off balancer summary so closure reconciliation is visible outside the app as well.
