const DB_NAME = 'royal-realms-chess-db';
const DB_VERSION = 1;
const STORES = ['games', 'stats', 'preferences', 'puzzles'];
let dbPromise;

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise(resolve => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }
  return dbPromise;
}

export async function dbPut(store, id, value) {
  const db = await openDatabase();
  if (!db || !STORES.includes(store)) return false;
  return new Promise(resolve => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put({ id, value, updatedAt: Date.now() });
    tx.oncomplete = () => resolve(true);
    tx.onerror = tx.onabort = () => resolve(false);
  });
}

export async function dbGet(store, id) {
  const db = await openDatabase();
  if (!db || !STORES.includes(store)) return null;
  return new Promise(resolve => {
    const request = db.transaction(store, 'readonly').objectStore(store).get(id);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => resolve(null);
  });
}

export async function dbAll(store) {
  const db = await openDatabase();
  if (!db || !STORES.includes(store)) return [];
  return new Promise(resolve => {
    const request = db.transaction(store, 'readonly').objectStore(store).getAll();
    request.onsuccess = () => resolve((request.result || []).map(row => ({ id: row.id, ...row.value })));
    request.onerror = () => resolve([]);
  });
}

export async function dbDelete(store, id) {
  const db = await openDatabase();
  if (!db || !STORES.includes(store)) return false;
  return new Promise(resolve => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = tx.onabort = () => resolve(false);
  });
}

export function storageAvailable() {
  return typeof indexedDB !== 'undefined';
}
