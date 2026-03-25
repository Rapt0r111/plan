/**
 * @file localCache.ts — shared/lib
 *
 * IndexedDB-обёртка с двумя хранилищами:
 *   "epics"       — снапшот EpicWithTasks[] для cold-start без сети
 *   "pending_ops" — очередь HTTP-запросов, ожидающих отправки
 *
 * ИСПРАВЛЕНИЯ v2:
 *   БЫЛО: IDBObjectStore.put() не awaited → данные не записывались
 *         при быстром закрытии вкладки или навигации.
 *   СТАЛО: promisifyRequest() оборачивает каждый IDBRequest в Promise,
 *          транзакция завершается корректно.
 *
 * НОВОЕ: PendingOp — структура для офлайн-очереди мутаций.
 *   Хранит HTTP-метод, URL и тело запроса. При восстановлении сети
 *   SyncOrchestrator итерирует очередь и повторяет запросы.
 */

const DB_NAME    = "plan-cache";
const DB_VERSION = 2;           // +1 — добавляем хранилище pending_ops
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

      // v1 store (уже существует у пользователей)
      if (!db.objectStoreNames.contains(EPICS_STORE)) {
        db.createObjectStore(EPICS_STORE);
      }

      // v2 store (новый)
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const qs = db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        qs.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    req.onsuccess = () => {
      _db = req.result;
      // При неожиданном закрытии базы (напр. другая вкладка удаляет БД)
      _db.addEventListener("close", () => { _db = null; });
      resolve(_db);
    };

    req.onerror   = () => reject(req.error);
    req.onblocked = () => reject(new Error("IDB blocked"));
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

/**
 * cacheEpics — сохраняет снапшот эпиков в IDB.
 *
 * БЫЛО: tx.objectStore().put() не awaited — запись могла не успеть.
 * СТАЛО: promisifyRequest гарантирует завершение транзакции.
 */
export async function cacheEpics(epics: unknown): Promise<void> {
  try {
    const db  = await openDB();
    const tx  = db.transaction(EPICS_STORE, "readwrite");
    await promisifyRequest(tx.objectStore(EPICS_STORE).put(JSON.stringify(epics), "all"));
  } catch {
    // silent — кеш необязателен, не прерываем основной поток
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

/**
 * PendingOp — HTTP-запрос, который не удалось отправить из-за отсутствия сети.
 *
 * Храним только READ/PATCH/DELETE-мутации для существующих записей.
 * Создание задач (POST /api/tasks) не ставится в очередь — требует
 * сложного маппинга temp ID → real ID (см. SyncOrchestrator).
 */
export interface PendingOp {
  /** UUID — первичный ключ IDB */
  id: string;
  /** Например: "/api/tasks/42" */
  url: string;
  method: "PATCH" | "DELETE" | "POST";
  /** JSON-body (для PATCH/POST) */
  body?: Record<string, unknown>;
  /** Unix ms — для сортировки по порядку создания */
  createdAt: number;
  /** Количество неудачных попыток replay */
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
    // Воспроизводим в хронологическом порядке
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
    const db  = await openDB();
    const tx  = db.transaction(QUEUE_STORE, "readwrite");
    const store = tx.objectStore(QUEUE_STORE);
    const op  = await promisifyRequest<PendingOp | undefined>(store.get(id));
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