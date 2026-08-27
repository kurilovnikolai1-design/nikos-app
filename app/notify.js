/* Reminders that leave the screen.
 *
 * Every record type that can carry a reminderDate has carried one since the
 * first version, and attention.js has faithfully listed the due ones — inside
 * the app. Which means a reminder was only ever seen by someone who had
 * already opened the app, and the whole point of a reminder is the opposite.
 *
 * Two mechanisms, because they fail in different places:
 *
 *   Local notifications fire from this page. They need no server and work
 *   everywhere, but only while the app is open or very recently backgrounded.
 *   Their job is to catch what is due the moment the owner looks.
 *
 *   Web Push fires from a server through the service worker and reaches a
 *   phone with the app closed. It needs a VAPID key pair and something running
 *   on a schedule, so it is optional: if it is not configured, everything here
 *   still works, just quieter.
 *
 * Nothing is ever shown twice. A notification already delivered for a given
 * record on a given day is remembered, so reopening the app five times does
 * not produce five copies of the same nudge. */

import * as store from "./store.js?v=20260827-144534";
import * as cloud from "./cloud.js?v=20260827-144534";
import { TYPES } from "./schema.js?v=20260827-144534";
import { t, getLocale, formatDate } from "./i18n.js?v=20260827-144534";

const SEEN_KEY = "nikos-notified";
const ENABLED_KEY = "nikos-notify-enabled";

export const isSupported = () =>
  typeof Notification !== "undefined" && "serviceWorker" in navigator;

export const permission = () =>
  (typeof Notification === "undefined" ? "unsupported" : Notification.permission);

export const isEnabled = () => {
  try { return localStorage.getItem(ENABLED_KEY) === "true"; } catch { return false; }
};

export function setEnabled(value) {
  try { localStorage.setItem(ENABLED_KEY, value ? "true" : "false"); } catch { /* optional */ }
}

/* Asking for permission has to be a deliberate act: a browser that is refused
   once will not ask again, so the prompt must never appear on page load. */
export async function requestPermission() {
  if (!isSupported()) return "unsupported";
  if (Notification.permission === "granted") { setEnabled(true); return "granted"; }
  if (Notification.permission === "denied") return "denied";

  const result = await Notification.requestPermission();
  if (result === "granted") setEnabled(true);
  return result;
}

/* ---------- What is due ---------- */

const today = () => new Date().toISOString().slice(0, 10);

const daysUntil = (date) => {
  if (!date) return null;
  const then = new Date(`${date}T12:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  const now = new Date();
  return Math.round((then - new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)) / 86_400_000);
};

/* Records whose reminder or expiry has arrived. Deliberately narrower than the
   attention list: an interruption on a phone should be something with a date
   the owner chose, not every observation the app could make. */
export function dueReminders(records = store.liveRecords(), { horizon = 0 } = {}) {
  const due = [];

  for (const record of records) {
    if (record.reminderDate) {
      const days = daysUntil(record.reminderDate);
      if (days !== null && days <= horizon) {
        due.push({ record, date: record.reminderDate, days, kind: "reminder" });
      }
    }
    /* A document expiring is a deadline the owner did not have to type. */
    if (record.type === "document" && record.expiresAt) {
      const days = daysUntil(record.expiresAt);
      if (days !== null && days <= 30) {
        due.push({ record, date: record.expiresAt, days, kind: "expiry" });
      }
    }
  }

  return due.sort((a, b) => a.days - b.days);
}

/* ---------- Not saying the same thing twice ---------- */

const loadSeen = () => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; }
};

const saveSeen = (value) => {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(value)); } catch { /* optional */ }
};

/* Keyed by record and day: a reminder still due tomorrow may speak again
   tomorrow, but not five times this afternoon. */
const seenKey = (item) => `${item.record.id}:${item.kind}`;

export function markSeen(items) {
  const seen = loadSeen();
  const day = today();
  for (const item of items) seen[seenKey(item)] = day;

  /* Forget anything older than a week so the key cannot grow without bound. */
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  for (const [key, when] of Object.entries(seen)) {
    if (when < cutoff) delete seen[key];
  }
  saveSeen(seen);
}

export const unseen = (items) => {
  const seen = loadSeen();
  const day = today();
  return items.filter((item) => seen[seenKey(item)] !== day);
};

/* ---------- Wording ---------- */

export function describe(item, locale = getLocale()) {
  const ru = locale === "ru";
  const name = item.record.name || TYPES[item.record.type]?.title?.[ru ? "ru" : "en"] || "";

  if (item.kind === "expiry") {
    const title = ru ? "Документ истекает" : "A document is expiring";
    const body = item.days < 0
      ? (ru ? `${name} — срок истёк ${formatDate(item.date, "medium")}` : `${name} — expired on ${formatDate(item.date, "medium")}`)
      : (ru ? `${name} — до ${formatDate(item.date, "medium")}` : `${name} — until ${formatDate(item.date, "medium")}`);
    return { title, body };
  }

  const title = ru ? "Напоминание" : "Reminder";
  const body = item.days < 0
    ? (ru ? `${name} — было назначено на ${formatDate(item.date, "medium")}` : `${name} — was due ${formatDate(item.date, "medium")}`)
    : (ru ? `${name} — сегодня` : `${name} — today`);
  return { title, body };
}

/* ---------- Showing them ---------- */

/* One notification per item up to a small cap, then a single summary. Six
   separate buzzes for six reminders is how an app gets its notifications
   switched off for good. */
const MAX_INDIVIDUAL = 3;

export async function showDue({ records = store.liveRecords(), locale = getLocale() } = {}) {
  if (!isEnabled() || permission() !== "granted") return { shown: 0, reason: "not-permitted" };

  const pending = unseen(dueReminders(records));
  if (!pending.length) return { shown: 0, reason: "nothing-due" };

  let registration = null;
  try { registration = await navigator.serviceWorker.getRegistration(); } catch { /* fall through */ }

  const show = async (title, body, tag, view) => {
    const options = {
      body, tag, lang: locale, badge: "./nikos-icon.svg", icon: "./nikos-icon.svg",
      data: { view }, requireInteraction: false
    };
    /* The service worker outlives the page, so a notification shown through it
       survives the tab closing a moment later. */
    if (registration?.showNotification) await registration.showNotification(title, options);
    else new Notification(title, options);
  };

  const ru = locale === "ru";

  if (pending.length > MAX_INDIVIDUAL) {
    await show(
      ru ? "Есть напоминания" : "You have reminders",
      ru ? `${pending.length} — откройте Nik'Os, чтобы посмотреть` : `${pending.length} — open Nik'Os to see them`,
      "nikos-due-summary",
      "command"
    );
  } else {
    for (const item of pending) {
      const { title, body } = describe(item, locale);
      await show(title, body, `nikos-${item.record.id}`, TYPES[item.record.type]?.view || "command");
    }
  }

  markSeen(pending);
  return { shown: pending.length };
}

/* Checked when the app opens and whenever it comes back to the foreground —
   the two moments when the page is definitely allowed to do this. */
export function watch() {
  if (!isSupported()) return () => {};

  const check = () => { void showDue(); };
  const onVisible = () => { if (document.visibilityState === "visible") check(); };

  document.addEventListener("visibilitychange", onVisible);
  const timer = setInterval(check, 60 * 60 * 1000);
  check();

  return () => { document.removeEventListener("visibilitychange", onVisible); clearInterval(timer); };
}

/* ---------- Web Push: reaching a phone with the app closed ---------- */

/* The public half of the VAPID pair. Public by design — the browser is given
   it at subscribe time and the push service checks signatures against it. The
   private half lives only in Supabase secrets and never in this repository. */
const VAPID_PUBLIC_KEY = "BGk4WW3m122e-5Kr6caWuv_1GzTYRDpwXRXikYoPxU0vhOx7cN8ioksSwKOxFsqpW7NBrTccHp9GOg3N3A6P7oM";

const PUSH_TABLE = "nikos_push_subscriptions";

const urlBase64ToUint8Array = (value) => {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
};

const keyToBase64Url = (buffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const canPush = () =>
  isSupported() && "PushManager" in globalThis && cloud.isConnected();

/* Registers this device so the scheduled sender can reach it. Requires the
   cloud, because without a server there is nothing to send from — local
   notifications keep working either way. */
export async function subscribePush() {
  if (!canPush()) return { ok: false, reason: "unavailable" };
  if (permission() !== "granted") return { ok: false, reason: "not-permitted" };

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    const json = subscription.toJSON();
    const saved = await cloud.savePushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh ?? keyToBase64Url(subscription.getKey("p256dh")),
      auth: json.keys?.auth ?? keyToBase64Url(subscription.getKey("auth")),
      user_agent: navigator.userAgent.slice(0, 200)
    });

    return saved.ok ? { ok: true } : { ok: false, reason: saved.message };
  } catch (error) {
    return { ok: false, reason: String(error?.message || error) };
  }
}

export async function unsubscribePush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { ok: true };
    await cloud.deletePushSubscription(subscription.endpoint);
    await subscription.unsubscribe();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: String(error?.message || error) };
  }
}

export { PUSH_TABLE };
