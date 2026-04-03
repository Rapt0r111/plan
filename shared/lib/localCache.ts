/**
 * @file localCache.ts — shared/lib
 *
 * v5 — добавлен тип create_epic для офлайн-создания эпиков.
 *
 * ПОРЯДОК REPLAY:
 *   create_epic → create_with_relations → patch_task → прочие
 *   Задачи могут ссылаться на tempEpicId → эпики должны создаваться первыми.
 */

const DB_NAME    = "plan-cache";
const DB_VERSION = 4; // +1 из-за нового типа pending_op
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

export interface SubtaskDraft {
  isCompleted: boolean;
  sortOrder:   number;
}

/**
 * PendingOp — полиморфный тип офлайн-операции.
 * Discriminated union по полю `kind`.
 *
 * ВАЖНО: create_epic должен обрабатываться ДО create_with_relations,
 * так как задача может ссылаться на tempEpicId.
 */
export type PendingOp =
  | {
      kind:        "create_epic";
      id:          string;
      createdAt:   number;
      retries:     number;
      tempEpicId:  number;
      title:       string;
      description: string | null;
      color:       string;
      startDate:   string | null;
      endDate:     string | null;
    }
  | {
      kind:        "create_with_relations";
      id:          string;
      createdAt:   number;
      retries:     number;
      epicId:      number;
      title:       string;
      status:      string;
      priority:    string;
      description: string | null;
      dueDate:     string | null;
      sortOrder:   number;
      assigneeIds: number[];
      subtasks:    SubtaskDraft[];
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
      kind?:      undefined;
      id:         string;
      url:        string;
      method:     "PATCH" | "DELETE" | "POST";
      body?:      Record<string, unknown>;
      createdAt:  number;
      retries:    number;
    };

export type PendingOpInput =
  | {
      kind: "create_epic";
      tempEpicId:  number;
      title:       string;
      description: string | null;
      color:       string;
      startDate:   string | null;
      endDate:     string | null;
    }
  | {
      kind: "create_with_relations";
      epicId:      number;
      title:       string;
      status:      string;
      priority:    string;
      description: string | null;
      dueDate:     string | null;
      sortOrder:   number;
      assigneeIds: number[];
      subtasks:    SubtaskDraft[];
      tempTaskId:  number;
    }
  | {
      kind: "patch_task";
      url:                string;
      patch:              Record<string, unknown>;
      expectedUpdatedAt:  string | undefined;
    }
  | {
      kind?: undefined;
      url:    string;
      method: "PATCH" | "DELETE" | "POST";
      body?:  Record<string, unknown>;
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