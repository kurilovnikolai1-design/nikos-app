/* Optional Supabase sync.

   Local-first stays the default: nothing leaves the device until the owner
   fills in their own project details and ticks the consent box. Records are
   merged by updatedAt, and a delete is synced as a soft delete so a device
   that has been offline cannot resurrect a removed record. */

import { t, getLocale } from "./i18n.js?v=20260827-061621";
import * as store from "./store.js?v=20260827-061621";

const CONFIG_KEY = "nikos-cloud-config";
const CONSENT_KEY = "nikos-cloud-consent";
const TABLE = "nikos_records";

let client = null;
let user = null;
let statusListeners = new Set();

export const onStatus = (fn) => { statusListeners.add(fn); return () => statusListeners.delete(fn); };
const announce = (state, detail = "") => statusListeners.forEach((fn) => fn(state, detail));

export const isConnected = () => Boolean(client && user);
export const currentUserEmail = () => user?.email || null;
export const hasConsent = () => { try { return localStorage.getItem(CONSENT_KEY) === "true"; } catch { return false; } };

export function loadConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || "null"); } catch { return null; }
}

function saveConfig(config) {
  // The project URL and the publishable anon key are safe to keep; the account
  // password is never written anywhere.
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch { /* optional */ }
}

export function forgetConfig() {
  try { localStorage.removeItem(CONFIG_KEY); localStorage.removeItem(CONSENT_KEY); } catch { /* optional */ }
}

/* The Supabase client is vendored locally and pulled in only when the owner
   actually turns on sync, so a local-first install makes no third-party
   request and carries no extra weight. */
let libraryPromise = null;

function loadLibrary() {
  if (globalThis.supabase?.createClient) return Promise.resolve(globalThis.supabase);
  if (libraryPromise) return libraryPromise;
  libraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "vendor/supabase.js?v=20260827-061621";
    script.async = true;
    script.onload = () => (globalThis.supabase?.createClient ? resolve(globalThis.supabase) : reject(new Error("supabase missing")));
    script.onerror = () => reject(new Error("supabase failed to load"));
    document.head.append(script);
  }).catch((error) => { libraryPromise = null; throw error; });
  return libraryPromise;
}

export const isLibraryReady = () => Boolean(globalThis.supabase?.createClient);

function createClient(url, key) {
  if (!globalThis.supabase?.createClient) return null;
  try { return globalThis.supabase.createClient(url, key); } catch { return null; }
}

export async function connect({ url, key, email, password, signUp = false, consent }) {
  if (!consent) return { ok: false, message: getLocale() === "ru" ? "Отметьте согласие на синхронизацию." : "Tick the consent box first." };
  if (!url || !key || !email || !password) {
    return { ok: false, message: getLocale() === "ru" ? "Заполните все поля." : "Fill in every field." };
  }
  try { await loadLibrary(); } catch {
    return { ok: false, message: getLocale() === "ru"
      ? "Не удалось загрузить клиент Supabase. Обновите страницу и попробуйте снова."
      : "The Supabase client could not be loaded. Reload the page and try again." };
  }

  client = createClient(url, key);
  if (!client) return { ok: false, message: getLocale() === "ru" ? "Неверный адрес проекта или ключ." : "Invalid project URL or key." };

  announce("connecting");
  const auth = signUp
    ? await client.auth.signUp({ email, password })
    : await client.auth.signInWithPassword({ email, password });

  if (auth.error) { announce("error", auth.error.message); return { ok: false, message: auth.error.message }; }

  user = auth.data.session?.user || null;
  if (!user) {
    announce("pending");
    return { ok: true, pending: true, message: getLocale() === "ru"
      ? "Подтвердите адрес в письме, затем подключитесь снова."
      : "Confirm your email, then connect again." };
  }

  try { localStorage.setItem(CONSENT_KEY, "true"); } catch { /* optional */ }
  saveConfig({ url, key, email });
  announce("connected");

  const synced = await syncAll();
  return { ok: true, synced };
}

export async function restore() {
  const config = loadConfig();
  if (!config || !hasConsent()) { announce("idle"); return false; }
  try { await loadLibrary(); } catch { announce("idle"); return false; }

  client = createClient(config.url, config.key);
  if (!client) { announce("idle"); return false; }

  client.auth.onAuthStateChange((_event, session) => {
    user = session?.user || null;
    announce(user ? "connected" : "idle");
  });

  const session = await client.auth.getSession();
  user = session.data.session?.user || null;
  announce(user ? "connected" : "idle");

  if (user) await syncAll();
  return Boolean(user);
}

export async function signOut() {
  if (client) await client.auth.signOut();
  user = null;
  announce("idle");
}

const toRow = (record) => ({
  user_id: user.id,
  record_id: record.id,
  record_type: record.type,
  payload: record,
  updated_at: record.updatedAt || new Date().toISOString()
});

export async function pushRecord(record) {
  if (!isConnected() || !hasConsent()) return { ok: true, skipped: true };
  const { error } = await client.from(TABLE).upsert([toRow(record)], { onConflict: "user_id,record_id" });
  if (error) { announce("error", error.message); return { ok: false, message: error.message }; }
  return { ok: true };
}

/* Merge by updatedAt in both directions, then write the union back. A soft
   delete carries its own updatedAt, so it wins over an older local copy. */
export async function syncAll() {
  if (!isConnected() || !hasConsent()) return { ok: false, skipped: true };
  announce("syncing");

  const remote = await client.from(TABLE).select("record_id,payload,updated_at");
  if (remote.error) { announce("error", remote.error.message); return { ok: false, message: remote.error.message }; }

  const merged = new Map(store.allRecords().map((record) => [record.id, record]));
  let pulled = 0;

  for (const row of remote.data || []) {
    const incoming = row.payload;
    if (!incoming?.id) continue;
    const mine = merged.get(incoming.id);
    const theirTime = new Date(incoming.updatedAt || row.updated_at || 0).getTime();
    const myTime = new Date(mine?.updatedAt || 0).getTime();
    if (!mine || theirTime > myTime) { merged.set(incoming.id, incoming); pulled += 1; }
  }

  const union = [...merged.values()];
  const written = await store.commit(() => union, "cloud-sync");
  if (!written.ok) { announce("error", written.reason); return { ok: false, message: written.reason }; }

  if (union.length) {
    const { error } = await client.from(TABLE).upsert(union.map(toRow), { onConflict: "user_id,record_id" });
    if (error) { announce("error", error.message); return { ok: false, message: error.message }; }
  }

  announce("connected");
  return { ok: true, pulled, pushed: union.length };
}

export function statusLabel(state) {
  const ru = getLocale() === "ru";
  return {
    idle: ru ? "Не подключено" : "Not connected",
    connecting: ru ? "Подключение…" : "Connecting…",
    syncing: ru ? "Синхронизация…" : "Syncing…",
    connected: ru ? "Подключено" : "Connected",
    pending: ru ? "Подтвердите email" : "Confirm your email",
    error: ru ? "Ошибка подключения" : "Connection problem"
  }[state] || (ru ? "Не подключено" : "Not connected");
}
