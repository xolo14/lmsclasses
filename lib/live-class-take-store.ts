/**
 * Local drafts of live-class recordings that were not uploaded yet.
 * IndexedDB, 7-day TTL, this browser only. No extra packages.
 */

export const LIVE_TAKE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DB_NAME = "lms-live-takes";
const DB_VERSION = 1;
const STORE = "takes";

export type LocalLiveTake = {
  id: string;
  liveClassId: string;
  title: string;
  createdAt: number;
  expiresAt: number;
  mimeType: string;
  size: number;
  durationSeconds: number;
  blob: Blob;
};

export type LocalLiveTakeMeta = Omit<LocalLiveTake, "blob">;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser cannot store recordings locally."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("liveClassId", "liveClassId", { unique: false });
        store.createIndex("expiresAt", "expiresAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open recording history."));
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(STORE, mode);
  const finished = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  });
  try {
    const result = await fn(tx.objectStore(STORE));
    await finished;
    return result;
  } finally {
    db.close();
  }
}

export async function purgeExpiredLiveTakes(now = Date.now()): Promise<void> {
  await withStore("readwrite", async (store) => {
    const all = (await requestToPromise(store.getAll())) as LocalLiveTake[];
    for (const row of all) {
      if (!row?.id) continue;
      if (row.expiresAt <= now || !row.blob) {
        store.delete(row.id);
      }
    }
  });
}

export async function listLiveTakes(liveClassId: string): Promise<LocalLiveTakeMeta[]> {
  await purgeExpiredLiveTakes();
  return withStore("readonly", async (store) => {
    const index = store.index("liveClassId");
    const rows = (await requestToPromise(index.getAll(liveClassId))) as LocalLiveTake[];
    return rows
      .filter((row) => row?.id && row.expiresAt > Date.now() && row.blob)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ blob: _blob, ...meta }) => meta);
  });
}

export async function saveLiveTake(input: {
  liveClassId: string;
  title: string;
  blob: Blob;
  durationSeconds: number;
}): Promise<LocalLiveTakeMeta> {
  const now = Date.now();
  const take: LocalLiveTake = {
    id: crypto.randomUUID(),
    liveClassId: input.liveClassId,
    title: input.title,
    createdAt: now,
    expiresAt: now + LIVE_TAKE_TTL_MS,
    mimeType: input.blob.type || "video/webm",
    size: input.blob.size,
    durationSeconds: Math.max(0, Math.floor(input.durationSeconds)),
    blob: input.blob,
  };
  await withStore("readwrite", (store) => {
    store.put(take);
  });
  const { blob: _blob, ...meta } = take;
  return meta;
}

export async function getLiveTake(id: string): Promise<LocalLiveTake | null> {
  const row = await withStore("readonly", (store) => requestToPromise(store.get(id)));
  if (!row || row.expiresAt <= Date.now() || !row.blob) {
    if (row?.id) await deleteLiveTake(row.id).catch(() => undefined);
    return null;
  }
  return row as LocalLiveTake;
}

export async function deleteLiveTake(id: string): Promise<void> {
  await withStore("readwrite", (store) => {
    store.delete(id);
  });
}
