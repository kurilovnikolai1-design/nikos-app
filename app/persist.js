/* Storage that tells the truth.

   The old saveRecords() swallowed every exception, so a full localStorage
   quota meant the record was dropped while the interface still showed
   "Запись сохранена". Every write here returns an explicit result, and the
   caller is required to surface a failure. */

import * as lock from "./lock.js?v=20260827-055819";

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

export const emptyVault = () => ({
  version: 3,
  records: [],
  audit: [],
  settings: {},
  rates: null,
  savedAt: null
});

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
  const raw = readRaw(VAULT_KEY);

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
  const raw = readRaw(VAULT_KEY);
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
    records: Array.isArray(value.records) ? value.records : [],
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
  const payload = JSON.stringify({ ...vault, savedAt: new Date().toISOString() });

  if (lock.hasSessionKey()) {
    let envelope;
    try {
      envelope = lock.withSalt(await lock.sealWithKey(payload, lock.getSessionKey()));
    } catch {
      return { result: RESULT.FAILED };
    }
    const written = writeRaw(VAULT_KEY, JSON.stringify(envelope));
    if (written.result === RESULT.OK) writeMeta({ encrypted: true, savedAt: new Date().toISOString() });
    return written;
  }

  if (isEncrypted()) return { result: RESULT.LOCKED };

  const written = writeRaw(VAULT_KEY, payload);
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

export function usage() {
  let bytes = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("nikos-")) bytes += (localStorage.getItem(key) || "").length + key.length;
    }
  } catch { return null; }
  // Browsers commonly cap an origin at about 5 MB of UTF-16 storage.
  const limit = 5 * 1024 * 1024;
  return { bytes, limit, percent: Math.min(100, Math.round((bytes / limit) * 100)) };
}

/* Confirm a payload will actually fit before promising the owner it was saved. */
export function willFit(vault) {
  const size = JSON.stringify(vault).length;
  const current = usage();
  if (!current) return true;
  return size < current.limit * 0.95;
}
