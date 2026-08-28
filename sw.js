/* Offline shell.

   Two lessons are baked in here.

   The old worker pre-cached "styles.css?v=…-3" while the page requested
   "styles.css?v=…-2": the strings never matched, so the pre-cache was dead
   weight and a first offline launch could come up unstyled.

   Then this build repeated the mistake in a subtler form. Only app/main.js
   carried a version in the markup; the twenty modules it imports did not. A
   cache-first worker therefore kept serving yesterday's view code, and a
   deployed fix simply did not arrive — the calendar looked updated on the
   server while the browser still ran the previous module.

   So app code is now network-first with revalidation, and falls back to the
   cache only when the network cannot answer. Freshness is guaranteed while
   online; offline still works because every response is cached on the way
   through. BUILD is stamped at publish time, which also purges old caches. */

const BUILD = "20260828-003727";
const CACHE = `nikos-shell-${BUILD}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./nikos-icon.svg",
  "./app/main.js",
  "./app/store.js",
  "./app/persist.js",
  "./app/idb.js",
  "./app/lock.js",
  "./app/schema.js",
  "./app/records.js",
  "./app/money.js",
  "./app/rates.js",
  "./app/main-rates.js",
  "./app/finance.js",
  "./app/i18n.js",
  "./app/safety.js",
  "./app/attention.js",
  "./app/ui.js",
  "./app/form.js",
  "./app/render.js",
  "./app/router.js",
  "./app/csv.js",
  "./app/labs.js",
  "./app/labs-parse.js",
  "./app/health-days.js",
  "./app/insights.js",
  "./app/form-copy.js",
  "./app/lab-insights.js",
  "./app/lab-routing.js",
  "./app/conditions.js",
  "./app/resolved.js",
  "./app/attachments.js",
  "./app/notify.js",
  "./app/boot-guard.js",
  "./app/procedures.js",
  "./app/budget.js",
  "./app/goals.js",
  "./app/positions.js",
  "./app/quotes.js",
  "./app/training.js",
  "./app/project-money.js",
  "./app/recurrence.js",
  "./app/backups.js",
  "./app/doctor-summary.js",
  "./app/bank-import.js",
  "./app/asset-costs.js",
  "./app/quick-parse.js",
  "./app/dates.js",
  "./app/lab-descriptions.js",
  "./app/cloud.js",
  "./app/whoop.js",
  "./app/demo.js",
  "./app/views/core.js",
  "./app/views/money.js",
  "./app/views/life.js",
  "./app/views/settings.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One missing file must not abandon the whole pre-cache. Bypass the HTTP
    // cache so a fresh install never seeds itself with stale copies.
    await Promise.all(APP_SHELL.map((url) =>
      fetch(new Request(url, { cache: "reload" }))
        .then((response) => (response.ok ? cache.put(url, response) : null))
        .catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
    // Tell any open tab that newer code is in charge, so it can reload itself
    // instead of running half of one version and half of the next.
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) client.postMessage({ type: "nikos-updated", build: BUILD });
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "nikos-skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // rate feeds and Supabase go straight to the network

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    try {
      // "no-cache" revalidates with the server instead of trusting the
      // ten-minute max-age GitHub Pages sends, so a deploy lands immediately.
      const response = await fetch(new Request(request, { cache: "no-cache" }));
      if (response.ok && response.type === "basic") {
        cache.put(request.mode === "navigate" ? "./index.html" : request, response.clone());
      }
      return response;
    } catch {
      const cached = await cache.match(request, { ignoreSearch: true })
        || (request.mode === "navigate" ? await cache.match("./index.html") : null);
      return cached || Response.error();
    }
  })());
});

/* ---------- Reminders ---------- */

/* Tapping a notification should land on the screen it is about, and should
   reuse the window that is already open rather than stacking up new ones. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const view = event.notification.data?.view || "command";
  const target = new URL(`./#/${view}`, self.location.href).href;

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        if ("navigate" in client) { try { await client.navigate(target); } catch { /* focus is enough */ } }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});

/* Web Push, for when the app is closed entirely. Only fires if a server is
   configured to send; without one this listener simply never runs. */
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }

  const title = payload.title || "Nik'Os";
  const options = {
    body: payload.body || "",
    tag: payload.tag || "nikos-push",
    icon: "./nikos-icon.svg",
    badge: "./nikos-icon.svg",
    data: { view: payload.view || "command" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
