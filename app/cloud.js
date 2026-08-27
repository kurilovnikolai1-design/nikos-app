/* Optional Supabase sync.

   Local-first stays the default: nothing leaves the device until the owner
   fills in their own project details and ticks the consent box. Records are
   merged by updatedAt, and a delete is synced as a soft delete so a device
   that has been offline cannot resurrect a removed record. */

import { t, getLocale } from "./i18n.js?v=20260827-135827";
import * as store from "./store.js?v=20260827-135827";
import { migrateRecord } from "./records.js?v=20260827-135827";

const CONFIG_KEY = "nikos-cloud-config";
const CONSENT_KEY = "nikos-cloud-consent";
const PUSHED_KEY = "nikos-cloud-pushed-at";
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
    script.src = "vendor/supabase.js?v=20260827-135827";
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

/* ---------- Pushing changes without being asked ---------- */

/* Until now the only way a record reached the cloud was the "Синхронизировать"
   button in settings. Everything written between two presses of it lived on
   one device, which is exactly the failure this product exists to prevent:
   the phone is the primary device and phones get lost.
   
   A watermark rather than a dirty list, because a dirty list has to survive a
   reload and a watermark does not: anything modified after the last confirmed
   push is, by definition, still owed. It only advances when the write is
   acknowledged, so an interrupted push is retried rather than lost. */

const watermark = () => {
  try { return localStorage.getItem(PUSHED_KEY) || ""; } catch { return ""; }
};
const setWatermark = (value) => {
  try { localStorage.setItem(PUSHED_KEY, value); } catch { /* optional */ }
};

let pushTimer = null;
let pushing = false;
let pushAgain = false;

export async function pushChanged() {
  if (!isConnected() || !hasConsent()) return { ok: true, skipped: true };
  if (pushing) { pushAgain = true; return { ok: true, queued: true }; }

  const since = watermark();
  const pending = store.allRecords()
    .filter((record) => String(record.updatedAt || "") > since)
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));

  if (!pending.length) return { ok: true, nothing: true };

  pushing = true;
  announce("syncing");
  try {
    /* Chunked: a single upsert of a whole history once exceeded the request
       size limit and failed as a unit, taking the good rows down with it. */
    const CHUNK = 250;
    for (let index = 0; index < pending.length; index += CHUNK) {
      const slice = pending.slice(index, index + CHUNK);
      const { error } = await client.from(TABLE)
        .upsert(slice.map(toRow), { onConflict: "user_id,record_id" });
      if (error) {
        announce("error", error.message);
        return { ok: false, message: error.message, pushed: index };
      }
      /* Advance per chunk: an interruption halfway keeps the work already done. */
      setWatermark(String(slice.at(-1).updatedAt));
    }
    announce("synced");
    return { ok: true, pushed: pending.length };
  } catch (error) {
    announce("error", String(error?.message || error));
    return { ok: false, message: String(error?.message || error) };
  } finally {
    pushing = false;
    if (pushAgain) { pushAgain = false; schedulePush(); }
  }
}

/* Debounced, because a form submit emits several changes in a row and each
   one does not deserve its own round trip. */
export function schedulePush(delay = 2500) {
  if (!isConnected() || !hasConsent()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { void pushChanged(); }, delay);
}

/* Closing the tab should not silently drop what was just typed. */
export function flushPush() {
  if (!pushTimer) return;
  clearTimeout(pushTimer);
  pushTimer = null;
  void pushChanged();
}

export const pendingCount = () => {
  const since = watermark();
  try { return store.allRecords().filter((record) => String(record.updatedAt || "") > since).length; }
  catch { return 0; }
};

export const lastPushedAt = () => watermark() || null;

/* ---------- Devices that can be reached when the app is shut ---------- */

const PUSH_TABLE = "nikos_push_subscriptions";

export async function savePushSubscription(subscription) {
  if (!isConnected() || !hasConsent()) return { ok: false, message: "not connected" };
  const { error } = await client.from(PUSH_TABLE).upsert(
    [{ ...subscription, user_id: user.id }], { onConflict: "user_id,endpoint" });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deletePushSubscription(endpoint) {
  if (!isConnected()) return { ok: true };
  const { error } = await client.from(PUSH_TABLE)
    .delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return error ? { ok: false, message: error.message } : { ok: true };
}

export async function pushRecord(record) {
  if (!isConnected() || !hasConsent()) return { ok: true, skipped: true };
  const { error } = await client.from(TABLE).upsert([toRow(record)], { onConflict: "user_id,record_id" });
  if (error) { announce("error", error.message); return { ok: false, message: error.message }; }
  return { ok: true };
}

/* Removing records locally is not enough: syncAll merges both directions, so
   anything still in the cloud comes straight back on the next pass. Deletions
   that are meant to be permanent have to be made there too. */
export async function deleteRecords(ids) {
  if (!isConnected() || !hasConsent() || !ids.length) return { ok: true, skipped: true };
  const { error } = await client.from(TABLE).delete().eq("user_id", user.id).in("record_id", ids);
  if (error) { announce("error", error.message); return { ok: false, message: error.message }; }
  return { ok: true, deleted: ids.length };
}

export async function deleteAllRecords() {
  if (!isConnected() || !hasConsent()) return { ok: true, skipped: true };
  const { error } = await client.from(TABLE).delete().eq("user_id", user.id);
  if (error) { announce("error", error.message); return { ok: false, message: error.message }; }
  return { ok: true };
}

/* Merge by updatedAt in both directions, then write the union back. A soft
   delete carries its own updatedAt, so it wins over an older local copy. */
export async function syncAll() {
  if (!isConnected() || !hasConsent()) return { ok: false, skipped: true };
  announce("syncing");

  /* Supabase answers a select with at most a thousand rows. A year of WHOOP
     history is far more than that, so an unpaged read silently returned a
     fraction and the rest never reached the device. Page until exhausted. */
  const PAGE = 1000;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const page = await client.from(TABLE)
      .select("record_id,payload,updated_at")
      .order("record_id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (page.error) { announce("error", page.error.message); return { ok: false, message: page.error.message }; }
    rows.push(...(page.data || []));
    if ((page.data || []).length < PAGE) break;
  }

  const merged = new Map(store.allRecords().map((record) => [record.id, record]));
  let pulled = 0;

  for (const row of rows) {
    /* A device that has not been updated yet can still be pushing records in
       the old shape. They were being adopted verbatim, which recreated exactly
       the orphan-record problem the rebuild removed — a debt/"other" arriving
       from another device would render nowhere. Migrate on the way in. */
    const incoming = migrateRecord(row.payload);
    if (!incoming?.id) continue;
    const mine = merged.get(incoming.id);
    const theirTime = new Date(incoming.updatedAt || row.updated_at || 0).getTime();
    const myTime = new Date(mine?.updatedAt || 0).getTime();
    if (!mine || theirTime > myTime) { merged.set(incoming.id, incoming); pulled += 1; }
  }

  const union = [...merged.values()];
  const written = await store.commit(() => union, "cloud-sync");
  if (!written.ok) { announce("error", written.reason); return { ok: false, message: written.reason }; }

  /* Push back only what the cloud does not already have. Re-uploading every
     record on every sync meant a megabytes-large request that grows with the
     history — slow on a phone and liable to fail outright. */
  const remoteIds = new Set(rows.map((row) => row.record_id));
  const remoteTime = new Map(rows.map((row) => [row.record_id, new Date(row.payload?.updatedAt || row.updated_at || 0).getTime()]));
  const toPush = union.filter((record) => {
    if (!remoteIds.has(record.id)) return true;
    return new Date(record.updatedAt || 0).getTime() > (remoteTime.get(record.id) ?? 0);
  });

  const CHUNK = 250;
  for (let index = 0; index < toPush.length; index += CHUNK) {
    const slice = toPush.slice(index, index + CHUNK);
    const { error } = await client.from(TABLE).upsert(slice.map(toRow), { onConflict: "user_id,record_id" });
    if (error) { announce("error", error.message); return { ok: false, message: error.message }; }
  }

  announce("connected");
  return { ok: true, pulled, pushed: toPush.length, total: union.length };
}

/* The WHOOP integration needs the owner's Supabase session to prove who is
   asking, and the project URL to reach the function. Both come from here so
   there is one place that knows about the connection. */
export async function accessToken() {
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

export const projectUrl = () => (loadConfig()?.url || "").replace(/\/$/, "");
export const functionsUrl = (name) => (projectUrl() ? `${projectUrl()}/functions/v1/${name}` : null);

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
