/* Storage without the five-megabyte ceiling.

   localStorage is capped at about 5 MB per origin and, on a phone, is among the
   first things a browser reclaims when space runs short. A year of WHOOP history
   already costs over a megabyte; a few more years plus lab results and finances
   would have run into that wall — and the failure mode is losing records, which
   is the one thing this product must never do.

   IndexedDB has no such cap: browsers grant a share of free disk, typically
   hundreds of megabytes to several gigabytes. No library involved — the whole
   surface needed here is get, put and delete on one key. */

const DB_NAME = "nikos";
const DB_VERSION = 1;
const STORE = "vault";

let connection = null;

export const isSupported = () => typeof indexedDB !== "undefined";

function open() {
  if (connection) return connection;

  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };

    request.onsuccess = () => {
      const db = request.result;
      // A second tab upgrading the schema must not leave this one on a stale handle.
      db.onversionchange = () => { db.close(); connection = null; };
      resolve(db);
    };

    request.onerror = () => reject(request.error ?? new Error("indexedDB open failed"));
    request.onblocked = () => reject(new Error("indexedDB blocked by another tab"));
  }).catch((error) => { connection = null; throw error; });

  return connection;
}

const run = async (mode, work) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    let result;
    try { result = work(store); } catch (error) { reject(error); return; }
    transaction.oncomplete = () => resolve(result?.result ?? result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("transaction aborted"));
  });
};

export const get = (key) => run("readonly", (store) => store.get(key));
/* Attachments live in this same store under a "file:" prefix rather than in a
   store of their own: adding one would need a version bump, and a failed
   upgrade is a way to lose a vault. Listing keys is enough to find them. */
export const keys = () => run("readonly", (store) => store.getAllKeys());
export const put = (key, value) => run("readwrite", (store) => store.put(value, key));
export const remove = (key) => run("readwrite", (store) => store.delete(key));

/* Ask the browser to treat this data as worth keeping. Without it a phone
   short on space can evict the whole origin without warning; with it, eviction
   requires the owner to clear the site deliberately. Chrome grants it silently
   to an installed app, Safari after enough use. */
export async function requestPersistence() {
  if (!navigator.storage?.persist) return { supported: false };
  try {
    const already = await navigator.storage.persisted?.();
    if (already) return { supported: true, persisted: true, alreadyGranted: true };
    const granted = await navigator.storage.persist();
    return { supported: true, persisted: granted };
  } catch {
    return { supported: false };
  }
}

/* What the browser actually allows, rather than the 5 MB guess that
   localStorage forced on us. */
export async function quota() {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage, quota: limit } = await navigator.storage.estimate();
    if (!limit) return null;
    return { usage: usage ?? 0, quota: limit, percent: Math.min(100, Math.round(((usage ?? 0) / limit) * 100)) };
  } catch {
    return null;
  }
}

export async function selfTest() {
  if (!isSupported()) return ["IndexedDB недоступен"];
  const failures = [];
  const key = "__nikos_probe__";
  const sample = { hello: "мир", n: 1234, big: "x".repeat(50_000) };
  try {
    await put(key, sample);
    const back = await get(key);
    if (back?.big?.length !== sample.big.length) failures.push("значение вернулось не тем");
    if (back?.hello !== "мир") failures.push("юникод не пережил запись");
    await remove(key);
    if (await get(key)) failures.push("удаление не сработало");
  } catch (error) {
    failures.push(`IndexedDB: ${error?.message ?? error}`);
  }
  return failures;
}
