# Phase 14 - Offline Receipt Queue and Attachment Sync

Phase 14 upgrades the offline expense workflow so users can attach receipt files to offline expense drafts and sync the full expense later.

## Summary

Phase 13 allowed text-only offline expense drafts. Phase 14 adds offline receipt attachment support using browser IndexedDB for file storage and the existing online receipt upload endpoint during sync.

## Features added

- Offline receipt attachment for new expense drafts
- IndexedDB storage for receipt file blobs
- Receipt metadata saved with the local draft
- Offline draft queue shows receipt file name, size, and upload status
- Sync uploads the receipt first, then creates the expense through the existing expense API
- Local draft is removed only after both receipt upload and expense creation succeed
- Failed drafts remain in the queue with the error message
- Manual retry continues to work
- Offline receipt upload remains blocked for editing existing expenses
- Service worker cache bumped to `team-outing-expense-tracker-v5`

## Files changed

```text
client/src/App.jsx
client/src/offlineStorage.js
client/public/service-worker.js
README.md
docs/phase14-offline-receipt-sync.md
```

## Storage design

Draft metadata continues to use browser `localStorage`:

```text
team-outing-offline-expense-drafts-v1
```

Receipt files are stored in IndexedDB:

```text
Database: team-outing-offline-receipts-v1
Object store: offlineReceipts
Key: draftId
```

Each receipt record stores:

- Draft ID
- File/blob
- File name
- MIME type
- File size
- Saved timestamp

## Sync flow

When the app reconnects and the user opens the Expenses tab:

1. Find offline drafts for the current event and current user.
2. Mark the draft as syncing.
3. If the draft has an offline receipt, read it from IndexedDB.
4. Upload the receipt through `POST /api/receipts/upload`.
5. Store the uploaded receipt object in the draft metadata.
6. Create the expense through `POST /api/expenses`.
7. Delete the local draft and local receipt file only after the expense is saved.

## Failure handling

If receipt upload or expense creation fails:

- The draft remains in the queue.
- The receipt remains in IndexedDB unless it has already uploaded.
- The error is shown on the draft row.
- The user can retry with `Sync now`.

If the receipt upload succeeds but expense creation fails, the uploaded receipt object is kept in the draft metadata so the next sync attempt does not upload the same receipt again.

## Limitations

- Offline receipt sync depends on browser IndexedDB availability.
- Offline receipt support applies to new expense drafts only.
- Existing expense edits remain blocked offline.
- If the browser storage is cleared, local offline drafts and receipts are lost.

## Testing checklist

1. Open the app online and sign in.
2. Go to Expenses.
3. Switch Chrome DevTools Network to Offline.
4. Create a new expense draft.
5. Attach a JPG, PNG, WebP, or PDF receipt under 4 MB.
6. Save the offline draft.
7. Confirm the draft queue shows the receipt name and size.
8. Refresh while offline and confirm the draft still appears.
9. Restore network.
10. Confirm the receipt uploads, the expense is created, and the draft disappears.
11. Open the new expense receipt link and confirm it works.
12. Test a failed sync by using invalid participant/category data if possible.
13. Confirm failed drafts remain in the queue with a clear error.

## Deployment

No backend routes, database schema changes, or Render environment variables are required.

Push the frontend changes to GitHub and let Vercel redeploy.
