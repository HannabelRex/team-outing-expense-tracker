# Phase 13 - Offline Expense Draft Queue and Auto Sync

Phase 13 extends the safe offline PWA mode from Phase 12 by allowing users to create text-only expense drafts while offline. Drafts are stored locally in the browser and synced to the backend when the app comes back online.

## Scope

Included in this phase:

- Offline expense draft creation from the Expenses form
- Local draft queue stored in `localStorage`
- Draft queue section in the Expenses tab
- Automatic sync when the app reconnects
- Manual `Sync now` action
- Delete draft action
- Per-draft status, attempt count, last attempt timestamp, and error display
- Member safety check for paid-by participant email before saving offline drafts
- Receipt upload blocked while offline

Not included in this phase:

- Offline receipt upload queue
- Offline edit/delete of existing expenses
- Conflict resolution beyond backend validation and visible draft errors
- IndexedDB file storage

## Local storage

Offline expense drafts are stored under:

```text
team-outing-offline-expense-drafts-v1
```

Each draft includes:

```text
id
createdAt
updatedAt
lastAttemptAt
status
attempts
lastError
eventId
eventName
userId
userEmail
payload
```

The UI filters drafts by current user and current active event.

## Sync behavior

When the browser reports that the app is online again, the Expenses tab attempts to sync queued drafts for the active event.

For each draft:

1. Mark draft as `syncing`.
2. Validate draft against the currently loaded event data.
3. POST the payload to `/api/expenses`.
4. Remove the draft only after the backend confirms success.
5. Keep failed drafts in the queue with `status: failed` and `lastError`.

The backend remains the final permission gate. Existing server checks still enforce role restrictions, member paid-by ownership, category validity, participant validity, and event access.

## Receipt limitation

Offline drafts do not include receipt files. Receipt upload still requires the server because Supabase Storage needs a live network request. Users should save the text expense offline first, sync it, then attach the receipt online.

## Files changed

```text
client/src/App.jsx
README.md
docs/phase13-offline-expense-sync.md
```

## Testing checklist

### Offline draft save

1. Open the app online and sign in.
2. Go to Expenses.
3. Use browser DevTools Network -> Offline.
4. Fill a new expense without a receipt.
5. Click `Save offline draft`.
6. Confirm the draft appears under Offline expense drafts.
7. Refresh while offline and confirm the draft remains.

### Auto sync

1. Restore network in DevTools.
2. Confirm the draft syncs automatically.
3. Confirm it appears in the normal expense list.
4. Confirm the draft is removed from the queue.

### Manual sync

1. Create another offline draft.
2. Restore network.
3. Click `Sync now`.
4. Confirm success and reload behavior.

### Failed draft

1. Create a draft using a category or participant that later becomes invalid.
2. Sync after reconnecting.
3. Confirm the draft remains with a visible error.

### Member safety

1. Sign in as Member.
2. Go offline.
3. Try to save a draft paid by another participant.
4. Confirm the app blocks it before saving.

