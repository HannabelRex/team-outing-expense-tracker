# Budget Collection Expected Rounding Hotfix

This hotfix makes the rounded suggested collection amount the actual expected amount for non-custom participant collection records.

## Problem fixed

After the collection split was rounded up to a clean figure, the summary could show a rounded suggested value such as `INR 5,800`, while existing participant rows still displayed the old decimal split such as `INR 5,769.23`.

That happened when older non-custom collection records already had a stored expected amount from before the rounding rule was introduced.

## New behavior

- Suggested collection is rounded up to the nearest 100.
- Non-custom participant expected amounts now use the rounded suggested amount.
- Expected collection total is based on the rounded participant amount multiplied by participant count.
- Custom expected amounts are preserved.
- Dashboard, Budget Collection Tracker, Fund Pool, and reports now align with the rounded expected amount.

## Example

Raw split:

```text
INR 74,999.99 / 13 = INR 5,769.23
```

Rounded suggested amount:

```text
INR 5,800
```

Expected collection:

```text
13 x INR 5,800 = INR 75,400
```

Participant expected amount:

```text
INR 5,800
```

## Notes

If a participant expected amount was manually edited, it remains custom and is not overwritten unless Admin/Finance clicks `Reset expected to suggested`.
