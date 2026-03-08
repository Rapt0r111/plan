// НОВЫЙ ФАЙЛ: shared/lib/localCache.ts
// Тонкая обёртка над IndexedDB для кеширования Zustand-стора

const DB_NAME = "plan-cache";
const STORE_NAME = "epics";

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheEpics(epics: unknown): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(JSON.stringify(epics), "all");
  } catch { /* silent — кеш необязателен */ }
}

export async function getCachedEpics(): Promise<unknown | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const req = db.transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME).get("all");
      req.onsuccess = () => resolve(req.result ? JSON.parse(req.result) : null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}