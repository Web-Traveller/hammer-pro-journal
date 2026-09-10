/**
 * IndexedDB Service - Zero-cost, high-capacity local browser storage
 * Stores screenshots (Base64/Blobs) and large trading log archives up to hundreds of megabytes
 * without encountering the 5MB LocalStorage limit.
 *
 * Account Isolation: All screenshot keys are namespaced as `{accountId}_{date}_{filename}`
 * to ensure screenshots never bleed between accounts.
 */

const DB_NAME = 'HammerProJournalDB';
const DB_VERSION = 2; // Bumped to 2: screenshot store rebuilt with account-scoped keys
const STORE_SCREENSHOTS = 'session_screenshots';
const STORE_LOGS = 'session_logs';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      // Drop and recreate screenshot store to apply the new account-scoped key scheme
      if (db.objectStoreNames.contains(STORE_SCREENSHOTS)) {
        db.deleteObjectStore(STORE_SCREENSHOTS);
      }
      db.createObjectStore(STORE_SCREENSHOTS, { keyPath: 'id' });

      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        db.createObjectStore(STORE_LOGS, { keyPath: 'date' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a screenshot. Key is account-scoped: `{accountId}_{date}_{filename}`
 */
export async function idbSaveScreenshot(date, filename, dataUrl, accountId = 'default') {
  try {
    const db = await openDB();
    if (!db) return false;
    const safeAccountId = accountId || 'default';
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCREENSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SCREENSHOTS);
      const id = `${safeAccountId}_${date}_${filename}`;
      store.put({ id, accountId: safeAccountId, date, filename, dataUrl, createdAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IDB Save Screenshot failed:', e);
    return false;
  }
}

/**
 * Load screenshots for a specific date AND account.
 */
export async function idbLoadScreenshots(date, accountId = 'default') {
  try {
    const db = await openDB();
    if (!db) return [];
    const safeAccountId = accountId || 'default';
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCREENSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SCREENSHOTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const filtered = all
          .filter(item => item.date === date && (item.accountId || 'default') === safeAccountId)
          .map(item => ({ filename: item.filename, dataUrl: item.dataUrl }));
        resolve(filtered);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IDB Load Screenshots failed:', e);
    return [];
  }
}

/**
 * Delete a single screenshot. Must include accountId so the correct key is targeted.
 */
export async function idbDeleteScreenshot(date, filename, accountId = 'default') {
  try {
    const db = await openDB();
    if (!db) return false;
    const safeAccountId = accountId || 'default';
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCREENSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SCREENSHOTS);
      const id = `${safeAccountId}_${date}_${filename}`;
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    return false;
  }
}

/**
 * Delete ALL screenshots for a session date, strictly scoped to one account.
 */
export async function idbDeleteSessionScreenshots(date, accountId = 'default') {
  try {
    const db = await openDB();
    if (!db) return false;
    const all = await idbLoadScreenshots(date, accountId);
    for (const item of all) {
      await idbDeleteScreenshot(date, item.filename, accountId);
    }
    return true;
  } catch (e) {
    return false;
  }
}
