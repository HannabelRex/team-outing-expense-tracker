const DB_NAME = 'team-outing-offline-receipts-v1';
const DB_VERSION = 1;
const RECEIPT_STORE = 'offlineReceipts';

function indexedDbAvailable() {
  return typeof window !== 'undefined' && Boolean(window.indexedDB);
}

function openOfflineDb() {
  if (!indexedDbAvailable()) {
    return Promise.reject(new Error('This browser does not support IndexedDB, so offline receipt storage is unavailable. The internet wins this round.'));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECEIPT_STORE)) {
        db.createObjectStore(RECEIPT_STORE, { keyPath: 'draftId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open offline receipt storage. Browser storage is being theatrical.'));
    request.onblocked = () => reject(new Error('Offline receipt storage is blocked by another browser tab. Close duplicate tabs and try again.'));
  });
}

function runStore(mode, operation) {
  return openOfflineDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(RECEIPT_STORE, mode);
    const store = transaction.objectStore(RECEIPT_STORE);
    let request;

    try {
      request = operation(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      db.close();
      resolve(request?.result ?? null);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || request?.error || new Error('Offline receipt storage failed. Very helpful, browser.'));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || request?.error || new Error('Offline receipt storage was aborted.'));
    };
  }));
}

export async function saveOfflineReceiptFile(draftId, file, metadata = {}) {
  if (!draftId) throw new Error('Draft id is required before saving an offline receipt.');
  if (!file) throw new Error('Receipt file is required before saving it offline.');

  const record = {
    draftId,
    file,
    fileName: metadata.fileName || file.name || 'receipt',
    contentType: metadata.contentType || file.type || 'application/octet-stream',
    sizeBytes: Number(metadata.sizeBytes || file.size || 0),
    savedAt: metadata.savedAt || new Date().toISOString()
  };

  await runStore('readwrite', (store) => store.put(record));
  return record;
}

export async function readOfflineReceiptFile(draftId) {
  if (!draftId) return null;
  return runStore('readonly', (store) => store.get(draftId));
}

export async function deleteOfflineReceiptFile(draftId) {
  if (!draftId) return null;
  return runStore('readwrite', (store) => store.delete(draftId));
}

export async function deleteOfflineReceiptFiles(draftIds = []) {
  const ids = Array.isArray(draftIds) ? draftIds.filter(Boolean) : [];
  if (ids.length === 0) return null;
  return runStore('readwrite', (store) => {
    let request = null;
    ids.forEach((id) => {
      request = store.delete(id);
    });
    return request;
  });
}
