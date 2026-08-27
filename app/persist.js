/* Storage that tells the truth.

   The old saveRecords() swallowed every exception, so a full localStorage
   quota meant the record was dropped while the interface still showed
   "Запись сохранена". Every write here returns an explicit result, and the
   caller is required to surface a failure. */

import * as lock from "./lock.js?v=20260827-144534";
import * as idb from "./idb.js?v=20260827-144534";

export const VAULT_KEY = "nikos-vault";
export const META_KEY = "nikos-vault-meta";
const LEGACY_RECORDS_KEY = "nikos-records";
const LEGACY_AUDIT_KEY = "nikos-audit";

export const RESULT = {
  OK: "ok",
  QUOTA: "quota",
  LOCKED: "locked",
  UNAVAILABLE: "unavailable",
  FAILED: "failed"
};

/* A record carries about forty-five fields and a typical one fills seventeen.
   Writing the empty ones out doubled what a year of WHOOP history costs in the
   browser — three megabytes against a five megabyte ceiling, which is not a
   margin to rely on. Empty values are dropped on the way to disk and restored
   on the way back, so nothing above this layer ever sees a different shape. */
const RECORD_DEFAULTS = {
  category: "other", name: "", counterparty: "", amountMinor: null, costBasisMinor: null,
  currency: "RUB", quantity: null, coin: "", walletAddress: "", value: null, unit: "",
  refLow: null, refHigh: null, duration: null, distance: null, intensity: null, feeling: null,
  date: null, dueTime: "", dueDate: null, endDate: null, expiresAt: null, status: "unverified",
  priority: "medium", terms: "", rate: null, owner: "me", progress: null, ownershipPercent: null,
  source: "", confidence: "medium", reminderDate: null, linkedIds: [], recurring: false,
  frequency: "monthly", nextDueDate: null, contact: "", reasoning: "", details: "",
  attachment: null, targetAmountMinor: null, ticker: null, market: null, sets: null, frequency: null, targetDate: null, deletedAt: null
};

const isEmptyValue = (value) =>
  value === null || value === undefined || value === ""
  || (Array.isArray(value) && value.length === 0);

const shrink = (record) => {
  const slim = {};
  for (const [key, value] of Object.entries(record)) {
    if (isEmptyValue(value)) continue;
    if (value === false && key in RECORD_DEFAULTS) continue;   // false is the default everywhere it appears
    slim[key] = value;
  }
  return slim;
};

const expand = (record) => ({ ...RECORD_DEFAULTS, ...record, linkedIds: record.linkedIds ?? [] });

export const compactRecords = (records) => records.map(shrink);
export const expandRecords = (records) => records.map(expand);

export const emptyVault = () => ({
  version: 3,
  records: [],
  audit: [],
  settings: {},
  rates: null,
  savedAt: null
});

/* IndexedDB is the real home; localStorage remains only as a fallback for a
   browser without it, and as the place a previous version left its data. */
let useIdb = idb.isSupported();

const recordCount = (raw) => {
  if (typeof raw !== "string") return -1;
  try {
    const parsed = JSON.parse(raw);
    if (lock.isEnvelope(parsed)) return -1;          // encrypted: cannot count, never discard
    return Array.isArray(parsed?.records) ? parsed.records.length : -1;
  } catch { return -1; }
};

async function readVault() {
  const legacy = readRaw(VAULT_KEY);

  if (useIdb) {
    try {
      const stored = await idb.get(VAULT_KEY);
      if (typeof stored === "string") {
        /* An empty vault in IndexedDB must never win over records still sitting
           in localStorage. That would silently discard everything the previous
           version saved — the one failure this product cannot afford. */
        if (recordCount(stored) === 0 && recordCount(legacy) > 0) return legacy;
        return stored;
      }
    } catch { useIdb = false; }
  }

  return legacy;
}

async function writeVault(value) {
  if (useIdb) {
    try {
      await idb.put(VAULT_KEY, value);
      // Once IndexedDB holds it, the localStorage copy is dead weight against
      // a 5 MB cap that this move exists to escape.
      try { localStorage.removeItem(VAULT_KEY); } catch { /* best effort */ }
      return { result: RESULT.OK };
    } catch (error) {
      const isQuota = error?.name === "QuotaExceededError";
      return { result: isQuota ? RESULT.QUOTA : RESULT.UNAVAILABLE, error };
    }
  }
  return writeRaw(VAULT_KEY, value);
}

function readRaw(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
    return { result: RESULT.OK };
  } catch (error) {
    const isQuota = error?.name === "QuotaExceededError"
      || error?.name === "NS_ERROR_DOM_QUOTA_REACHED"
      || error?.code === 22 || error?.code === 1014;
    return { result: isQuota ? RESULT.QUOTA : RESULT.UNAVAILABLE, error };
  }
}

export function readMeta() {
  try { return JSON.parse(readRaw(META_KEY) || "null") || { encrypted: false }; }
  catch { return { encrypted: false }; }
}

export const isEncrypted = () => readMeta().encrypted === true;

function writeMeta(meta) {
  writeRaw(META_KEY, JSON.stringify(meta));
}

/* ---------- Loading ---------- */

/* Returns { status, vault } where status is "ok" | "needs-pin" | "empty" | "corrupt". */
export async function load() {
  const raw = await readVault();

  if (!raw) {
    const migrated = migrateLegacy();
    return migrated ? { status: "ok", vault: migrated, migrated: true } : { status: "empty", vault: emptyVault() };
  }

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { status: "corrupt", vault: emptyVault() }; }

  if (lock.isEnvelope(parsed)) {
    if (!lock.hasSessionKey()) return { status: "needs-pin", vault: emptyVault() };
    try {
      const plaintext = await lock.unlockWithKey(parsed, lock.getSessionKey());
      return { status: "ok", vault: normalise(JSON.parse(plaintext)) };
    } catch { return { status: "needs-pin", vault: emptyVault() }; }
  }

  return { status: "ok", vault: normalise(parsed) };
}

/* Unlock an encrypted vault with a PIN. Returns { ok, vault } or { ok:false }. */
export async function unlock(pin) {
  const raw = await readVault();
  if (!raw) return { ok: false, reason: "empty" };
  let envelope;
  try { envelope = JSON.parse(raw); } catch { return { ok: false, reason: "corrupt" }; }
  if (!lock.isEnvelope(envelope)) return { ok: false, reason: "not-encrypted" };
  try {
    const { plaintext, key, salt } = await lock.openEnvelope(envelope, pin);
    lock.setSession(key, salt);
    return { ok: true, vault: normalise(JSON.parse(plaintext)) };
  } catch {
    return { ok: false, reason: "wrong-pin" };
  }
}

function normalise(value) {
  const base = emptyVault();
  if (!value || typeof value !== "object") return base;
  return {
    ...base,
    ...value,
    records: Array.isArray(value.records) ? expandRecords(value.records) : [],
    audit: Array.isArray(value.audit) ? value.audit : [],
    settings: value.settings && typeof value.settings === "object" ? value.settings : {}
  };
}

/* Records written by the previous build are picked up once and folded in,
   so upgrading never looks like data loss. */
function migrateLegacy() {
  const rawRecords = readRaw(LEGACY_RECORDS_KEY);
  if (!rawRecords) return null;
  let legacy;
  try { legacy = JSON.parse(rawRecords); } catch { return null; }
  if (!Array.isArray(legacy) || !legacy.length) return null;

  let audit = [];
  try { audit = JSON.parse(readRaw(LEGACY_AUDIT_KEY) || "[]"); } catch { audit = []; }

  const vault = emptyVault();
  vault.records = legacy;
  vault.audit = Array.isArray(audit) ? audit : [];
  vault.migratedFrom = "v2";
  return vault;
}

export function clearLegacy() {
  for (const key of [LEGACY_RECORDS_KEY, LEGACY_AUDIT_KEY, "nikos-today-tasks", "nikos-planner-checks"]) {
    try { localStorage.removeItem(key); } catch { /* best effort */ }
  }
}

/* ---------- Saving ---------- */

export async function save(vault) {
  const payload = JSON.stringify({
    ...vault,
    records: compactRecords(vault.records || []),
    savedAt: new Date().toISOString()
  });

  if (lock.hasSessionKey()) {
    let envelope;
    try {
      envelope = lock.withSalt(await lock.sealWithKey(payload, lock.getSessionKey()));
    } catch {
      return { result: RESULT.FAILED };
    }
    const written = await writeVault(JSON.stringify(envelope));
    if (written.result === RESULT.OK) writeMeta({ encrypted: true, savedAt: new Date().toISOString() });
    return written;
  }

  if (isEncrypted()) return { result: RESULT.LOCKED };

  const written = await writeVault(payload);
  if (written.result === RESULT.OK) writeMeta({ encrypted: false, savedAt: new Date().toISOString() });
  return written;
}

/* Turn encryption on: verify a backup was taken, then re-seal in place. */
export async function enableEncryption(vault, pin) {
  if (!lock.isSupported()) return { result: RESULT.UNAVAILABLE };
  const { key, salt } = await lock.deriveFreshKey(pin);
  lock.setSession(key, salt);
  const written = await save(vault);
  if (written.result !== RESULT.OK) { lock.clearSession(); return written; }
  return { result: RESULT.OK };
}

export async function disableEncryption(vault) {
  lock.clearSession();
  writeMeta({ encrypted: false });
  return save(vault);
}

/* ---------- Diagnostics ---------- */

/* The browser's real numbers when IndexedDB is in use, instead of the 5 MB
   guess localStorage forced on us. */
export async function usage() {
  if (useIdb) {
    const estimate = await idb.quota();
    if (estimate) return { bytes: estimate.usage, limit: estimate.quota, percent: estimate.percent, backend: "indexeddb" };
  }
  let bytes = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("nikos-")) bytes += (localStorage.getItem(key) || "").length + key.length;
    }
  } catch { return null; }
  const limit = 5 * 1024 * 1024;
  return { bytes, limit, percent: Math.min(100, Math.round((bytes / limit) * 100)), backend: "localstorage" };
}

export const backend = () => (useIdb ? "indexeddb" : "localstorage");

/* Ask the browser not to evict this origin when the phone runs short of space. */
export const requestPersistence = () => idb.requestPersistence();
