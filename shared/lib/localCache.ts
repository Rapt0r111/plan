/**
 * @file localCache.ts — shared/lib
 *
 * IndexedDB-обёртка с двумя хранилищами:
 *   "epics"       — снапшот EpicWithTasks[] для cold-start без сети
 *   "pending_ops" — очередь HTTP-запросов, ожидающих отправки
 *
 * ИСПРАВЛЕНИЯ v3:
 *   БАГ #2 ИСПРАВЛЕН: _db.addEventListener("close", ...) — событие "close"
 *     не существует в спецификации IDBDatabase. Правильное событие — "versionchange",
 *     которое срабатывает когда другая вкладка хочет обновить схему БД.
 *     Без этого fix синглтон _db никогда не сбрасывался при неожиданном
 *     закрытии БД, что приводило к ошибкам "database connection is closing"
 *     при следующих операциях.
 */

const DB_NAME    = "plan-cache";
const DB_VERSION = 2;
const EPICS_STORE = "epics";
const QUEUE_STORE = "pending_ops";

// ── Singleton connection ──────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (_db) return _db;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(EPICS_STORE)) {
        db.createObjectStore(EPICS_STORE);
      }

      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const qs = db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        qs.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    req.onsuccess = () => {
      _db = req.result;

      // ИСПРАВЛЕНО: "close" → "versionchange"
      // IDBDatabase не имеет события "close" в спецификации W3C.
      // "versionchange" срабатывает когда другая вкладка вызывает
      // indexedDB.open() с новой версией — нужно закрыть соединение
      // чтобы не блокировать апгрейд.
      _db.addEventListener("versionchange", () => {
        _db?.close();
        _db = null;
      });

      resolve(_db);
    };

    req.onerror   = () => reject(req.error);
    req.onblocked = () => reject(new Error("IDB blocked — close other tabs and retry"));
  });
}

/** Превращает IDBRequest в промис, чтобы можно было await. */
function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

// ── Epics snapshot ────────────────────────────────────────────────────────────

export async function cacheEpics(epics: unknown): Promise<void> {
  try {
    const db  = await openDB();
    const tx  = db.transaction(EPICS_STORE, "readwrite");
    await promisifyRequest(tx.objectStore(EPICS_STORE).put(JSON.stringify(epics), "all"));
  } catch {
    // silent — кеш необязателен
  }
}

export async function getCachedEpics(): Promise<unknown | null> {
  try {
    const db     = await openDB();
    const tx     = db.transaction(EPICS_STORE, "readonly");
    const result = await promisifyRequest<string | undefined>(
      tx.objectStore(EPICS_STORE).get("all"),
    );
    return result ? JSON.parse(result) : null;
  } catch {
    return null;
  }
}

// ── Pending ops queue ─────────────────────────────────────────────────────────

export const MAX_OP_RETRIES = 5; // НОВОЕ: максимум попыток для 5xx ошибок

export interface PendingOp {
  id: string;
  url: string;
  method: "PATCH" | "DELETE" | "POST";
  body?: Record<string, unknown>;
  createdAt: number;
  retries: number;
}

export async function enqueuePendingOp(
  op: Omit<PendingOp, "id" | "createdAt" | "retries">,
): Promise<PendingOp> {
  const full: PendingOp = {
    ...op,
    id:        crypto.randomUUID(),
    createdAt: Date.now(),
    retries:   0,
  };
  try {
    const db = await openDB();
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    await promisifyRequest(tx.objectStore(QUEUE_STORE).put(full));
  } catch {
    // silent
  }
  return full;
}

export async function getPendingOps(): Promise<PendingOp[]> {
  try {
    const db  = await openDB();
    const tx  = db.transaction(QUEUE_STORE, "readonly");
    const all = await promisifyRequest<PendingOp[]>(
      tx.objectStore(QUEUE_STORE).getAll(),
    );
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function removePendingOp(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    await promisifyRequest(tx.objectStore(QUEUE_STORE).delete(id));
  } catch {
    // silent
  }
}

export async function incrementOpRetries(id: string): Promise<void> {
  try {
    const db    = await openDB();
    const tx    = db.transaction(QUEUE_STORE, "readwrite");
    const store = tx.objectStore(QUEUE_STORE);
    const op    = await promisifyRequest<PendingOp | undefined>(store.get(id));
    if (op) {
      await promisifyRequest(store.put({ ...op, retries: op.retries + 1 }));
    }
  } catch {
    // silent
  }
}

export async function getPendingOpsCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(QUEUE_STORE, "readonly");
    return await promisifyRequest<number>(tx.objectStore(QUEUE_STORE).count());
  } catch {
    return 0;
  }
}

export async function clearPendingOps(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    await promisifyRequest(tx.objectStore(QUEUE_STORE).clear());
  } catch {
    // silent
  }
}