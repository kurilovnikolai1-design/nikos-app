/* The single source of truth.

   Previously the interface was the state: filters read row.textContent, the
   selected filter was the button's visible label, and every renderer re-parsed
   the whole localStorage blob. Here the data lives in one place, the DOM is
   only ever a projection of it, and nothing is inferred from rendered text. */

import * as persist from "./persist.js?v=20260827-145737";
import { isLive, TYPES } from "./schema.js?v=20260827-145737";

const DEFAULT_SETTINGS = {
  baseCurrency: "RUB",
  theme: "dark",
  autoRates: true,
  autoLockMinutes: 15,
  lastBackupAt: null,
  onboarded: false,
  /* Zero means "not set" rather than "spend nothing" — an unset budget shows
     an invitation, never a panel claiming everything is overspent. */
  budgetMinor: 0,
  /* Optional. Empty means foreign tickers are valued by hand. */
  quotesApiKey: ""
};

const state = {
  ready: false,
  locked: false,
  records: [],
  audit: [],
  settings: { ...DEFAULT_SETTINGS },
  rates: null,
  index: new Map(),
  saveError: null
};

const listeners = new Set();
let saveTimer = null;
let savePending = false;

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function emit(reason = "change") {
  for (const fn of listeners) {
    try { fn(state, reason); } catch (error) { console.error("[nikos] listener failed", error); }
  }
}

function reindex() {
  state.index = new Map(state.records.map((record) => [record.id, record]));
}

/* ---------- Reading ---------- */

export const getState = () => state;
export const getSettings = () => state.settings;
export const getRates = () => state.rates;
export const isReady = () => state.ready;
export const isLocked = () => state.locked;
export const byId = (id) => state.index.get(id) || null;
export const allRecords = () => state.records;

/* Live records only: not deleted, not archived. Every list uses this,
   so an archived record can never quietly influence a total. */
export const liveRecords = () => state.records.filter(isLive);

export const recordsOfType = (...types) => {
  const wanted = new Set(types.flat());
  return state.records.filter((record) => wanted.has(record.type) && isLive(record));
};

export const recordsInView = (view) => {
  const types = Object.keys(TYPES).filter((key) => TYPES[key].view === view);
  return recordsOfType(types);
};

export const deletedRecords = () => state.records.filter((record) => record.deletedAt);
export const archivedRecords = () => state.records.filter((record) => !record.deletedAt && record.status === "archived");

/* ---------- Writing ---------- */

/* Every mutation goes through here so persistence, indexing and repaint
   stay in lockstep and a failed write is never mistaken for a success. */
/* One step back.
 *
 * Every commit already keeps the previous array in hand so it can roll back a
 * failed write. Keeping that same array one moment longer turns it into undo,
 * which costs nothing: the objects are shared, only the array is copied.
 *
 * Deliberately one level. A stack invites people to walk backwards through
 * changes they no longer remember, and the case that actually matters is the
 * one immediately after "я не то нажал". */
let lastChange = null;

export const canUndo = () => lastChange !== null;
export const undoDescription = () => lastChange?.reason ?? null;

export async function undoLast() {
  if (!lastChange) return { ok: false, reason: "nothing-to-undo" };
  const snapshot = lastChange;
  lastChange = null;                      /* undoing is not itself undoable */

  const result = await commit(() => snapshot.records.slice(), "undo");
  if (result.ok) {
    lastChange = null;
    pushAudit({ action: "undo", type: "—", recordId: "—", name: snapshot.reason });
  }
  return result;
}

/* Some changes are not worth offering back — a settings toggle, an undo. */
const UNDOABLE = new Set([
  "record-created", "record-updated", "record-deleted",
  "record-archived", "record-restored", "record-purged", "records-imported"
]);

export async function commit(mutate, reason = "change") {
  const previous = state.records;
  const next = mutate(previous.slice());
  if (!Array.isArray(next)) throw new Error("commit() must return an array of records");

  state.records = next;
  reindex();
  emit(reason);

  const written = await flush();
  if (written.result !== persist.RESULT.OK) {
    // Roll the change back so the interface never shows data that was not stored.
    state.records = previous;
    reindex();
    state.saveError = written.result;
    emit("save-failed");
    return { ok: false, reason: written.result };
  }
  state.saveError = null;
  if (UNDOABLE.has(reason)) lastChange = { records: previous, reason, at: Date.now() };
  return { ok: true };
}

export async function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  emit("settings");
  const written = await flush();
  return { ok: written.result === persist.RESULT.OK, reason: written.result };
}

export async function setRates(rates) {
  state.rates = rates;
  emit("rates");
  await flush();
}

export function pushAudit(entry) {
  state.audit = [...state.audit.slice(-299), {
    id: newId("audit"),
    at: new Date().toISOString(),
    ...entry
  }];
}

export const getAudit = () => state.audit;

async function flush() {
  const vault = {
    version: 3,
    records: state.records,
    audit: state.audit,
    settings: state.settings,
    rates: state.rates
  };
  return persist.save(vault);
}

/* Debounced save for high-frequency changes such as typing in a filter. */
export function scheduleSave() {
  savePending = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!savePending) return;
    savePending = false;
    const written = await flush();
    if (written.result !== persist.RESULT.OK) {
      state.saveError = written.result;
      emit("save-failed");
    }
  }, 400);
}

/* ---------- Lifecycle ---------- */

export async function init() {
  const loaded = await persist.load();

  if (loaded.status === "needs-pin") {
    state.locked = true;
    state.ready = true;
    emit("locked");
    return { status: "needs-pin" };
  }

  adopt(loaded.vault);
  state.locked = false;
  state.ready = true;
  emit("ready");

  if (loaded.migrated) {
    pushAudit({ action: "migrated", name: `${loaded.vault.records.length}` });
    await flush();
    persist.clearLegacy();
  }

  return { status: loaded.status, migrated: Boolean(loaded.migrated) };
}

export async function unlockWithPin(pin) {
  const opened = await persist.unlock(pin);
  if (!opened.ok) return opened;
  adopt(opened.vault);
  state.locked = false;
  state.ready = true;
  emit("ready");
  return { ok: true };
}

export function lockNow() {
  state.locked = true;
  state.records = [];
  state.audit = [];
  state.index = new Map();
  emit("locked");
}

function adopt(vault) {
  state.records = Array.isArray(vault.records) ? vault.records : [];
  state.audit = Array.isArray(vault.audit) ? vault.audit : [];
  state.settings = { ...DEFAULT_SETTINGS, ...(vault.settings || {}) };
  state.rates = vault.rates || null;
  reindex();
}

/* Replace everything — used by backup restore. */
export async function replaceAll(vault) {
  const previous = { records: state.records, audit: state.audit, settings: state.settings };
  adopt({ ...vault, settings: { ...state.settings, ...(vault.settings || {}) } });
  emit("replaced");
  const written = await flush();
  if (written.result !== persist.RESULT.OK) {
    adopt(previous);
    emit("save-failed");
    return { ok: false, reason: written.result };
  }
  return { ok: true };
}

export function exportVault() {
  return {
    product: "Nik'Os",
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    records: state.records,
    audit: state.audit,
    rates: state.rates
  };
}

export const newId = (prefix = "rec") =>
  globalThis.crypto?.randomUUID
    ? `${prefix}_${crypto.randomUUID()}`
    : `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

export { persist };
