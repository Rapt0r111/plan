/**
 * @file localCache.ts — shared/lib
 *
 * v4 — расширен тип PendingOp для поддержки create_with_relations:
 *
 *   kind: "create_with_relations" — офлайн-создание задачи с подзадачами
 *   kind: "patch_task"           — офлайн-патч задачи с optimistic concurrency
 *   (остальные как раньше: url/method/body)
 *
 * Вариант A merge: изменения temp-задачи (isCompleted подзадач, статус и т.д.)
 * записываются прямо внутрь queued create_with_relations, а не создают
 * отдельные PATCH-операции. Это гарантирует корректную синхронизацию
 * при последовательном потоке офлайн-изменений.
 */

const DB_NAME    = "plan-cache";
const DB_VERSION = 3; // версия поднята из-за новых полей в pending_ops
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
  } catch { /* silent */ }
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

export const MAX_OP_RETRIES = 5;

/**
 * SubtaskDraft — черновик подзадачи в очереди create_with_relations.
 * title НЕ хранится (NOT NULL — генерируется сервером по индексу).
 */
export interface SubtaskDraft {
  isCompleted: boolean;
  sortOrder:   number;
}

/**
 * PendingOp — полиморфный тип офлайн-операции.
 *
 * Поля discriminated по полю `kind` (или отсутствию — для обратной совместимости).
 */
export type PendingOp =
  | {
      kind:        "create_with_relations";
      id:          string;
      createdAt:   number;
      retries:     number;
      // Данные для POST /api/tasks
      epicId:      number;
      title:       string;
      status:      string;
      priority:    string;
      description: string | null;
      dueDate:     string | null;
      sortOrder:   number;
      assigneeIds: number[];
      subtasks:    SubtaskDraft[];
      // Временный id в store (отрицательный)
      tempTaskId:  number;
    }
  | {
      kind:               "patch_task";
      id:                 string;
      createdAt:          number;
      retries:            number;
      url:                string;
      patch:              Record<string, unknown>;
      expectedUpdatedAt:  string | undefined;
    }
  | {
      // Обратная совместимость — subtask toggle, assignee add/remove
      kind?:      undefined;
      id:         string;
      url:        string;
      method:     "PATCH" | "DELETE" | "POST";
      body?:      Record<string, unknown>;
      createdAt:  number;
      retries:    number;
    };

/**
 * PendingOpInput — входные данные для enqueuePendingOp (без служебных полей).
 *
 * Важно: здесь НЕ используем `Omit<PendingOp, ...>`, потому что `PendingOp` —
 * union, и `Omit` на уровне union теряет поля, которые не общие для всех веток
 * (например `url`).
 */
export type PendingOpInput =
  | {
    kind: "create_with_relations";
    // Данные для POST /api/tasks
    epicId: number;
    title: string;
    status: string;
    priority: string;
    description: string | null;
    dueDate: string | null;
    sortOrder: number;
    assigneeIds: number[];
    subtasks: SubtaskDraft[];
    // Временный id в store (отрицательный)
    tempTaskId: number;
  }
  | {
    kind: "patch_task";
    url: string;
    patch: Record<string, unknown>;
    expectedUpdatedAt: string | undefined;
  }
  | {
    // Обратная совместимость — subtask toggle, assignee add/remove
    kind?: undefined;
    url: string;
    method: "PATCH" | "DELETE" | "POST";
    body?: Record<string, unknown>;
  };

export async function enqueuePendingOp(
  op: PendingOpInput,
): Promise<PendingOp> {
  const full = {
    ...op,
    id:        crypto.randomUUID(),
    createdAt: Date.now(),
    retries:   0,
  } as PendingOp;

  try {
    const db = await openDB();
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    await promisifyRequest(tx.objectStore(QUEUE_STORE).put(full));
  } catch { /* silent */ }

  return full;
}

/**
 * updatePendingOp — обновить существующую запись в очереди (merge в create_with_relations).
 */
export async function updatePendingOp(op: PendingOp): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    await promisifyRequest(tx.objectStore(QUEUE_STORE).put(op));
  } catch { /* silent */ }
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
  } catch { /* silent */ }
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
  } catch { /* silent */ }
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
  } catch { /* silent */ }
}