/* Offline shell.

   The previous worker pre-cached "styles.css?v=20260827-recurring-expenses-3"
   while the page requested "styles.css?v=20260827-full-audit-2". The strings
   never matched, so the pre-cache was dead weight and a first offline launch
   could come up unstyled. Versions live in one constant now, and the query
   string is ignored when matching, so a stale suffix cannot cause a miss. */

const VERSION = "2026-08-27-v3";
const CACHE = `nikos-shell-${VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./nikos-icon.svg",
  "./app/main.js",
  "./app/store.js",
  "./app/persist.js",
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
  "./app/cloud.js",
  "./app/demo.js",
  "./app/views/core.js",
  "./app/views/money.js",
  "./app/views/life.js",
  "./app/views/settings.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One missing file must not abandon the whole pre-cache.
    await Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

const isSameOrigin = (url) => url.origin === self.location.origin;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;                 // rate feeds and Supabase go straight to the network

  if (request.mode === "navigate") {
    // Network first, so a deploy is picked up immediately; cache is the fallback.
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put("./index.html", response.clone());
        return response;
      } catch {
        return (await caches.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // ignoreSearch means "?v=3" cannot turn a present asset into a miss.
    const cached = await cache.match(request, { ignoreSearch: true });

    const network = fetch(request).then((response) => {
      if (response.ok && response.type === "basic") cache.put(request, response.clone());
      return response;
    }).catch(() => null);

    if (cached) {
      // Refresh in the background without leaving an unhandled rejection offline.
      event.waitUntil(network);
      return cached;
    }

    return (await network) || Response.error();
  })());
});
