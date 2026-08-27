/* Something to look at when the app fails to start.
 *
 * Today a single unbalanced bracket shipped to the live site. The browser
 * refused the whole module graph, main.js never ran, and the boot splash sat
 * there spinning — so the only thing the owner could report was "не грузит".
 * No message, no version, nothing to act on.
 *
 * This file is a plain script, not a module, and it is loaded before the app.
 * That matters: a syntax error anywhere in the module graph stops the module
 * entry point dead, but leaves a classic script untouched. So this runs
 * precisely when everything else does not.
 *
 * It offers the one repair that actually helps here — throwing away the
 * service worker and its caches — because a bad build can otherwise be pinned
 * in place by the very cache that makes the app work offline. */

(function () {
  "use strict";

  var TIMEOUT_MS = 10000;
  var failure = null;
  var shown = false;

  window.addEventListener("error", function (event) {
    /* Module parse failures arrive here with a message and no useful stack. */
    if (!failure) {
      failure = event.message || (event.error && event.error.message) || "неизвестная ошибка";
    }
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    if (!failure && event.reason) {
      failure = String(event.reason.message || event.reason);
    }
  });

  function build() {
    var host = document.getElementById("app");
    if (!host) return;
    host.textContent = "";

    var panel = document.createElement("div");
    panel.className = "boot-error";

    var heading = document.createElement("h1");
    heading.textContent = "Nik'Os не открылся";
    panel.appendChild(heading);

    var explain = document.createElement("p");
    explain.textContent = failure
      ? "Приложение не смогло загрузиться. Ваши записи на месте — не открылась только программа."
      : "Загрузка идёт слишком долго. Обычно помогает обновление.";
    panel.appendChild(explain);

    if (failure) {
      var detail = document.createElement("p");
      detail.className = "boot-error-detail";
      detail.textContent = failure;
      panel.appendChild(detail);
    }

    var actions = document.createElement("div");
    actions.className = "boot-error-actions";

    var reload = document.createElement("button");
    reload.type = "button";
    reload.className = "primary-button";
    reload.textContent = "Обновить и очистить кэш";
    reload.onclick = function () {
      reload.disabled = true;
      reload.textContent = "Обновляю…";
      recover();
    };
    actions.appendChild(reload);

    var plain = document.createElement("button");
    plain.type = "button";
    plain.className = "ghost-button";
    plain.textContent = "Просто перезагрузить";
    plain.onclick = function () { location.reload(); };
    actions.appendChild(plain);

    panel.appendChild(actions);

    var note = document.createElement("p");
    note.className = "boot-error-note";
    note.textContent = "Очистка кэша не трогает записи — они лежат отдельно.";
    panel.appendChild(note);

    host.appendChild(panel);
    shown = true;
  }

  /* Drop the service worker and every cache, then reload from the network.
     Records live in IndexedDB and localStorage and are deliberately untouched. */
  function recover() {
    var jobs = [];

    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(function (all) {
        return Promise.all(all.map(function (registration) { return registration.unregister(); }));
      }).catch(function () { /* nothing to unregister */ }));
    }

    if (window.caches && caches.keys) {
      jobs.push(caches.keys().then(function (names) {
        return Promise.all(names.map(function (name) { return caches.delete(name); }));
      }).catch(function () { /* nothing to clear */ }));
    }

    Promise.all(jobs).then(function () {
      location.replace(location.pathname + "?fresh=" + Date.now());
    }, function () {
      location.reload();
    });
  }

  setTimeout(function () {
    if (!window.__nikosReady && !shown) build();
  }, TIMEOUT_MS);
})();
