# Phase 10 - Receipt Storage Cleanup

## Summary

Phase 10 adds backend receipt lifecycle cleanup for Supabase Storage.

Before this phase, deleting an expense or replacing a receipt removed the receipt reference from the app data, but the old file could remain in the `receipts` storage bucket. This phase cleans up those orphaned receipt files.

## Included changes

### Backend

Updated `server/src/index.js`.

New helper logic:

- Extract a Supabase Storage path from a receipt object or URL.
- Delete receipt files from the configured Supabase Storage bucket.
- Log cleanup success/failure safely without exposing secrets.
- Add audit entries for receipt cleanup activity.
- Deduplicate receipt cleanup by storage path when cleaning up event-level references.

### Cleanup scenarios

| Scenario | Behavior |
|---|---|
| Expense deleted | Linked receipt file is deleted from Supabase Storage after app data is saved. |
| Receipt replaced | Old receipt file is deleted after the expense points to the new receipt. |
| Receipt removed from expense | Old receipt file is deleted after the expense is saved without the receipt. |
| Draft event deleted | Any receipt references found in the deleted event are cleaned up after the event is removed. |
| Cleanup failure | App data remains saved; failure is logged and written to audit. |

## Audit actions

Phase 10 adds these receipt-related audit actions:

```text
receipt.deleted
receipt.cleanup_not_found
receipt.delete_failed
```

## Health check

`/api/health` now includes:

```json
"receiptCleanup": "enabled"
```

when Supabase storage configuration is available.

## Important behavior

The app saves business data first, then attempts receipt cleanup. This avoids the dangerous situation where a file is deleted but the app still references it because the database save failed.

If cleanup fails, the expense/event operation still succeeds. The cleanup failure is captured in Render logs and Audit so it can be diagnosed later.

## Render requirements

Receipt cleanup uses the same existing storage variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=receipts
```

No new Render environment variables are required.

## Testing checklist

1. Create an expense with a receipt.
2. Delete that expense.
3. Confirm the receipt object is removed from Supabase Storage.
4. Create another expense with a receipt.
5. Edit the expense and upload a replacement receipt.
6. Confirm the old receipt is removed and the new receipt still opens.
7. Check the Audit tab for receipt cleanup entries.
8. Check Render logs for `Receipt cleanup completed`.

