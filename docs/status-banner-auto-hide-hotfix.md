# Status Banner Auto-Hide Hotfix

## Summary

The online/offline sync status ribbon now appears only temporarily instead of staying pinned below the header.

## Behavior

The ribbon appears when:

- the app finishes its initial sync
- the connection changes from online to offline
- the connection changes from offline to online
- the app updates the last synced timestamp
- the offline/cache notice changes

After appearing, the ribbon automatically hides after 5 seconds.

The small Online/Offline chip in the header stays visible permanently.

## Files changed

```text
client/src/App.jsx
README.md
docs/status-banner-auto-hide-hotfix.md
```

## Testing checklist

1. Open the app while online.
2. Confirm the green Online ribbon appears.
3. Wait 5 seconds and confirm it disappears.
4. Use Chrome DevTools Network → Offline.
5. Confirm the offline ribbon appears.
6. Wait 5 seconds and confirm it disappears.
7. Switch DevTools back to No throttling.
8. Confirm the online/restored ribbon appears again.
9. Click Refresh and confirm the ribbon appears again after the last synced timestamp updates.
