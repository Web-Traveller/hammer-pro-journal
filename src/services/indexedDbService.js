/**
 * IndexedDB Service - Zero-cost, high-capacity local browser storage
 * Stores screenshots (Base64/Blobs) and large trading log archives up to hundreds of megabytes
 * without encountering the 5MB LocalStorage limit.
 */

const DB_NAME = 'HammerProJournalDB';
const DB_VERSION = 1;
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
      if (!db.objectStoreNames.contains(STORE_SCREENSHOTS)) {
        db.createObjectStore(STORE_SCREENSHOTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_LOGS)) {
        db.createObjectStore(STORE_LOGS, { keyPath: 'date' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbSaveScreenshot(date, filename, dataUrl) {
  try {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCREENSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SCREENSHOTS);
      const id = `${date}_${filename}`;
      store.put({ id, date, filename, dataUrl, createdAt: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IDB Save Screenshot failed:', e);
    return false;
  }
}

export async function idbLoadScreenshots(date) {
  try {
    const db = await openDB();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCREENSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SCREENSHOTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const filtered = all
          .filter(item => item.date === date)
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

export async function idbDeleteScreenshot(date, filename) {
  try {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCREENSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SCREENSHOTS);
      const id = `${date}_${filename}`;
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    return false;
  }
}

export async function idbDeleteSessionScreenshots(date) {
  try {
    const db = await openDB();
    if (!db) return false;
    const all = await idbLoadScreenshots(date);
    for (const item of all) {
      await idbDeleteScreenshot(date, item.filename);
    }
    return true;
  } catch (e) {
    return false;
  }
}
